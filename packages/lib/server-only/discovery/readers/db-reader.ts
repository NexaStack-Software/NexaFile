// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors
import type {
  Prisma,
  DiscoveryDocumentStatus as PrismaDiscoveryDocumentStatus,
} from '@prisma/client';

import { AppError, AppErrorCode } from '@nexasign/lib/errors/app-error';
import { prisma } from '@nexasign/prisma';

import type {
  DiscoveryContext,
  DiscoveryDocument,
  DiscoveryDocumentStatus,
  DiscoveryFilter,
  DiscoveryPage,
  DiscoveryReader,
} from '../types';

/**
 * DB-Reader — Default-Reader, liest aus der `DiscoveryDocument`-Tabelle.
 *
 * Source-Adapter (IMAP, später Cloud) und der manuelle Intake-Upload schreiben
 * dort hinein; dieser Reader liest nur, kein Schreib-Pfad.
 *
 * Mehrtenant: jedes Dokument ist team-gebunden. Für IMAP-importierte Dokumente
 * gilt zusätzlich `uploadedById === ctx.userId` — User A sieht User Bs Belege
 * im selben Team nicht.
 */

const PAGE_SIZE = 25;

const NATIVE_TO_UI_STATUS: Record<string, DiscoveryDocumentStatus> = {
  INBOX: 'inbox',
  PENDING_MANUAL: 'pending-manual',
  ACCEPTED: 'accepted',
  SIGNED: 'accepted', // signed ist eine Spezialform von akzeptiert
  ARCHIVED: 'archived',
  IGNORED: 'ignored',
};

const UI_TO_NATIVE_STATUS: Record<DiscoveryDocumentStatus, PrismaDiscoveryDocumentStatus[]> = {
  inbox: ['INBOX'],
  'pending-manual': ['PENDING_MANUAL'],
  accepted: ['ACCEPTED', 'SIGNED'],
  archived: ['ARCHIVED'],
  ignored: ['IGNORED'],
  processed: ['ACCEPTED', 'SIGNED', 'ARCHIVED', 'IGNORED'],
};

const requireTeam = (ctx: DiscoveryContext | undefined): number => {
  if (!ctx?.teamId) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Discovery braucht einen Team-Kontext.',
    });
  }
  return ctx.teamId;
};

type DbDiscoveryDocument = {
  id: string;
  title: string;
  correspondent: string | null;
  documentType: string | null;
  documentDate: Date | null;
  capturedAt: Date;
  status: PrismaDiscoveryDocumentStatus;
  contentType: string | null;
  tags: string[];
  detectedAmount: string | null;
  detectedInvoiceNumber: string | null;
  acceptedAt: Date | null;
  acceptedBy: { name: string | null } | null;
};

const toDiscoveryDocument = (doc: DbDiscoveryDocument): DiscoveryDocument => ({
  id: doc.id,
  nativeId: doc.id,
  title: doc.title,
  correspondent: doc.correspondent,
  documentType: doc.documentType,
  tags: doc.tags,
  documentDate: doc.documentDate,
  capturedAt: doc.capturedAt,
  status: NATIVE_TO_UI_STATUS[doc.status] ?? 'inbox',
  detectedAmount: doc.detectedAmount,
  detectedInvoiceNumber: doc.detectedInvoiceNumber,
  acceptedAt: doc.acceptedAt,
  acceptedByName: doc.acceptedBy?.name ?? null,
});

const buildWhere = (
  teamId: number,
  userId: number | undefined,
  filter: DiscoveryFilter,
): Prisma.DiscoveryDocumentWhereInput => {
  const where: Prisma.DiscoveryDocumentWhereInput = { teamId };

  // Multi-User-Isolation: Belege aus IMAP-Quellen sind privat — nur ihr Owner
  // sieht sie. Lokale Uploads (providerSource = 'local') bleiben Team-sichtbar.
  if (userId !== undefined) {
    where.OR = [{ providerSource: 'local' }, { uploadedById: userId }];
  }

  if (filter.status) {
    where.status = { in: UI_TO_NATIVE_STATUS[filter.status] };
  }

  if (filter.query) {
    const text = filter.query;
    const textFilter = [
      { title: { contains: text, mode: 'insensitive' as const } },
      { correspondent: { contains: text, mode: 'insensitive' as const } },
    ];
    where.AND = [{ OR: textFilter }];
  }

  if (filter.correspondent) {
    where.correspondent = { contains: filter.correspondent, mode: 'insensitive' };
  }

  if (filter.documentDateFrom || filter.documentDateTo) {
    where.documentDate = {
      gte: filter.documentDateFrom,
      lt: filter.documentDateTo,
    };
  }

  return where;
};

export const dbDiscoveryReader: DiscoveryReader = {
  id: 'db',

  async findDocuments(
    filter: DiscoveryFilter,
    cursor?: string | null,
    ctx?: DiscoveryContext,
  ): Promise<DiscoveryPage> {
    const teamId = requireTeam(ctx);
    const where = buildWhere(teamId, ctx?.userId, filter);

    const [total, results] = await Promise.all([
      prisma.discoveryDocument.count({ where }),
      prisma.discoveryDocument.findMany({
        where,
        orderBy: { capturedAt: 'desc' },
        take: PAGE_SIZE + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: { acceptedBy: { select: { name: true } } },
      }),
    ]);

    const hasMore = results.length > PAGE_SIZE;
    const slice = hasMore ? results.slice(0, PAGE_SIZE) : results;

    return {
      documents: slice.map(toDiscoveryDocument),
      total,
      nextCursor: hasMore ? slice[slice.length - 1].id : null,
    };
  },

  async getDocument(id: string, ctx?: DiscoveryContext): Promise<DiscoveryDocument | null> {
    const teamId = requireTeam(ctx);
    const where = buildWhere(teamId, ctx?.userId, {});
    const doc = await prisma.discoveryDocument.findFirst({
      where: { ...where, id },
      include: { acceptedBy: { select: { name: true } } },
    });
    return doc ? toDiscoveryDocument(doc) : null;
  },

  async getDocumentContent(id: string, ctx?: DiscoveryContext): Promise<Uint8Array | null> {
    const teamId = requireTeam(ctx);
    const where = buildWhere(teamId, ctx?.userId, {});
    const doc = await prisma.discoveryDocument.findFirst({
      where: { ...where, id },
      include: { data: true },
    });
    if (!doc) return null;
    if (!doc.data) return null;

    // Speicher-Provider abstrahiert Binär-Inhalte als String (Base64 oder S3-Key).
    // Tatsächliches Streaming bleibt dem Storage-Layer überlassen.
    if (doc.data.type === 'BYTES_64') {
      const { base64 } = await import('@scure/base');
      return base64.decode(doc.data.data);
    }

    // S3_PATH: hier müsste der Storage-Provider den Stream liefern.
    // Für V1 kein direktes Bytes-Lesen aus S3 vom Reader aus.
    return null;
  },
};
