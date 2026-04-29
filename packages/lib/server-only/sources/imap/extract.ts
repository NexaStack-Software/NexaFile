// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors
import { type Attachment, simpleParser } from 'mailparser';

/**
 * Mail-Parsing + PDF-Anhang-Extraktion.
 *
 * Logik portiert aus rechnungen.py:
 *   - text/plain bevorzugt, HTML-Fallback mit Tag-Strip
 *   - PDF-Anhänge direkt
 *   - PDF-Dateien innerhalb von ZIP-Attachments mit ausgepackt
 */

export type ExtractedAttachment = {
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
  fromZip: boolean;
};

export type ParsedMail = {
  subject: string;
  fromName: string;
  fromAddress: string;
  fromDomain: string;
  date: Date;
  /** Klartext-Body, max 1 MB. UI-Anzeige & DiscoveryDocument.bodyText. */
  bodyText: string;
  /** Roh-HTML-Body (falls vorhanden) — wird NUR als Datei abgelegt, nie inline gerendert. */
  bodyHtml: string | null;
  messageId: string;
  pdfAttachments: ExtractedAttachment[];
};

/**
 * Hard-Limit für `bodyText`: alles über 1 MB wird abgeschnitten + Marker.
 * Begründung: DB-Spalte ist TEXT (unbegrenzt), aber wir wollen nicht ein
 * 50-MB-HTML-Newsletter in jeder Listenansicht laden. Das vollständige
 * Original liegt eh in der `.eml`/`body.html`-Datei.
 */
const MAX_BODY_TEXT_BYTES = 1024 * 1024;
const truncateBody = (text: string): string => {
  const buf = Buffer.from(text, 'utf-8');
  if (buf.length <= MAX_BODY_TEXT_BYTES) return text;
  // Auf Byte-Grenze schneiden, ohne UTF-8-Multibyte mittendrin zu zerhacken.
  const cut = buf.subarray(0, MAX_BODY_TEXT_BYTES).toString('utf-8');
  return `${cut}\n\n[…gekürzt — vollständiger Inhalt in mail.eml]`;
};

const stripHtml = (html: string): string =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const isPdfAttachment = (att: Attachment): boolean => {
  if (att.contentType?.toLowerCase() === 'application/pdf') return true;
  return Boolean(att.filename && att.filename.toLowerCase().endsWith('.pdf'));
};

const isZipAttachment = (att: Attachment): boolean => {
  const ct = att.contentType?.toLowerCase();
  if (ct === 'application/zip' || ct === 'application/x-zip-compressed') return true;
  return Boolean(att.filename && att.filename.toLowerCase().endsWith('.zip'));
};

const extractPdfsFromZip = async (
  blob: Buffer,
  _parentName: string,
): Promise<ExtractedAttachment[]> => {
  // Lazy-import, damit jszip nur lädt, wenn ein ZIP wirklich vorkommt.
  const { default: JSZip } = await import('jszip');
  const out: ExtractedAttachment[] = [];
  try {
    const zip = await JSZip.loadAsync(blob);
    for (const [name, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue;
      if (!name.toLowerCase().endsWith('.pdf')) continue;
      const data = await entry.async('uint8array');
      const baseName = name.split('/').pop() ?? name;
      out.push({
        fileName: baseName,
        contentType: 'application/pdf',
        bytes: data,
        fromZip: true,
      });
    }
  } catch {
    // Defektes ZIP überspringen — kein Hard-Fail.
    return [];
  }
  return out;
};

const domainFromAddress = (addr: string): string => {
  const at = addr.indexOf('@');
  return at >= 0 ? addr.slice(at + 1).toLowerCase() : '';
};

export const parseRawMail = async (raw: Buffer): Promise<ParsedMail> => {
  const parsed = await simpleParser(raw);

  const text = parsed.text ?? (parsed.html ? stripHtml(parsed.html) : '');

  const fromEntry = Array.isArray(parsed.from) ? parsed.from[0] : parsed.from;
  const fromValue = fromEntry?.value?.[0];
  const fromAddress = (fromValue?.address ?? '').toLowerCase();
  const fromName = fromValue?.name ?? '';

  const pdfAttachments: ExtractedAttachment[] = [];

  for (const att of parsed.attachments ?? []) {
    if (!att.content) continue;
    const buf = Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content);
    if (isPdfAttachment(att)) {
      pdfAttachments.push({
        fileName: att.filename ?? 'beleg.pdf',
        contentType: att.contentType ?? 'application/pdf',
        bytes: new Uint8Array(buf),
        fromZip: false,
      });
    } else if (isZipAttachment(att)) {
      const inner = await extractPdfsFromZip(buf, att.filename ?? 'archive.zip');
      pdfAttachments.push(...inner);
    }
  }

  return {
    subject: parsed.subject ?? '',
    fromName,
    fromAddress,
    fromDomain: domainFromAddress(fromAddress),
    date: parsed.date ?? new Date(),
    bodyText: truncateBody(text),
    bodyHtml: parsed.html ? parsed.html : null,
    messageId: parsed.messageId ?? '',
    pdfAttachments,
  };
};
