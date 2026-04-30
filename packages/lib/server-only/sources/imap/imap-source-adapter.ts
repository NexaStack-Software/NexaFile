// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors
import { ImapFlow } from 'imapflow';
import { createHash } from 'node:crypto';

import { prisma } from '@nexasign/prisma';

import { putFileServerSide } from '../../../universal/upload/put-file.server';
import { createDocumentData } from '../../document-data/create-document-data';
import { writeArchive } from '../archive';
import { registerSourceAdapter } from '../registry';
import type {
  SourceAdapter,
  SyncRangeContext,
  SyncRangeProgress,
  SyncRangeResult,
  TestConnectionInput,
  TestConnectionResult,
} from '../types';
import { classifyAndExtract } from './classifier';
import { parseRawMail } from './extract';
import { validateImapHost } from './host-allowlist';
import { type ImapAccountConfig, ZImapAccountConfigSchema } from './types';

/**
 * IMAP-Source-Adapter — Schreib-Pfad in `DiscoveryDocument` für Mail-Belege.
 *
 * Härtungen aus dem Threat-Model:
 *   - Host-Allowlist + DNS-Resolution-Check (`validateImapHost`)
 *   - Connect-Timeout 10 s, Greeting-Timeout 30 s
 *   - Idempotenz via `messageIdHash` (sha256 vom Message-ID-Header)
 *   - Kein Body-Speichern: Klassifizierung läuft in-memory, persistiert wird
 *     nur was in `DiscoveryDocument` als strukturiertes Feld steht
 *
 * Sync-Modell: User-getriggert mit expliziter Datums-Range. Cancel wird
 * pro Mail geprüft; Progress-Reporting alle 25 Mails.
 */

const CONNECT_TIMEOUT_MS = 10_000;
const GREETING_TIMEOUT_MS = 30_000;

// Mailbox-Auswahl: Default ist Gmail-typisch. rechnungen.py nutzt das genauso.
// Falls die Mailbox nicht existiert (z.B. Outlook, Fastmail), fallback INBOX.
const PREFERRED_MAILBOXES = ['[Gmail]/Alle Nachrichten', '[Gmail]/All Mail', 'INBOX'];

const PROGRESS_REPORT_EVERY = 25;
const MAX_MAILS_PER_SYNC = 500;
const MAX_BYTES_PER_SYNC = 20 * 1024 * 1024;

const parseConfig = (raw: unknown): ImapAccountConfig => {
  return ZImapAccountConfigSchema.parse(raw);
};

const hashMessageId = (messageId: string): string =>
  createHash('sha256').update(messageId).digest('hex');

const buildClient = (config: ImapAccountConfig): ImapFlow => {
  return new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.port === 993,
    auth: {
      user: config.username,
      pass: config.password,
    },
    tls: {
      rejectUnauthorized: config.tlsVerify,
    },
    logger: false,
    emitLogs: false,
    connectionTimeout: CONNECT_TIMEOUT_MS,
    greetingTimeout: GREETING_TIMEOUT_MS,
    socketTimeout: GREETING_TIMEOUT_MS,
  });
};

/**
 * Versucht die Mailboxen aus PREFERRED_MAILBOXES nacheinander. Erste, die
 * existiert, wird zurückgegeben. Ohne Treffer → null (Adapter wirft).
 */
const pickMailbox = async (client: ImapFlow): Promise<string | null> => {
  const list = await client.list();
  const known = new Set(list.map((entry) => entry.path));
  for (const candidate of PREFERRED_MAILBOXES) {
    if (known.has(candidate)) return candidate;
  }
  return null;
};

const testConnection = async (input: TestConnectionInput): Promise<TestConnectionResult> => {
  let config: ImapAccountConfig;
  try {
    config = parseConfig(input.config);
  } catch {
    return { ok: false, error: 'Konfiguration ungültig.' };
  }

  const hostCheck = await validateImapHost(config.host, config.port);
  if (!hostCheck.ok) {
    return { ok: false, error: hostCheck.reason ?? 'Host nicht erlaubt.' };
  }

  const client = buildClient(config);
  try {
    await client.connect();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Verbindung fehlgeschlagen.',
    };
  } finally {
    if (client.usable) {
      try {
        await client.logout();
      } catch {
        /* ignore */
      }
    }
  }
};

/**
 * User-getriggerter Sync über einen expliziten Zeitraum. Connection-Fehler
 * werden geworfen — der Job-Handler entscheidet anhand des Wurfs, ob der
 * SyncRun FAILED ist (und Suspend-Counter erhöht).
 */
const syncRange = async (ctx: SyncRangeContext): Promise<SyncRangeResult> => {
  const config = parseConfig(ctx.decryptedConfig);

  const hostCheck = await validateImapHost(config.host, config.port);
  if (!hostCheck.ok) {
    throw new Error(hostCheck.reason ?? 'Host-Validierung fehlgeschlagen.');
  }

  const counters: SyncRangeProgress = {
    mailsChecked: 0,
    documentsAuto: 0,
    documentsManual: 0,
    documentsIgnored: 0,
    documentsFailed: 0,
  };

  const client = buildClient(config);

  try {
    await client.connect();

    const mailbox = await pickMailbox(client);
    if (!mailbox) {
      throw new Error(
        'Keine geeignete Mailbox gefunden (weder „[Gmail]/Alle Nachrichten" noch „INBOX").',
      );
    }

    const lock = await client.getMailboxLock(mailbox);
    try {
      const searchResult = await client.search({ since: ctx.from, before: ctx.to }, { uid: true });
      const uids: number[] = Array.isArray(searchResult) ? searchResult : [];

      // Neueste zuerst — ergibt sinnvolle Progress-Reihenfolge im UI.
      const orderedUids = uids
        .slice()
        .sort((a, b) => b - a)
        .slice(0, MAX_MAILS_PER_SYNC);
      let bytesProcessed = 0;

      for (let i = 0; i < orderedUids.length; i += 1) {
        // Cancel alle 10 Mails prüfen (DB-Roundtrip), nicht jedes Mal.
        if (i % 10 === 0 && (await ctx.isCancelled())) {
          break;
        }

        const uid = orderedUids[i];
        try {
          const message = await client.fetchOne(String(uid), { source: true }, { uid: true });
          if (!message || !message.source) {
            counters.mailsChecked += 1;
            continue;
          }

          const raw = Buffer.isBuffer(message.source)
            ? message.source
            : Buffer.from(message.source);
          if (bytesProcessed + raw.length > MAX_BYTES_PER_SYNC) {
            break;
          }
          bytesProcessed += raw.length;

          const parsed = await parseRawMail(raw);
          counters.mailsChecked += 1;

          if (!parsed.messageId) {
            counters.documentsIgnored += 1;
            continue;
          }

          const messageIdHash = hashMessageId(parsed.messageId);

          // Idempotenz: bereits gesehen → überspringen, zählt nicht als Treffer.
          const existing = await prisma.discoveryDocument.findFirst({
            where: { messageIdHash, sourceId: ctx.sourceId },
            select: { id: true },
          });
          if (existing) {
            counters.documentsIgnored += 1;
            continue;
          }

          // Hinweis: der `existing`-Check oben ist KEIN echter Race-Schutz —
          // bei parallelen Sync-Runs koennen beide den Datensatz noch nicht sehen
          // und beide schreiben. Der echte Schutz ist der Partial-Unique-Index
          // (sourceId, messageIdHash) in der DB (Migration 20260430080000_…).
          // Das innere try/catch unten faengt Prisma-P2002 ab und behandelt es
          // als „bereits vorhanden, ueberspringen", statt als FAILED zu zaehlen.

          const result = classifyAndExtract({
            senderDomain: parsed.fromDomain,
            subject: parsed.subject,
            bodyText: parsed.bodyText,
            hasPdfAttachment: parsed.pdfAttachments.length > 0,
          });

          if (result.verdict === 'IGNORE') {
            counters.documentsIgnored += 1;
            continue;
          }

          // Archive-Write: schreibt mail.eml + body.txt + body.html (optional) +
          // metadata.json + attachments idempotent ins Filesystem mit sha256.
          const metadata = {
            sourceId: ctx.sourceId,
            messageIdHash,
            messageId: parsed.messageId,
            fromName: parsed.fromName,
            fromAddress: parsed.fromAddress,
            fromDomain: parsed.fromDomain,
            subject: parsed.subject,
            date: parsed.date.toISOString(),
            classification: result.verdict,
            detectedAmount: result.detectedAmount,
            detectedInvoiceNumber: result.detectedInvoiceNumber,
            portalHint: result.portalHint,
            providerSource: 'imap',
            providerNativeId: String(uid),
            attachmentsOriginalNames: parsed.pdfAttachments.map((a) => a.fileName),
          };

          const archive = await writeArchive({
            sourceId: ctx.sourceId,
            messageIdHash,
            receivedAt: parsed.date,
            rawEml: raw,
            bodyText: parsed.bodyText,
            bodyHtml: parsed.bodyHtml,
            metadata,
            attachments: parsed.pdfAttachments.map((att) => ({
              fileName: att.fileName,
              contentType: att.contentType || 'application/pdf',
              bytes: att.bytes,
            })),
          });

          if (result.verdict === 'AUTO') {
            // Erstes PDF-Attachment ist das primäre DocumentData (für Sign-Flow später).
            // Weitere Attachments liegen nur als Artifacts auf disk.
            const primary = parsed.pdfAttachments[0];
            const arrayBuffer = primary.bytes.buffer.slice(
              primary.bytes.byteOffset,
              primary.bytes.byteOffset + primary.bytes.byteLength,
            );
            const file = {
              name: primary.fileName,
              type: 'application/pdf',
              arrayBuffer: async () => Promise.resolve(arrayBuffer),
            };
            const stored = await putFileServerSide(file);
            const dataRecord = await createDocumentData({
              type: stored.type,
              data: stored.data,
            });

            await prisma.$transaction(async (tx) => {
              const created = await tx.discoveryDocument.create({
                data: {
                  teamId: ctx.teamId,
                  uploadedById: ctx.userId,
                  sourceId: ctx.sourceId,
                  title: parsed.subject || primary.fileName,
                  correspondent: parsed.fromName || parsed.fromAddress,
                  documentDate: parsed.date,
                  capturedAt: new Date(),
                  status: 'INBOX',
                  providerSource: 'imap',
                  providerNativeId: String(uid),
                  contentType: 'application/pdf',
                  fileSize: primary.bytes.byteLength,
                  tags: [],
                  detectedAmount: result.detectedAmount,
                  detectedInvoiceNumber: result.detectedInvoiceNumber,
                  portalHint: null,
                  messageIdHash,
                  bodyText: parsed.bodyText,
                  bodyHasHtml: parsed.bodyHtml !== null,
                  archivePath: archive.archivePath,
                  dataId: dataRecord.id,
                },
                select: { id: true },
              });
              await tx.discoveryArtifact.createMany({
                data: archive.artifacts.map((art) => ({
                  discoveryDocumentId: created.id,
                  kind: art.kind,
                  fileName: art.fileName,
                  contentType: art.contentType,
                  fileSize: art.fileSize,
                  sha256: art.sha256,
                  relativePath: art.relativePath,
                })),
              });
              await tx.discoveryAuditLog.create({
                data: {
                  event: 'IMAP_DOCUMENT_IMPORTED',
                  sourceId: ctx.sourceId,
                  userId: ctx.userId,
                  teamId: ctx.teamId,
                  discoveryDocumentId: created.id,
                  metadata: {
                    messageIdHash,
                    fromDomain: parsed.fromDomain,
                    classification: result.verdict,
                    archivePath: archive.archivePath,
                    artifactCount: archive.artifacts.length,
                  },
                },
              });
            });
            counters.documentsAuto += 1;
          } else {
            // MANUAL — Beleg-Hinweis ohne PDF. DiscoveryDocument mit dataId=null,
            // aber Body + Archive werden trotzdem geschrieben.
            await prisma.$transaction(async (tx) => {
              const created = await tx.discoveryDocument.create({
                data: {
                  teamId: ctx.teamId,
                  uploadedById: ctx.userId,
                  sourceId: ctx.sourceId,
                  title: parsed.subject || `Beleg-Hinweis von ${parsed.fromDomain}`,
                  correspondent: parsed.fromName || parsed.fromAddress,
                  documentDate: parsed.date,
                  capturedAt: new Date(),
                  status: 'PENDING_MANUAL',
                  providerSource: 'imap',
                  providerNativeId: String(uid),
                  contentType: null,
                  fileSize: null,
                  tags: [],
                  detectedAmount: result.detectedAmount,
                  detectedInvoiceNumber: result.detectedInvoiceNumber,
                  portalHint: result.portalHint,
                  messageIdHash,
                  bodyText: parsed.bodyText,
                  bodyHasHtml: parsed.bodyHtml !== null,
                  archivePath: archive.archivePath,
                  dataId: null,
                },
                select: { id: true },
              });
              await tx.discoveryArtifact.createMany({
                data: archive.artifacts.map((art) => ({
                  discoveryDocumentId: created.id,
                  kind: art.kind,
                  fileName: art.fileName,
                  contentType: art.contentType,
                  fileSize: art.fileSize,
                  sha256: art.sha256,
                  relativePath: art.relativePath,
                })),
              });
              await tx.discoveryAuditLog.create({
                data: {
                  event: 'IMAP_DOCUMENT_IMPORTED',
                  sourceId: ctx.sourceId,
                  userId: ctx.userId,
                  teamId: ctx.teamId,
                  discoveryDocumentId: created.id,
                  metadata: {
                    messageIdHash,
                    fromDomain: parsed.fromDomain,
                    classification: result.verdict,
                    portalHint: result.portalHint,
                    detectedAmount: result.detectedAmount,
                    detectedInvoiceNumber: result.detectedInvoiceNumber,
                    archivePath: archive.archivePath,
                    artifactCount: archive.artifacts.length,
                  },
                },
              });
            });
            counters.documentsManual += 1;
          }
        } catch (err) {
          // Prisma P2002 = unique constraint violation. Bei (sourceId, messageIdHash)
          // bedeutet das: ein paralleler Sync-Run hat den Datensatz zwischen unserem
          // findFirst() und create() bereits geschrieben. Kein Fehler — Idempotenz
          // greift, wir zaehlen es als ignored und machen weiter.
          const code =
            err && typeof err === 'object' && 'code' in err
              ? (err as { code?: unknown }).code
              : undefined;
          if (code === 'P2002') {
            counters.documentsIgnored += 1;
          } else {
            counters.documentsFailed += 1;
          }
        }

        // Progress alle PROGRESS_REPORT_EVERY Mails persistieren.
        if ((i + 1) % PROGRESS_REPORT_EVERY === 0) {
          await ctx.onProgress({ ...counters });
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    if (client.usable) {
      try {
        await client.logout();
      } catch {
        /* ignore */
      }
    }
  }

  // Final-Progress-Report.
  await ctx.onProgress({ ...counters });

  return counters;
};

export const imapSourceAdapter: SourceAdapter = {
  kind: 'IMAP',
  testConnection,
  syncRange,
};

// Selbst-Registrierung beim Import. Der Job-Handler / Sources-Router muss
// dieses Modul nur einmal importieren, dann ist der Adapter in der Registry.
registerSourceAdapter(imapSourceAdapter);
