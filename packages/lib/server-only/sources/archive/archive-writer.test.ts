// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { writeArchive } from './archive-writer';

const sha256 = (buf: Buffer | Uint8Array): string =>
  createHash('sha256').update(buf).digest('hex');

let testRoot: string;

const baseInput = {
  sourceId: 'src_test',
  messageIdHash: 'a'.repeat(64),
  receivedAt: new Date('2024-05-15T10:30:00Z'),
  rawEml: Buffer.from('From: test@example.com\nSubject: Test\n\nHallo'),
  bodyText: 'Hallo Welt',
  bodyHtml: null as string | null,
  metadata: { foo: 'bar' },
  attachments: [
    {
      fileName: 'rechnung.pdf',
      contentType: 'application/pdf',
      bytes: new Uint8Array(Buffer.from('%PDF-1.4 test')),
    },
  ],
};

beforeEach(async () => {
  testRoot = await fs.mkdtemp(path.join(tmpdir(), 'nexasign-archive-test-'));
  process.env.NEXT_PRIVATE_DISCOVERY_ARCHIVE_PATH = testRoot;
});

afterEach(async () => {
  // Read-only-Dirs müssen vor rm wieder write-bar gemacht werden.
  const restoreWritable = async (dir: string): Promise<void> => {
    try {
      await fs.chmod(dir, 0o700);
      const entries = await fs.readdir(dir);
      for (const entry of entries) {
        const full = path.join(dir, entry);
        const stat = await fs.stat(full).catch(() => null);
        if (!stat) continue;
        if (stat.isDirectory()) {
          await restoreWritable(full);
        } else {
          await fs.chmod(full, 0o600).catch(() => {});
        }
      }
    } catch {
      /* ignore */
    }
  };
  await restoreWritable(testRoot);
  await fs.rm(testRoot, { recursive: true, force: true });
});

describe('writeArchive', () => {
  it('schreibt eml + body + metadata + attachment mit korrekten Hashes', async () => {
    const result = await writeArchive(baseInput);

    expect(result.alreadyExisted).toBe(false);
    expect(result.archivePath).toMatch(/^src_test\/2024\/05\/a+$/);

    const kinds = result.artifacts.map((a) => a.kind).sort();
    expect(kinds).toEqual(['ATTACHMENT', 'MAIL_BODY_TEXT', 'MAIL_EML', 'MAIL_METADATA']);

    const eml = result.artifacts.find((a) => a.kind === 'MAIL_EML');
    expect(eml?.sha256).toBe(sha256(baseInput.rawEml));
    expect(eml?.fileSize).toBe(baseInput.rawEml.length);

    const body = result.artifacts.find((a) => a.kind === 'MAIL_BODY_TEXT');
    expect(body?.sha256).toBe(sha256(Buffer.from(baseInput.bodyText, 'utf-8')));

    const att = result.artifacts.find((a) => a.kind === 'ATTACHMENT');
    expect(att?.sha256).toBe(sha256(Buffer.from(baseInput.attachments[0].bytes)));
    expect(att?.fileName).toBe('attachment-1.pdf');
  });

  it('schreibt body.html nur wenn vorhanden', async () => {
    const noHtml = await writeArchive({ ...baseInput, messageIdHash: 'b'.repeat(64) });
    expect(noHtml.artifacts.some((a) => a.kind === 'MAIL_BODY_HTML')).toBe(false);

    const withHtml = await writeArchive({
      ...baseInput,
      messageIdHash: 'c'.repeat(64),
      bodyHtml: '<p>Hallo</p>',
    });
    const htmlArtifact = withHtml.artifacts.find((a) => a.kind === 'MAIL_BODY_HTML');
    expect(htmlArtifact?.contentType).toBe('text/html; charset=utf-8');
    expect(htmlArtifact?.sha256).toBe(sha256(Buffer.from('<p>Hallo</p>', 'utf-8')));
  });

  it('ist idempotent — zweiter Aufruf mit gleichem Hash schreibt nichts neues', async () => {
    const first = await writeArchive(baseInput);
    expect(first.alreadyExisted).toBe(false);

    // Inhalt manipulieren wäre real read-only blockiert; wir checken nur,
    // dass der zweite Aufruf NICHT überschreibt und alreadyExisted=true.
    const second = await writeArchive(baseInput);
    expect(second.alreadyExisted).toBe(true);
    expect(second.archivePath).toBe(first.archivePath);

    // Hashes vom Re-Scan sind identisch zum Erst-Write.
    const firstEml = first.artifacts.find((a) => a.kind === 'MAIL_EML');
    const secondEml = second.artifacts.find((a) => a.kind === 'MAIL_EML');
    expect(secondEml?.sha256).toBe(firstEml?.sha256);
  });

  it('verweigert unsichere Pfad-Segmente in messageIdHash', async () => {
    await expect(
      writeArchive({ ...baseInput, messageIdHash: '../etc/passwd' }),
    ).rejects.toThrow();
  });

  it('verweigert messageIdHash, der kein 64-hex ist', async () => {
    await expect(
      writeArchive({ ...baseInput, messageIdHash: 'xyz' }),
    ).rejects.toThrow(/64-stelliger/);
  });

  it('legt mehrere Anhänge nummeriert ab', async () => {
    const result = await writeArchive({
      ...baseInput,
      messageIdHash: 'd'.repeat(64),
      attachments: [
        {
          fileName: 'rechnung1.pdf',
          contentType: 'application/pdf',
          bytes: new Uint8Array(Buffer.from('PDF1')),
        },
        {
          fileName: 'rechnung2.pdf',
          contentType: 'application/pdf',
          bytes: new Uint8Array(Buffer.from('PDF2')),
        },
      ],
    });
    const attachments = result.artifacts.filter((a) => a.kind === 'ATTACHMENT');
    expect(attachments.map((a) => a.fileName).sort()).toEqual([
      'attachment-1.pdf',
      'attachment-2.pdf',
    ]);
  });

  it('Dateien sind nach dem Move read-only (0440)', async () => {
    const result = await writeArchive({ ...baseInput, messageIdHash: 'e'.repeat(64) });
    const emlPath = path.join(result.absolutePath, 'mail.eml');
    const stat = await fs.stat(emlPath);
    // Mode-Bits maskieren (S_IFMT etc.) und nur Permission-Bits prüfen.
    expect(stat.mode & 0o777).toBe(0o440);
  });
});
