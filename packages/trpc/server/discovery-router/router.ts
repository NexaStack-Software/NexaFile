// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors
import { AppError, AppErrorCode } from '@nexasign/lib/errors/app-error';
import { getDiscoveryReader, isDiscoveryConfigured } from '@nexasign/lib/server-only/discovery';
import { prisma } from '@nexasign/prisma';

import { authenticatedProcedure, router } from '../trpc';
import {
  ZFindDiscoveryDocumentsRequestSchema,
  ZFindDiscoveryDocumentsResponseSchema,
  ZGetDiscoveryDocumentRequestSchema,
  ZGetDiscoveryDocumentResponseSchema,
  ZUpdateDiscoveryDocumentStatusRequestSchema,
  ZUpdateDiscoveryDocumentStatusResponseSchema,
} from './schema';

const ACTION_STATUS_MAP = {
  accept: 'ACCEPTED',
  'mark-pending-manual': 'PENDING_MANUAL',
  archive: 'ARCHIVED',
  ignore: 'IGNORED',
} as const;

const ACTION_AUDIT_MAP = {
  accept: 'DISCOVERY_DOCUMENT_ACCEPTED',
  'mark-pending-manual': null,
  archive: null,
  ignore: 'DISCOVERY_DOCUMENT_IGNORED',
} as const;

export const discoveryRouter = router({
  /**
   * Liste der gefundenen Dokumente für das aktive Team und den aktiven User.
   * Reader-Wahl passiert serverseitig anhand der Environment-Konfiguration.
   *
   * Antwort enthält zusätzlich die Source-Liste des aktuellen Users (pro User
   * konfiguriert, nicht pro Team), damit das UI Empty-State-Logik und
   * Sync-Status anzeigen kann.
   */
  findDocuments: authenticatedProcedure
    .input(ZFindDiscoveryDocumentsRequestSchema)
    .output(ZFindDiscoveryDocumentsResponseSchema)
    .query(async ({ input, ctx }) => {
      const configured = isDiscoveryConfigured();

      const sources = await prisma.source.findMany({
        where: { userId: ctx.user.id },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          kind: true,
          label: true,
          lastSyncAt: true,
          lastSyncStatus: true,
        },
      });

      const sourceSummaries = sources.map((source) => ({
        id: source.id,
        kind: source.kind,
        label: source.label,
        lastSyncAt: source.lastSyncAt,
        lastSyncStatus: source.lastSyncStatus,
      }));

      if (!configured) {
        return {
          documents: [],
          total: 0,
          nextCursor: null,
          configured: false,
          hasAnySource: sourceSummaries.length > 0,
          sources: sourceSummaries,
        };
      }

      const reader = getDiscoveryReader();
      const { teamId, user } = ctx;
      const { cursor, ...filter } = input;

      const page = await reader.findDocuments(filter, cursor ?? null, {
        teamId: teamId ?? undefined,
        userId: user.id,
      });

      return {
        documents: page.documents,
        total: page.total,
        nextCursor: page.nextCursor,
        configured: true,
        hasAnySource: sourceSummaries.length > 0,
        sources: sourceSummaries,
      };
    }),

  getDocument: authenticatedProcedure
    .input(ZGetDiscoveryDocumentRequestSchema)
    .output(ZGetDiscoveryDocumentResponseSchema)
    .query(async ({ input, ctx }) => {
      if (!isDiscoveryConfigured()) {
        return null;
      }
      const reader = getDiscoveryReader();
      const { teamId, user } = ctx;
      return reader.getDocument(input.id, {
        teamId: teamId ?? undefined,
        userId: user.id,
      });
    }),

  /**
   * Status-Aktionen auf einem DiscoveryDocument: accept / archive / ignore /
   * mark-pending-manual. Auth-Modell: Team-Member darf lokale Uploads ändern,
   * eigene IMAP-Belege ändern. Fremde IMAP-Belege bleiben unsichtbar (siehe
   * db-reader.buildWhere) und damit auch unveränderbar.
   */
  updateStatus: authenticatedProcedure
    .input(ZUpdateDiscoveryDocumentStatusRequestSchema)
    .output(ZUpdateDiscoveryDocumentStatusResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId, user } = ctx;
      if (!teamId) {
        throw new AppError(AppErrorCode.UNAUTHORIZED, {
          message: 'Aktion braucht einen Team-Kontext.',
        });
      }

      const doc = await prisma.discoveryDocument.findFirst({
        where: {
          id: input.id,
          teamId,
          OR: [{ providerSource: 'local' }, { uploadedById: user.id }],
        },
        select: { id: true, providerSource: true },
      });
      if (!doc) {
        throw new AppError(AppErrorCode.NOT_FOUND, {
          message: 'Dokument nicht gefunden oder nicht änderbar.',
        });
      }

      const newStatus = ACTION_STATUS_MAP[input.action];
      const auditEvent = ACTION_AUDIT_MAP[input.action];

      await prisma.$transaction(async (tx) => {
        await tx.discoveryDocument.update({
          where: { id: doc.id },
          data: { status: newStatus },
        });

        if (auditEvent) {
          await tx.discoveryAuditLog.create({
            data: {
              event: auditEvent,
              discoveryDocumentId: doc.id,
              userId: user.id,
              teamId,
              metadata: { action: input.action, providerSource: doc.providerSource },
            },
          });
        }
      });
      return { ok: true };
    }),
});
