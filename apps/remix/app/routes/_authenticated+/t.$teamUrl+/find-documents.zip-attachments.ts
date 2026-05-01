// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors
//
// ZIP-Sammel-Download für ein oder mehrere DiscoveryDocuments.
//
// Endpoint:  GET /t/<teamUrl>/find-documents/zip-attachments?ids=<id>,<id>,…
// Response:  application/zip mit folgendem Layout:
//   <YYYY-MM-DD>_<correspondent>_<title-or-invoice>/
//     mail.eml                  ← Original-Mail (immer)
//     <originaler-anhang-1.pdf>
//     <originaler-anhang-2.pdf>
//     …
//
// Pro Document genau ein Ordner. Anhänge UND .eml gehen rein. Interne Artifacts
// (MAIL_BODY_HTML, MAIL_METADATA, MAIL_BODY_TEXT) werden bewusst NICHT gepackt —
// die sind App-intern und sollen den Beleg-Export nicht zumüllen.
//
// Sicherheits-Checks identisch zu find-documents.$id.artifacts.$artifactId.ts:
//   - Session erforderlich
//   - DiscoveryDocument muss zum Team gehören
//   - Document.providerSource === 'local' ODER uploadedById === user.id
//   - Pfad-Traversal-Schutz: Artifact-Pfade müssen unter Archive-Dir liegen
import JSZip from 'jszip';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { getSession } from '@nexasign/auth/server/lib/utils/get-session';
import { getAbsoluteArchivePath } from '@nexasign/lib/server-only/sources/archive';
import { getTeamByUrl } from '@nexasign/lib/server-only/team/get-team';
import { prisma } from '@nexasign/prisma';

import type { Route } from './+types/find-documents.zip-attachments';

const MAX_DOCUMENTS_PER_ZIP = 100;
const MAX_TOTAL_BYTES = 200 * 1024 * 1024; // 200 MB Hard-Limit pro ZIP-Request

/**
 * Macht aus einem freien String einen filesystem-sicheren, kompakten Slug.
 * - lower-case-conversion bleibt aus, weil Markennamen (Anthropic, NetCup) lesbar bleiben sollen
 * - alle Zeichen außer ASCII-Buchstaben/Ziffern/-/_ → unterstrich
 * - Mehrfach-Unterstriche → einer
 * - Trim auf 60 Zeichen
 */
const slugify = (raw: string | null | undefined, fallback: string): string => {
  const source = (raw ?? '').trim();
  if (source.length === 0) {
    return fallback;
  }
  const replaced = source
    .normalize('NFKD')
    // Diakritika weg (ä → a, ß → ss bekommen wir hier nicht 100%, akzeptabel)
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '');
  if (replaced.length === 0) return fallback;
  return replaced.length > 60 ? replaced.slice(0, 60) : replaced;
};

/**
 * Folder-Prefix für einen Beleg im ZIP.
 *  Format:  YYYY-MM-DD_<correspondent>_<invoiceNumber-oder-title>
 *  Beispiel: 2026-03-03_Anthropic_PBC_2957-1184-4954
 *
 *  Sortiert sich von selbst chronologisch beim Browser-Auspacken (Datum vorn).
 */
const buildFolderName = (doc: {
  documentDate: Date | null;
  capturedAt: Date;
  correspondent: string | null;
  detectedInvoiceNumber: string | null;
  title: string;
  id: string;
}): string => {
  const date = doc.documentDate ?? doc.capturedAt;
  const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD
  const correspondent = slugify(doc.correspondent, 'Unbekannt');
  // Invoice-Nr bevorzugen — die ist eindeutiger als der Mail-Subject.
  const tail = slugify(doc.detectedInvoiceNumber ?? doc.title, doc.id.slice(0, 8));
  return `${dateStr}_${correspondent}_${tail}`;
};

/**
 * Stellt sicher, dass im ZIP keine zwei Documents im selben Ordner landen.
 * Falls `buildFolderName` für zwei Belege denselben String liefert (z. B. zwei
 * Mails am gleichen Tag vom gleichen Sender ohne Invoice-Nr), wird ein
 * Disambig-Suffix `_2`, `_3`, … angehängt.
 */
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

/**
 * Liest eine Datei aus dem Archive-Ordner, mit Pfad-Traversal-Schutz.
 * Liefert null, wenn die Datei fehlt oder ausserhalb des Archive-Pfads liegt.
 */
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

const zipFileName = (count: number): string => {
  const today = new Date().toISOString().slice(0, 10);
  if (count === 1) return `belege-${today}.zip`;
  return `belege-${today}_${count}.zip`;
};

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await getSession(request);
  const team = await getTeamByUrl({
    userId: user.id,
    teamUrl: params.teamUrl,
  });

  const url = new URL(request.url);
  const idsRaw = url.searchParams.get('ids') ?? '';
  const ids = idsRaw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (ids.length === 0) {
    throw new Response('Keine Belege ausgewählt.', { status: 400 });
  }
  if (ids.length > MAX_DOCUMENTS_PER_ZIP) {
    throw new Response(`Zu viele Belege auf einmal (max ${MAX_DOCUMENTS_PER_ZIP}).`, {
      status: 400,
    });
  }

  // Ein Query holt alle Documents — Authorization-Check inline (Team + Owner).
  // Reihenfolge: documentDate aufsteigend, damit der ZIP chronologisch ist.
  const documents = await prisma.discoveryDocument.findMany({
    where: {
      id: { in: ids },
      teamId: team.id,
      OR: [{ providerSource: 'local' }, { uploadedById: user.id }],
    },
    select: {
      id: true,
      title: true,
      correspondent: true,
      documentDate: true,
      capturedAt: true,
      detectedInvoiceNumber: true,
      archivePath: true,
      artifacts: {
        select: {
          id: true,
          kind: true,
          fileName: true,
          contentType: true,
          fileSize: true,
          relativePath: true,
        },
      },
    },
    orderBy: [{ documentDate: 'asc' }, { capturedAt: 'asc' }],
  });

  if (documents.length === 0) {
    throw new Response('Keine zugreifbaren Belege gefunden.', { status: 404 });
  }

  const zip = new JSZip();
  const usedFolderNames = new Set<string>();
  let totalBytes = 0;
  let documentsAdded = 0;
  // Sammelt Belege ohne ladbares Archiv — landen am Ende als MANIFEST.txt
  // im ZIP, damit der User sieht, was uebersprungen wurde und warum.
  const skippedRecords: Array<{
    title: string;
    correspondent: string | null;
    documentDate: Date | null;
    invoiceNumber: string | null;
    reason: string;
  }> = [];

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

    const folderBase = buildFolderName({
      documentDate: doc.documentDate,
      capturedAt: doc.capturedAt,
      correspondent: doc.correspondent,
      detectedInvoiceNumber: doc.detectedInvoiceNumber,
      title: doc.title,
      id: doc.id,
    });
    const folderName = uniquify(folderBase, usedFolderNames);

    // Nur Anhänge + .eml in den ZIP — interne Artifacts (HTML, Body-Text,
    // Metadata) bleiben App-internes Audit-Material und gehen NICHT mit.
    const wanted = doc.artifacts.filter(
      (art) => art.kind === 'ATTACHMENT' || art.kind === 'MAIL_EML',
    );

    let documentHadFile = false;
    for (const art of wanted) {
      if (totalBytes + art.fileSize > MAX_TOTAL_BYTES) {
        throw new Response(
          `ZIP-Größenlimit überschritten (${Math.round(MAX_TOTAL_BYTES / 1024 / 1024)} MB).`,
          { status: 413 },
        );
      }
      const bytes = await readArtifactFile(doc.archivePath, art.relativePath);
      if (!bytes) continue;
      // .eml landet als „mail.eml" im Ordner — egal wie das Original-Artefakt heisst.
      const fileNameInZip = art.kind === 'MAIL_EML' ? 'mail.eml' : art.fileName;
      zip.file(`${folderName}/${fileNameInZip}`, bytes);
      totalBytes += bytes.length;
      documentHadFile = true;
    }

    if (documentHadFile) {
      documentsAdded += 1;
    } else {
      // archivePath gesetzt, aber Files fehlen physisch (Disk-Loss?).
      skippedRecords.push({
        title: doc.title,
        correspondent: doc.correspondent,
        documentDate: doc.documentDate,
        invoiceNumber: doc.detectedInvoiceNumber,
        reason: `archivePath gesetzt, aber keine Datei lesbar unter ${doc.archivePath}.`,
      });
    }
  }

  // Manifest mitliefern, wenn überhaupt was uebersprungen wurde — egal ob
  // alles oder nur ein Teil. So bekommt der User ein vollstaendiges Bild.
  if (skippedRecords.length > 0) {
    const today = new Date().toISOString().slice(0, 10);
    const lines = [
      `NexaFile — ZIP-Export ${today}`,
      `Belege ausgewaehlt: ${documents.length}`,
      `Belege im ZIP enthalten: ${documentsAdded}`,
      `Belege uebersprungen: ${skippedRecords.length}`,
      '',
      '── Uebersprungen ─────────────────────────────────────────────',
      '',
    ];
    for (const r of skippedRecords) {
      const date = r.documentDate ? r.documentDate.toISOString().slice(0, 10) : '????-??-??';
      const corresp = r.correspondent ?? 'Unbekannt';
      const invNo = r.invoiceNumber ? `, Rechnungs-Nr ${r.invoiceNumber}` : '';
      lines.push(`${date}  ${corresp}${invNo}`);
      lines.push(`           Subject: ${r.title}`);
      lines.push(`           Grund:   ${r.reason}`);
      lines.push('');
    }
    zip.file('MANIFEST.txt', lines.join('\n'));
  }

  if (documentsAdded === 0 && skippedRecords.length === 0) {
    // Sollte nicht passieren — defensives Fallback.
    throw new Response('Keine zugreifbaren Belege gefunden.', { status: 404 });
  }

  // STORE = keine Komprimierung. PDFs/Images sind bereits komprimiert,
  // DEFLATE bringt kaum etwas und kostet CPU+Latenz im Request-Handler.
  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'STORE',
  });

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Length': String(buffer.length),
      'Content-Disposition': `attachment; filename="${zipFileName(documentsAdded)}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
