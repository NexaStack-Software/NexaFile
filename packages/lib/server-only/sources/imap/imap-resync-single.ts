// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors
//
// Re-Sync einer einzelnen DiscoveryDocument-Zeile aus IMAP.
//
// Use-Case: Belege, die importiert wurden BEVOR das Archive-Feature aktiv
// war (vor Commit e6dbf33), haben kein archivePath und keine Artifacts —
// die Mail-Bytes sind nirgends auf dem Server. Diese Funktion zieht die
// Mail nochmal aus IMAP, schreibt das Archive (eml + body + metadata +
// attachments) und ergaenzt den vorhandenen Datensatz mit archivePath +
// DiscoveryArtifact-Zeilen. KEIN neuer DiscoveryDocument-Insert — die
// User-Akzeptanz/Akten-Status etc. bleiben erhalten.
import { ImapFlow } from 'imapflow';

import { prisma } from '@nexasign/prisma';

import { writeArchive } from '../archive';
import { parseRawMail } from './extract';
import { validateImapHost } from './host-allowlist';
import { decryptImapConfig } from './imap-credentials';
import { type ImapAccountConfig, ZImapAccountConfigSchema } from './types';

const CONNECT_TIMEOUT_MS = 10_000;
const GREETING_TIMEOUT_MS = 30_000;

const PREFERRED_MAILBOXES = ['[Gmail]/Alle Nachrichten', '[Gmail]/All Mail', 'INBOX'];

const buildClient = (config: ImapAccountConfig): ImapFlow =>
  new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.port === 993,
    auth: { user: config.username, pass: config.password },
    tls: { rejectUnauthorized: config.tlsVerify },
    logger: false,
    emitLogs: false,
    connectionTimeout: CONNECT_TIMEOUT_MS,
    greetingTimeout: GREETING_TIMEOUT_MS,
    socketTimeout: GREETING_TIMEOUT_MS,
  });

const pickMailbox = async (client: ImapFlow): Promise<string | null> => {
  const list = await client.list();
  const known = new Set(list.map((entry) => entry.path));
  for (const candidate of PREFERRED_MAILBOXES) {
    if (known.has(candidate)) return candidate;
  }
  return null;
};

export type ResyncSingleResult =
  | { ok: true; archivePath: string; attachmentsAdded: number; alreadyHadArchive: boolean }
  | { ok: false; reason: string };

export type ResyncSingleInput = {
  documentId: string;
  /** Akteur — nur er darf Belege seines Teams nachladen. */
  userId: number;
  teamId: number;
};

/**
 * Laedt eine einzelne Mail aus IMAP nach. Idempotent — wenn das Archive auf
 * Disk schon existiert (gleiche messageIdHash), wird nichts neu geschrieben,
 * aber die DiscoveryArtifact-Zeilen werden trotzdem ergaenzt, falls fehlend.
 */
export const resyncSingleDocument = async (
  input: ResyncSingleInput,
): Promise<ResyncSingleResult> => {
  // 1) Document + Source laden, Authorization checken.
  const doc = await prisma.discoveryDocument.findFirst({
    where: {
      id: input.documentId,
      teamId: input.teamId,
      uploadedById: input.userId,
      providerSource: 'imap',
    },
    select: {
      id: true,
      sourceId: true,
      messageIdHash: true,
      providerNativeId: true,
      documentDate: true,
      capturedAt: true,
      archivePath: true,
      title: true,
      correspondent: true,
      _count: { select: { artifacts: true } },
    },
  });

  if (!doc) {
    return { ok: false, reason: 'Document nicht gefunden oder keine Berechtigung.' };
  }
  if (!doc.sourceId) {
    return { ok: false, reason: 'Document hat keine zugeordnete Source — kein Re-Sync möglich.' };
  }
  if (!doc.messageIdHash) {
    return { ok: false, reason: 'Document hat keinen messageIdHash — IMAP-Bezug verloren.' };
  }
  if (!doc.providerNativeId) {
    return { ok: false, reason: 'Document hat keine IMAP-UID — IMAP-Bezug verloren.' };
  }

  const source = await prisma.source.findFirst({
    where: { id: doc.sourceId, teamId: input.teamId },
  });
  if (!source) {
    return { ok: false, reason: 'Source nicht gefunden oder gelöscht.' };
  }
  if (source.lastSyncStatus === 'SUSPENDED') {
    return { ok: false, reason: 'Source ist gesperrt — bitte Quelle prüfen.' };
  }

  // 2) Konfig entschluesseln, Host-Allowlist validieren.
  let config: ImapAccountConfig;
  try {
    const decrypted = decryptImapConfig({
      ciphertext: source.encryptedConfig,
      keyVersion: source.encryptedConfigKeyVersion,
    });
    config = ZImapAccountConfigSchema.parse(decrypted);
  } catch (err) {
    return {
      ok: false,
      reason: `Source-Konfig konnte nicht entschlüsselt werden: ${err instanceof Error ? err.message : 'unbekannt'}`,
    };
  }

  const hostCheck = await validateImapHost(config.host, config.port);
  if (!hostCheck.ok) {
    return { ok: false, reason: hostCheck.reason ?? 'Host nicht erlaubt.' };
  }

  // 3) IMAP verbinden, Mail per UID holen.
  const client = buildClient(config);
  let raw: Buffer | null = null;

  try {
    await client.connect();
    const mailbox = await pickMailbox(client);
    if (!mailbox) {
      return { ok: false, reason: 'Keine kompatible Mailbox gefunden.' };
    }
    const lock = await client.getMailboxLock(mailbox);
    try {
      const uid = doc.providerNativeId;
      const message = await client.fetchOne(uid, { source: true }, { uid: true });
      if (!message || !message.source) {
        return {
          ok: false,
          reason: `Mail mit UID ${uid} nicht mehr in der Mailbox — ggf. verschoben oder gelöscht. Bitte einen vollen Sync starten.`,
        };
      }
      raw = Buffer.isBuffer(message.source) ? message.source : Buffer.from(message.source);
    } finally {
      lock.release();
    }
  } catch (err) {
    return {
      ok: false,
      reason: `IMAP-Fehler: ${err instanceof Error ? err.message : 'unbekannt'}`,
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

  if (!raw) {
    return { ok: false, reason: 'Keine Mail-Bytes geholt.' };
  }

  // 4) Mail parsen + Archive schreiben (idempotent).
  const parsed = await parseRawMail(raw);
  if (!parsed.messageId) {
    return { ok: false, reason: 'Mail hat keinen Message-Id-Header.' };
  }

  // Sicherheits-Check: gehoert die geholte Mail zum erwarteten Document?
  // Sonst koennte eine UID-Kollision (nach mailbox-Reorganisation) eine fremde
  // Mail fuer den User akzeptiert ueberschreiben.
  const { createHash } = await import('node:crypto');
  const fetchedHash = createHash('sha256').update(parsed.messageId).digest('hex');
  if (fetchedHash !== doc.messageIdHash) {
    return {
      ok: false,
      reason: `UID ${doc.providerNativeId} verweist jetzt auf eine andere Mail. Mailbox wurde umorganisiert — bitte vollen Sync starten.`,
    };
  }

  const archive = await writeArchive({
    sourceId: doc.sourceId,
    messageIdHash: doc.messageIdHash,
    receivedAt: parsed.date,
    rawEml: raw,
    bodyText: parsed.bodyText,
    bodyHtml: parsed.bodyHtml,
    metadata: {
      sourceId: doc.sourceId,
      messageIdHash: doc.messageIdHash,
      messageId: parsed.messageId,
      fromName: parsed.fromName,
      fromAddress: parsed.fromAddress,
      fromDomain: parsed.fromDomain,
      subject: parsed.subject,
      date: parsed.date.toISOString(),
      providerSource: 'imap',
      providerNativeId: doc.providerNativeId,
      attachmentsOriginalNames: parsed.pdfAttachments.map((a) => a.fileName),
      resyncedAt: new Date().toISOString(),
    },
    attachments: parsed.pdfAttachments.map((att) => ({
      fileName: att.fileName,
      contentType: att.contentType || 'application/pdf',
      bytes: att.bytes,
    })),
  });

  const alreadyHadArchive = doc.archivePath !== null && doc.archivePath !== '';

  // 5) DB-Update: archivePath setzen, Artifacts (re-)anlegen, Audit-Log.
  // skipDuplicates auf createMany schliesst die Race mit dem
  // discoveryDocumentId-kind-fileName-Unique-Constraint.
  await prisma.$transaction(async (tx) => {
    await tx.discoveryDocument.update({
      where: { id: doc.id },
      data: { archivePath: archive.archivePath },
    });
    // Vorhandene Artifacts loeschen, falls schon welche da sind (z. B. nach
    // einem teilweise misslungenen Erst-Sync). Dann frisch anlegen, damit
    // die in der DB konsistent zum Filesystem sind.
    if (doc._count.artifacts > 0) {
      await tx.discoveryArtifact.deleteMany({ where: { discoveryDocumentId: doc.id } });
    }
    if (archive.artifacts.length > 0) {
      await tx.discoveryArtifact.createMany({
        data: archive.artifacts.map((art) => ({
          discoveryDocumentId: doc.id,
          kind: art.kind,
          fileName: art.fileName,
          contentType: art.contentType,
          fileSize: art.fileSize,
          sha256: art.sha256,
          relativePath: art.relativePath,
        })),
        skipDuplicates: true,
      });
    }
    await tx.discoveryAuditLog.create({
      data: {
        event: 'IMAP_DOCUMENT_RESYNCED',
        sourceId: doc.sourceId,
        userId: input.userId,
        teamId: input.teamId,
        discoveryDocumentId: doc.id,
        metadata: {
          alreadyHadArchive,
          archivePath: archive.archivePath,
          artifactCount: archive.artifacts.length,
          attachmentCount: parsed.pdfAttachments.length,
        },
      },
    });
  });

  const attachmentsAdded = archive.artifacts.filter((a) => a.kind === 'ATTACHMENT').length;
  return {
    ok: true,
    archivePath: archive.archivePath,
    attachmentsAdded,
    alreadyHadArchive,
  };
};
