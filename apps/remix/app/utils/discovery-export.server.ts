// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaFile contributors
import type { DiscoveryArtifactKind } from '@prisma/client';
import JSZip from 'jszip';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { getAbsoluteArchivePath } from '@nexasign/lib/server-only/sources/archive';

export const MAX_DOCUMENTS_PER_ZIP = 100;
export const MAX_TOTAL_BYTES = 200 * 1024 * 1024;

export type DiscoveryExportDocument = {
  id: string;
  title: string;
  correspondent: string | null;
  documentDate: Date | null;
  capturedAt: Date;
  detectedAmount?: string | null;
  detectedInvoiceNumber: string | null;
  status?: string;
  archivePath: string | null;
  artifacts: Array<{
    kind: DiscoveryArtifactKind;
    fileName: string;
    fileSize: number;
    relativePath: string;
  }>;
};

type SkippedRecord = {
  title: string;
  correspondent: string | null;
  documentDate: Date | null;
  invoiceNumber: string | null;
  reason: string;
};

export type DiscoveryZipBuildOptions = {
  title: string;
  documents: DiscoveryExportDocument[];
  csvRows?: string[][];
  csvFileName?: string;
};

export type DiscoveryZipBuildResult = {
  buffer: Buffer;
  documentsAdded: number;
  skippedCount: number;
};

const slugify = (raw: string | null | undefined, fallback: string): string => {
  const source = (raw ?? '').trim();
  if (source.length === 0) {
    return fallback;
  }
  const replaced = source
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00df/g, 'ss')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '');
  if (replaced.length === 0) return fallback;
  return replaced.length > 60 ? replaced.slice(0, 60) : replaced;
};

const buildFolderName = (doc: {
  documentDate: Date | null;
  capturedAt: Date;
  correspondent: string | null;
  detectedInvoiceNumber: string | null;
  title: string;
  id: string;
}): string => {
  const date = doc.documentDate ?? doc.capturedAt;
  const dateStr = date.toISOString().slice(0, 10);
  const correspondent = slugify(doc.correspondent, 'Unbekannt');
  const tail = slugify(doc.detectedInvoiceNumber ?? doc.title, doc.id.slice(0, 8));
  return `${dateStr}_${correspondent}_${tail}`;
};

const uniquify = (base: string, used: Set<string>): string => {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let i = 2;
  while (used.has(`${base}_${i}`)) i += 1;
  const final = `${base}_${i}`;
  used.add(final);
  return final;
};

const readArtifactFile = async (
  archivePath: string,
  relativePath: string,
): Promise<Buffer | null> => {
  const archiveDir = path.resolve(getAbsoluteArchivePath(archivePath));
  const filePath = path.resolve(archiveDir, relativePath);
  const archivePrefix = `${archiveDir}${path.sep}`;
  if (!filePath.startsWith(archivePrefix)) {
    return null;
  }
  try {
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
};

const csvEscape = (value: string | null | undefined): string => {
  if (value == null) return '';
  if (/[",\n;]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
};

export const rowsToCsv = (rows: string[][]): string =>
  `\uFEFF${rows.map((row) => row.map(csvEscape).join(';')).join('\n')}`;

export const discoveryZipFileName = (prefix: string, count: number): string => {
  const today = new Date().toISOString().slice(0, 10);
  if (count === 1) return `${prefix}-${today}.zip`;
  return `${prefix}-${today}_${count}.zip`;
};

export const buildDiscoveryDocumentsZip = async ({
  title,
  documents,
  csvRows,
  csvFileName,
}: DiscoveryZipBuildOptions): Promise<DiscoveryZipBuildResult> => {
  const zip = new JSZip();
  const usedFolderNames = new Set<string>();
  let totalBytes = 0;
  let documentsAdded = 0;
  const skippedRecords: SkippedRecord[] = [];

  if (csvRows && csvRows.length > 0) {
    zip.file(csvFileName ?? 'uebersicht.csv', rowsToCsv(csvRows));
  }

  for (const doc of documents) {
    if (!doc.archivePath) {
      skippedRecords.push({
        title: doc.title,
        correspondent: doc.correspondent,
        documentDate: doc.documentDate,
        invoiceNumber: doc.detectedInvoiceNumber,
        reason: 'Kein Archiv vorhanden (Datensatz vor Archive-Feature importiert).',
      });
      continue;
    }

    const folderName = uniquify(buildFolderName(doc), usedFolderNames);
    const wanted = doc.artifacts.filter(
      (art) => art.kind === 'ATTACHMENT' || art.kind === 'MAIL_EML',
    );

    let documentHadFile = false;
    for (const art of wanted) {
      if (totalBytes + art.fileSize > MAX_TOTAL_BYTES) {
        throw new Response(
          `ZIP-Groessenlimit ueberschritten (${Math.round(MAX_TOTAL_BYTES / 1024 / 1024)} MB).`,
          { status: 413 },
        );
      }
      const bytes = await readArtifactFile(doc.archivePath, art.relativePath);
      if (!bytes) continue;
      const fileNameInZip = art.kind === 'MAIL_EML' ? 'mail.eml' : art.fileName;
      zip.file(`${folderName}/${fileNameInZip}`, bytes);
      totalBytes += bytes.length;
      documentHadFile = true;
    }

    if (documentHadFile) {
      documentsAdded += 1;
    } else {
      skippedRecords.push({
        title: doc.title,
        correspondent: doc.correspondent,
        documentDate: doc.documentDate,
        invoiceNumber: doc.detectedInvoiceNumber,
        reason: `archivePath gesetzt, aber keine Datei lesbar unter ${doc.archivePath}.`,
      });
    }
  }

  if (skippedRecords.length > 0) {
    const today = new Date().toISOString().slice(0, 10);
    const lines = [
      `${title} ${today}`,
      `Belege ausgewaehlt: ${documents.length}`,
      `Belege im ZIP enthalten: ${documentsAdded}`,
      `Belege uebersprungen: ${skippedRecords.length}`,
      '',
      '-- Uebersprungen ------------------------------------------------',
      '',
    ];
    for (const record of skippedRecords) {
      const date = record.documentDate
        ? record.documentDate.toISOString().slice(0, 10)
        : '????-??-??';
      const corresp = record.correspondent ?? 'Unbekannt';
      const invNo = record.invoiceNumber ? `, Rechnungs-Nr ${record.invoiceNumber}` : '';
      lines.push(`${date}  ${corresp}${invNo}`);
      lines.push(`           Subject: ${record.title}`);
      lines.push(`           Grund:   ${record.reason}`);
      lines.push('');
    }
    zip.file('MANIFEST.txt', lines.join('\n'));
  }

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'STORE',
  });

  return { buffer, documentsAdded, skippedCount: skippedRecords.length };
};
