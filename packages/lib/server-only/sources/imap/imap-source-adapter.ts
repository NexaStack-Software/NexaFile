// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors
import { ImapFlow } from 'imapflow';
import { createHash } from 'node:crypto';

import { prisma } from '@nexasign/prisma';

import { putFileServerSide } from '../../../universal/upload/put-file.server';
import { createDocumentData } from '../../document-data/create-document-data';
import { registerSourceAdapter } from '../registry';
import type {
  SourceAdapter,
  SourceSyncContext,
  SourceSyncResult,
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
 *   - Hard-Limit pro Run: max. 500 Mails / 20 MB Bytes
 *   - Idempotenz via `messageIdHash` (sha256 vom Message-ID-Header)
 *   - Kein Body-Speichern: Klassifizierung läuft in-memory, persistiert wird
 *     nur was in `DiscoveryDocument` als strukturiertes Feld steht
 */

const CONNECT_TIMEOUT_MS = 10_000;
const GREETING_TIMEOUT_MS = 30_000;
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

const testConnection = async (input: TestConnectionInput): Promise<TestConnectionResult> => {
  let config: ImapAccountConfig;
  try {
    config = parseConfig(input.config);
  } catch (err) {
    return { ok: false, error: 'Konfiguration ungültig.' };
  }

  const hostCheck = await validateImapHost(config.host, config.port);
  if (!hostCheck.ok) {
    return { ok: false, error: hostCheck.reason ?? 'Host nicht erlaubt.' };
  }

  const client = buildClient(config);
  try {
    await client.connect();
    await client.logout();
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
 * Connection-Fehler werden als Exception geworfen, nicht als `failed`-Counter
 * zurückgegeben — der Job-Handler entscheidet anhand des Wurfs, ob der ganze
 * Sync FAILED ist (und Suspend-Counter erhöht). Das Result `{ failed > 0 }`
 * meint ausschließlich pro-Mail-Probleme bei einem grundsätzlich erfolgreichen
 * Login.
 */
const sync = async (ctx: SourceSyncContext): Promise<SourceSyncResult> => {
  const config = parseConfig(ctx.decryptedConfig);

  const hostCheck = await validateImapHost(config.host, config.port);
  if (!hostCheck.ok) {
    throw new Error(hostCheck.reason ?? 'Host-Validierung fehlgeschlagen.');
  }

  const client = buildClient(config);
  let imported = 0;
  let failed = 0;
  const errors: string[] = [];
  let bytesProcessed = 0;

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const search: Parameters<typeof client.search>[0] = ctx.since
        ? { since: ctx.since }
        : { all: true };
      const searchResult = await client.search(search, { uid: true });
      const uids: number[] = Array.isArray(searchResult) ? searchResult : [];

      // Neueste zuerst — Backfill bricht früh, wenn Limits erreicht.
      const orderedUids = uids
        .slice()
        .sort((a, b) => b - a)
        .slice(0, MAX_MAILS_PER_SYNC);

      for (const uid of orderedUids) {
        if (bytesProcessed >= MAX_BYTES_PER_SYNC) break;

        try {
          const message = await client.fetchOne(String(uid), { source: true }, { uid: true });
          if (!message || !message.source) continue;

          const raw = Buffer.isBuffer(message.source)
            ? message.source
            : Buffer.from(message.source);
          bytesProcessed += raw.length;

          const parsed = await parseRawMail(raw);
          if (!parsed.messageId) continue;

          const messageIdHash = hashMessageId(parsed.messageId);

          // Idempotenz: bereits gesehen → überspringen.
          const existing = await prisma.discoveryDocument.findFirst({
            where: { messageIdHash, sourceId: ctx.sourceId },
            select: { id: true },
          });
          if (existing) continue;

          const result = classifyAndExtract({
            senderDomain: parsed.fromDomain,
            subject: parsed.subject,
            bodyText: parsed.bodyText,
            hasPdfAttachment: parsed.pdfAttachments.length > 0,
          });

          if (result.verdict === 'IGNORE') continue;

          if (result.verdict === 'AUTO') {
            for (const attachment of parsed.pdfAttachments) {
              const arrayBuffer = attachment.bytes.buffer.slice(
                attachment.bytes.byteOffset,
                attachment.bytes.byteOffset + attachment.bytes.byteLength,
              );
              const file = {
                name: attachment.fileName,
                type: 'application/pdf',
                arrayBuffer: async () => Promise.resolve(arrayBuffer),
              };
              const stored = await putFileServerSide(file);
              const dataRecord = await createDocumentData({
                type: stored.type,
                data: stored.data,
              });

              await prisma.$transaction([
                prisma.discoveryDocument.create({
                  data: {
                    teamId: ctx.teamId,
                    uploadedById: ctx.userId,
                    sourceId: ctx.sourceId,
                    title: parsed.subject || attachment.fileName,
                    correspondent: parsed.fromName || parsed.fromAddress,
                    documentDate: parsed.date,
                    capturedAt: new Date(),
                    status: 'INBOX',
                    providerSource: 'imap',
                    providerNativeId: String(uid),
                    contentType: 'application/pdf',
                    fileSize: attachment.bytes.byteLength,
                    tags: [],
                    detectedAmount: result.detectedAmount,
                    detectedInvoiceNumber: result.detectedInvoiceNumber,
                    portalHint: null,
                    messageIdHash,
                    dataId: dataRecord.id,
                  },
                }),
                prisma.discoveryAuditLog.create({
                  data: {
                    event: 'IMAP_DOCUMENT_IMPORTED',
                    sourceId: ctx.sourceId,
                    userId: ctx.userId,
                    teamId: ctx.teamId,
                    metadata: {
                      messageIdHash,
                      fromDomain: parsed.fromDomain,
                      classification: result.verdict,
                    },
                  },
                }),
              ]);

              imported += 1;
            }
          } else {
            // MANUAL — Beleg-Hinweis ohne PDF (User muss im Portal nachziehen).
            // Wir schreiben einen DiscoveryDocument-Eintrag ohne dataId, damit
            // er im UI-Tab „Manuell zu ziehen" auftaucht.
            await prisma.$transaction([
              prisma.discoveryDocument.create({
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
                  dataId: null,
                },
              }),
              prisma.discoveryAuditLog.create({
                data: {
                  event: 'IMAP_DOCUMENT_IMPORTED',
                  sourceId: ctx.sourceId,
                  userId: ctx.userId,
                  teamId: ctx.teamId,
                  metadata: {
                    messageIdHash,
                    fromDomain: parsed.fromDomain,
                    classification: result.verdict,
                    portalHint: result.portalHint,
                    detectedAmount: result.detectedAmount,
                    detectedInvoiceNumber: result.detectedInvoiceNumber,
                  },
                },
              }),
            ]);
            imported += 1;
          }
        } catch (err) {
          failed += 1;
          errors.push(err instanceof Error ? err.message : String(err));
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

  return {
    imported,
    failed,
    errors: errors.length > 0 ? errors : undefined,
  };
};

export const imapSourceAdapter: SourceAdapter = {
  kind: 'IMAP',
  testConnection,
  sync,
};

// Selbst-Registrierung beim Import. Der Job-Handler / Sources-Router muss
// dieses Modul nur einmal importieren, dann ist der Adapter in der Registry.
registerSourceAdapter(imapSourceAdapter);
