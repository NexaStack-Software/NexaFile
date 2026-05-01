// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors

import { describe, expect, it } from 'vitest';

import { parseRawMail } from './extract';

const buildRfc822Mail = (parts: {
  subject?: string;
  text?: string;
  html?: string;
  from?: string;
  date?: string;
}): Buffer => {
  const headers = [
    `From: ${parts.from ?? 'sender@example.com'}`,
    `Subject: ${parts.subject ?? 'Test'}`,
    `Date: ${parts.date ?? 'Mon, 1 Jan 2024 10:00:00 +0000'}`,
    'Message-ID: <abc@example.com>',
    'MIME-Version: 1.0',
  ];

  if (parts.html && parts.text) {
    const boundary = 'BOUNDARY42';
    return Buffer.from(
      [
        ...headers,
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/plain; charset=utf-8',
        '',
        parts.text,
        `--${boundary}`,
        'Content-Type: text/html; charset=utf-8',
        '',
        parts.html,
        `--${boundary}--`,
        '',
      ].join('\r\n'),
    );
  }

  if (parts.html) {
    return Buffer.from(
      [...headers, 'Content-Type: text/html; charset=utf-8', '', parts.html].join('\r\n'),
    );
  }

  return Buffer.from(
    [...headers, 'Content-Type: text/plain; charset=utf-8', '', parts.text ?? ''].join('\r\n'),
  );
};

describe('parseRawMail body handling', () => {
  it('liefert text/plain als bodyText, kein bodyHtml', async () => {
    const raw = buildRfc822Mail({ text: 'Hallo Welt' });
    const parsed = await parseRawMail(raw);
    expect(parsed.bodyText).toContain('Hallo Welt');
    expect(parsed.bodyHtml).toBe(null);
  });

  it('strippt HTML aus bodyText, behält bodyHtml für Datei-Ablage', async () => {
    const raw = buildRfc822Mail({ html: '<p>Hallo <b>Welt</b></p>' });
    const parsed = await parseRawMail(raw);
    expect(parsed.bodyHtml).toContain('<p>');
    // bodyText hat das HTML gestripped — keine Tags, kein "<".
    expect(parsed.bodyText).not.toContain('<');
    expect(parsed.bodyText).not.toContain('>');
    expect(parsed.bodyText).toContain('Hallo');
  });

  it('script/javascript-Inhalte landen NICHT im bodyText (nur in bodyHtml-Datei)', async () => {
    const raw = buildRfc822Mail({
      html: '<script>alert(1)</script><a href="javascript:alert(2)">click</a>',
    });
    const parsed = await parseRawMail(raw);
    // bodyText ist HTML-stripped — keine Tags durch.
    expect(parsed.bodyText).not.toContain('<script');
    expect(parsed.bodyText).not.toContain('</script');
    // mailparser entfernt Script-Tags + Inhalte beim text-extract; falls
    // wir das je auf eigenen Strip umstellen, MUSS dieser Test trotzdem
    // sicherstellen, dass kein „<" durchkommt.
    expect(parsed.bodyText).not.toMatch(/<[a-z]/i);
  });

  it('bevorzugt text/plain wenn beide Teile vorhanden sind', async () => {
    const raw = buildRfc822Mail({
      text: 'Klartext-Variante',
      html: '<p>HTML-Variante</p>',
    });
    const parsed = await parseRawMail(raw);
    expect(parsed.bodyText).toContain('Klartext-Variante');
    expect(parsed.bodyHtml).toContain('HTML-Variante');
  });

  it('bodyText wird auf 1 MB gekürzt', async () => {
    const big = 'x'.repeat(1_500_000);
    const raw = buildRfc822Mail({ text: big });
    const parsed = await parseRawMail(raw);
    const bytes = Buffer.byteLength(parsed.bodyText, 'utf-8');
    expect(bytes).toBeLessThanOrEqual(1024 * 1024 + 200);
    expect(parsed.bodyText).toMatch(/gekürzt/);
  });
});
