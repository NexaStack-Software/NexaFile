// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaFile contributors
import type { DiscoveryDocumentStatus, Prisma } from '@prisma/client';

import { getSession } from '@nexasign/auth/server/lib/utils/get-session';
import { getTeamByUrl } from '@nexasign/lib/server-only/team/get-team';
import { prisma } from '@nexasign/prisma';

import {
  MAX_DOCUMENTS_PER_ZIP,
  buildDiscoveryDocumentsZip,
  discoveryZipFileName,
} from '~/utils/discovery-export.server';

import type { Route } from './+types/find-documents.tax-package';

const UI_TO_NATIVE_STATUS: Record<string, DiscoveryDocumentStatus[]> = {
  inbox: ['INBOX'],
  'pending-manual': ['PENDING_MANUAL'],
  accepted: ['ACCEPTED', 'SIGNED'],
  archived: ['ARCHIVED'],
  ignored: ['IGNORED'],
  processed: ['ACCEPTED', 'SIGNED', 'ARCHIVED', 'IGNORED'],
};

const parseDate = (value: string | null): Date | undefined => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const appendAnd = (
  where: Prisma.DiscoveryDocumentWhereInput,
  condition: Prisma.DiscoveryDocumentWhereInput,
) => {
  const current = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
  where.AND = [...current, condition];
};

const intersectStatus = (
  left: DiscoveryDocumentStatus[] | undefined,
  right: DiscoveryDocumentStatus[],
): DiscoveryDocumentStatus[] => {
  if (!left) return right;
  return left.filter((status) => right.includes(status));
};

const setStatusWhere = (
  where: Prisma.DiscoveryDocumentWhereInput,
  statuses: DiscoveryDocumentStatus[],
) => {
  const current =
    typeof where.status === 'object' && 'in' in where.status && Array.isArray(where.status.in)
      ? where.status.in
      : undefined;
  where.status = { in: intersectStatus(current, statuses) };
};

const buildWhere = ({
  userId,
  teamId,
  url,
}: {
  userId: number;
  teamId: number;
  url: URL;
}): Prisma.DiscoveryDocumentWhereInput => {
  const where: Prisma.DiscoveryDocumentWhereInput = {
    teamId,
    OR: [{ providerSource: 'local' }, { uploadedById: userId }],
  };

  const status = url.searchParams.get('status');
  if (status && status !== 'all' && UI_TO_NATIVE_STATUS[status]) {
    setStatusWhere(where, UI_TO_NATIVE_STATUS[status]);
  }

  const query = url.searchParams.get('query')?.trim();
  if (query) {
    appendAnd(where, {
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { correspondent: { contains: query, mode: 'insensitive' } },
      ],
    });
  }

  const from = parseDate(url.searchParams.get('documentDateFrom'));
  const to = parseDate(url.searchParams.get('documentDateTo'));
  if (from || to) {
    where.documentDate = { gte: from, lt: to };
  }

  const qualityFilter = url.searchParams.get('qualityFilter');
  if (qualityFilter === 'needs-review') {
    setStatusWhere(where, ['INBOX', 'PENDING_MANUAL']);
  }
  if (qualityFilter === 'downloadable') {
    appendAnd(where, {
      archivePath: { not: null },
      artifacts: { some: { kind: 'ATTACHMENT' } },
    });
  }
  if (qualityFilter === 'missing-amount') {
    where.detectedAmount = null;
  }
  if (qualityFilter === 'missing-invoice-number') {
    where.detectedInvoiceNumber = null;
  }

  return where;
};

const formatDate = (date: Date | null): string => (date ? date.toISOString().slice(0, 10) : '');

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await getSession(request);
  const team = await getTeamByUrl({
    userId: user.id,
    teamUrl: params.teamUrl,
  });
  const url = new URL(request.url);
  const where = buildWhere({ userId: user.id, teamId: team.id, url });

  const documents = await prisma.discoveryDocument.findMany({
    where,
    select: {
      id: true,
      title: true,
      correspondent: true,
      documentDate: true,
      capturedAt: true,
      detectedAmount: true,
      detectedInvoiceNumber: true,
      status: true,
      archivePath: true,
      artifacts: {
        select: {
          kind: true,
          fileName: true,
          fileSize: true,
          relativePath: true,
        },
      },
    },
    orderBy: [{ documentDate: 'asc' }, { capturedAt: 'asc' }],
    take: MAX_DOCUMENTS_PER_ZIP + 1,
  });

  if (documents.length === 0) {
    throw new Response('Keine Belege fuer das Steuerpaket gefunden.', { status: 404 });
  }
  if (documents.length > MAX_DOCUMENTS_PER_ZIP) {
    throw new Response(`Zu viele Belege auf einmal (max ${MAX_DOCUMENTS_PER_ZIP}).`, {
      status: 400,
    });
  }

  const csvRows = [
    ['Datum', 'Korrespondent', 'Betreff', 'Betrag', 'Rechnungs-Nr', 'Status', 'Anhaenge'],
    ...documents.map((doc) => [
      formatDate(doc.documentDate ?? doc.capturedAt),
      doc.correspondent ?? '',
      doc.title,
      doc.detectedAmount ?? '',
      doc.detectedInvoiceNumber ?? '',
      doc.status,
      String(doc.artifacts.filter((artifact) => artifact.kind === 'ATTACHMENT').length),
    ]),
  ];

  const { buffer, documentsAdded } = await buildDiscoveryDocumentsZip({
    title: 'NexaFile Steuerpaket',
    documents,
    csvRows,
    csvFileName: 'uebersicht.csv',
  });

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Length': String(buffer.length),
      'Content-Disposition': `attachment; filename="${discoveryZipFileName('steuerpaket', documentsAdded)}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
