// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { env } from '@nexasign/lib/utils/env';

/**
 * Schreibt Mail-Artifacts (eml, body, attachments, metadata) atomar und
 * idempotent in den Archiv-Ordner. Verwendung von tmp-Verzeichnis +
 * `fs.rename` (atomic on POSIX, single-volume) verhindert Halb-Zustände.
 *
 * Idempotenz: bevor irgendwas geschrieben wird, prüfen wir, ob das Final-
 * Verzeichnis schon existiert. Wenn ja → no-op und gespeicherte Hashes
 * zurückgeben (read-only re-scan).
 *
 * GoBD-Härtung: nach erfolgreichem Move wird jede Datei auf 0440 gechmodet,
 * Verzeichnisse auf 0550 — Schutz gegen versehentliche lokale Edits.
 */

const DEFAULT_BASE = '/var/lib/nexasign/sources';

const MAIL_EML = 'mail.eml';
const MAIL_BODY_TEXT = 'body.txt';
const MAIL_BODY_HTML = 'body.html';
const MAIL_METADATA = 'metadata.json';

const FILE_MODE = 0o440;
const DIR_MODE = 0o550;

export type ArtifactKind =
  | 'MAIL_EML'
  | 'MAIL_BODY_TEXT'
  | 'MAIL_BODY_HTML'
  | 'MAIL_METADATA'
  | 'ATTACHMENT';

export type ArchiveArtifactRecord = {
  kind: ArtifactKind;
  fileName: string;
  contentType: string;
  fileSize: number;
  sha256: string;
  relativePath: string; // relativ zum DiscoveryDocument-Ordner
};

export type ArchiveWriteInput = {
  sourceId: string;
  /** sha256(messageId), 64 hex chars. */
  messageIdHash: string;
  /** Datum zum Sortieren in <yyyy>/<mm>-Unterordner. */
  receivedAt: Date;
  rawEml: Buffer;
  bodyText: string;
  bodyHtml: string | null;
  metadata: Record<string, unknown>;
  attachments: Array<{
    fileName: string;
    contentType: string;
    bytes: Uint8Array;
  }>;
};

export type ArchiveWriteResult = {
  /** Pfad relativ zur Archive-Base, z. B. "src_abc/2024/05/<hash>". */
  archivePath: string;
  /** Absoluter Pfad — nur für Diagnose. */
  absolutePath: string;
  artifacts: ArchiveArtifactRecord[];
  alreadyExisted: boolean;
};

const sha256Hex = (buf: Buffer | Uint8Array): string =>
  createHash('sha256').update(buf).digest('hex');

const getArchiveBase = (): string => {
  return env('NEXT_PRIVATE_DISCOVERY_ARCHIVE_PATH') ?? DEFAULT_BASE;
};

/**
 * Sichert, dass ein Pfadbestandteil keine Verzeichnis-Traversal-Pattern enthält.
 * messageIdHash sollte 64-hex sein, sourceId ist cuid — beides ungefährlich.
 * Diese Funktion ist defensives Härten gegen Programmierfehler beim Aufrufer.
 */
const safeSegment = (s: string): string => {
  if (!s || s.includes('/') || s.includes('\\') || s.includes('..') || s.includes('\0')) {
    throw new Error(`Unsicheres Pfad-Segment: ${s}`);
  }
  return s;
};

const safeAttachmentName = (raw: string, index: number): string => {
  // Anhänge bekommen einen sicheren Namen mit dem Original-Suffix als Hint.
  // Original-Filename liegt zusätzlich in metadata.json mit drin.
  const ext =
    path
      .extname(raw)
      .slice(0, 12)
      .replace(/[^a-z0-9.]/gi, '') || '.bin';
  return `attachment-${index + 1}${ext}`;
};

const writeFile = async (
  fullPath: string,
  data: Buffer | string,
  contentType: string,
  kind: ArtifactKind,
  fileName: string,
  relativePath: string,
): Promise<ArchiveArtifactRecord> => {
  const buf = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
  await fs.writeFile(fullPath, buf, { mode: FILE_MODE });
  return {
    kind,
    fileName,
    contentType,
    fileSize: buf.length,
    sha256: sha256Hex(buf),
    relativePath,
  };
};

const monthSegment = (date: Date): { year: string; month: string } => ({
  year: String(date.getUTCFullYear()),
  month: String(date.getUTCMonth() + 1).padStart(2, '0'),
});

/**
 * Falls ein Archiv-Ordner bereits existiert (weil ein voriger Sync genau
 * dieses messageIdHash schon abgelegt hat), lesen wir die Hashes der Dateien
 * neu ein und geben sie zurück, statt zu schreiben. Damit ist das gesamte
 * Insert idempotent — auch ohne DB-Eintrag (z. B. nach DB-Reset).
 */
const rescanExisting = async (absoluteDir: string): Promise<ArchiveArtifactRecord[]> => {
  const entries = await fs.readdir(absoluteDir);
  const out: ArchiveArtifactRecord[] = [];

  for (const fileName of entries) {
    const fullPath = path.join(absoluteDir, fileName);
    const stat = await fs.stat(fullPath);
    if (!stat.isFile()) continue;

    const buf = await fs.readFile(fullPath);
    const sha256 = sha256Hex(buf);
    let kind: ArtifactKind;
    let contentType: string;
    if (fileName === MAIL_EML) {
      kind = 'MAIL_EML';
      contentType = 'message/rfc822';
    } else if (fileName === MAIL_BODY_TEXT) {
      kind = 'MAIL_BODY_TEXT';
      contentType = 'text/plain; charset=utf-8';
    } else if (fileName === MAIL_BODY_HTML) {
      kind = 'MAIL_BODY_HTML';
      contentType = 'text/html; charset=utf-8';
    } else if (fileName === MAIL_METADATA) {
      kind = 'MAIL_METADATA';
      contentType = 'application/json';
    } else if (fileName.startsWith('attachment-')) {
      kind = 'ATTACHMENT';
      const ext = path.extname(fileName).toLowerCase();
      contentType = ext === '.pdf' ? 'application/pdf' : 'application/octet-stream';
    } else {
      // Unbekannte Datei im Ordner — überspringen, wir kontrollieren das Layout.
      continue;
    }

    out.push({
      kind,
      fileName,
      contentType,
      fileSize: stat.size,
      sha256,
      relativePath: fileName,
    });
  }

  return out;
};

export const writeArchive = async (input: ArchiveWriteInput): Promise<ArchiveWriteResult> => {
  const safeSource = safeSegment(input.sourceId);
  const safeHash = safeSegment(input.messageIdHash);
  if (!/^[a-f0-9]{64}$/.test(safeHash)) {
    throw new Error('messageIdHash muss 64-stelliger sha256-Hex-String sein.');
  }

  const { year, month } = monthSegment(input.receivedAt);
  const relativeArchivePath = path.join(safeSource, year, month, safeHash);
  const base = getArchiveBase();
  const finalDir = path.join(base, relativeArchivePath);

  // Idempotenz: existiert das Final-Verzeichnis schon, dann nichts schreiben.
  try {
    const stat = await fs.stat(finalDir);
    if (stat.isDirectory()) {
      const artifacts = await rescanExisting(finalDir);
      return {
        archivePath: relativeArchivePath,
        absolutePath: finalDir,
        artifacts,
        alreadyExisted: true,
      };
    }
  } catch (err: unknown) {
    if (!(err instanceof Error) || !('code' in err) || err.code !== 'ENOENT') {
      throw err;
    }
    // ENOENT → wir schreiben gleich neu.
  }

  // tmp-Verzeichnis im selben Eltern-Pfad, damit `fs.rename` atomar bleibt
  // (selbe Volume-Boundary). `<hash>.tmp.<random>` reduziert Race auf null.
  const parentDir = path.dirname(finalDir);
  await fs.mkdir(parentDir, { recursive: true });

  const tmpSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tmpDir = path.join(parentDir, `.${safeHash}.tmp.${tmpSuffix}`);

  await fs.mkdir(tmpDir, { recursive: true, mode: 0o700 });

  try {
    const artifacts: ArchiveArtifactRecord[] = [];

    artifacts.push(
      await writeFile(
        path.join(tmpDir, MAIL_EML),
        input.rawEml,
        'message/rfc822',
        'MAIL_EML',
        MAIL_EML,
        MAIL_EML,
      ),
    );

    artifacts.push(
      await writeFile(
        path.join(tmpDir, MAIL_BODY_TEXT),
        input.bodyText,
        'text/plain; charset=utf-8',
        'MAIL_BODY_TEXT',
        MAIL_BODY_TEXT,
        MAIL_BODY_TEXT,
      ),
    );

    if (input.bodyHtml) {
      artifacts.push(
        await writeFile(
          path.join(tmpDir, MAIL_BODY_HTML),
          input.bodyHtml,
          'text/html; charset=utf-8',
          'MAIL_BODY_HTML',
          MAIL_BODY_HTML,
          MAIL_BODY_HTML,
        ),
      );
    }

    artifacts.push(
      await writeFile(
        path.join(tmpDir, MAIL_METADATA),
        JSON.stringify(input.metadata, null, 2),
        'application/json',
        'MAIL_METADATA',
        MAIL_METADATA,
        MAIL_METADATA,
      ),
    );

    for (let i = 0; i < input.attachments.length; i += 1) {
      const att = input.attachments[i];
      const fileName = safeAttachmentName(att.fileName, i);
      const buf = Buffer.from(att.bytes);
      artifacts.push(
        await writeFile(
          path.join(tmpDir, fileName),
          buf,
          att.contentType || 'application/octet-stream',
          'ATTACHMENT',
          fileName,
          fileName,
        ),
      );
    }

    // Atomic move tmp → final. Wenn jemand parallel das Final schon angelegt
    // hat, gewinnt der Fastest-Writer — wir cleanen unseren tmp-Ordner.
    try {
      await fs.rename(tmpDir, finalDir);
    } catch (err: unknown) {
      // EEXIST/ENOTEMPTY: paralleler Schreiber kam zuerst → no-op.
      if (
        err instanceof Error &&
        'code' in err &&
        (err.code === 'EEXIST' || err.code === 'ENOTEMPTY')
      ) {
        await fs.rm(tmpDir, { recursive: true, force: true });
        const existingArtifacts = await rescanExisting(finalDir);
        return {
          archivePath: relativeArchivePath,
          absolutePath: finalDir,
          artifacts: existingArtifacts,
          alreadyExisted: true,
        };
      }
      throw err;
    }

    // Verzeichnis read-only setzen.
    await fs.chmod(finalDir, DIR_MODE);

    return {
      archivePath: relativeArchivePath,
      absolutePath: finalDir,
      artifacts,
      alreadyExisted: false,
    };
  } catch (err) {
    // Bei Fehler tmp aufräumen, damit kein Müll bleibt.
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
};

export const getAbsoluteArchivePath = (archivePath: string): string => {
  return path.join(getArchiveBase(), archivePath);
};
