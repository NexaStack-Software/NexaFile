// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors
import { AppError, AppErrorCode } from '@nexasign/lib/errors/app-error';
import { getDiscoveryReader, isDiscoveryConfigured } from '@nexasign/lib/server-only/discovery';
import { getAbsoluteArchivePath } from '@nexasign/lib/server-only/sources/archive';
import { prisma } from '@nexasign/prisma';

import { authenticatedProcedure, router } from '../trpc';
import {
  ZFindDiscoveryDocumentsRequestSchema,
  ZFindDiscoveryDocumentsResponseSchema,
  ZGetDiscoveryDocumentRequestSchema,
  ZGetDiscoveryDocumentResponseSchema,
  ZGetDocumentDetailRequestSchema,
  ZGetDocumentDetailResponseSchema,
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
   *
   * WORM-Regel: ab `acceptedAt != null` (User hat den Beleg als Geschäftsbeleg
   * akzeptiert) sind nur noch ACCEPTED → ARCHIVED erlaubt. Reverse zu INBOX
   * oder IGNORED ist gesperrt — GoBD-Aufbewahrung.
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
        select: { id: true, providerSource: true, status: true, acceptedAt: true },
      });
      if (!doc) {
        throw new AppError(AppErrorCode.NOT_FOUND, {
          message: 'Dokument nicht gefunden oder nicht änderbar.',
        });
      }

      // WORM-Guard: nach Accept nur noch Archivieren erlaubt.
      if (doc.acceptedAt && input.action !== 'archive') {
        throw new AppError(AppErrorCode.UNAUTHORIZED, {
          message:
            'Dieses Dokument ist als Geschäftsbeleg akzeptiert und unterliegt der ' +
            '10-jährigen Aufbewahrung (§ 147 AO / § 257 HGB). Es kann nur noch ' +
            'archiviert, aber nicht zurückgesetzt oder ignoriert werden.',
        });
      }

      const newStatus = ACTION_STATUS_MAP[input.action];
      const auditEvent = ACTION_AUDIT_MAP[input.action];

      await prisma.$transaction(async (tx) => {
        // accept setzt acceptedAt + acceptedById exakt einmal — Re-Accept
        // (ARCHIVED → ACCEPTED ist eh blockiert, also nur Erst-Accept relevant).
        const updateData: {
          status: typeof newStatus;
          acceptedAt?: Date;
          acceptedById?: number;
        } = { status: newStatus };
        if (input.action === 'accept' && !doc.acceptedAt) {
          updateData.acceptedAt = new Date();
          updateData.acceptedById = user.id;
        }

        await tx.discoveryDocument.update({
          where: { id: doc.id },
          data: updateData,
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

  /**
   * Detail-Daten für die Beleg-Detailseite. Liefert Document + alle Artifacts
   * (Mail, Body, Anhänge mit sha256), absoluter Server-Pfad fürs FTP-Reingucken,
   * Gmail-Deep-Link für IMAP-Belege.
   */
  getDocumentDetail: authenticatedProcedure
    .input(ZGetDocumentDetailRequestSchema)
    .output(ZGetDocumentDetailResponseSchema)
    .query(async ({ input, ctx }) => {
      const { teamId, user } = ctx;
      if (!teamId) return null;

      const doc = await prisma.discoveryDocument.findFirst({
        where: {
          id: input.id,
          teamId,
          OR: [{ providerSource: 'local' }, { uploadedById: user.id }],
        },
        include: {
          artifacts: { orderBy: { kind: 'asc' } },
          source: { select: { label: true, kind: true } },
          acceptedBy: { select: { name: true } },
        },
      });
      if (!doc) return null;

      const uiStatus =
        doc.status === 'INBOX'
          ? ('inbox' as const)
          : doc.status === 'PENDING_MANUAL'
            ? ('pending-manual' as const)
            : ('processed' as const);

      // Gmail-Deep-Link: nur für IMAP-Belege mit Gmail-Source und messageId.
      // Format: https://mail.google.com/mail/u/0/#search/rfc822msgid:<messageId>
      // Wir haben nur den Hash gespeichert, nicht die Original-messageId — also
      // gibt's hier keinen Direkt-Link. Pragmatisch: Search nach Subject.
      const gmailDeepLink =
        doc.providerSource === 'imap' && doc.source?.kind === 'IMAP' && doc.title
          ? `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(doc.title)}`
          : null;

      return {
        document: {
          id: doc.id,
          nativeId: doc.id,
          title: doc.title,
          correspondent: doc.correspondent,
          documentType: doc.documentType,
          tags: doc.tags,
          documentDate: doc.documentDate,
          capturedAt: doc.capturedAt,
          status: uiStatus,
          bodyText: doc.bodyText,
          bodyHasHtml: doc.bodyHasHtml,
          archivePath: doc.archivePath,
          detectedAmount: doc.detectedAmount,
          detectedInvoiceNumber: doc.detectedInvoiceNumber,
          portalHint: doc.portalHint,
          messageIdHash: doc.messageIdHash,
          providerSource: doc.providerSource,
          providerNativeId: doc.providerNativeId,
          acceptedAt: doc.acceptedAt,
          acceptedByName: doc.acceptedBy?.name ?? null,
          sourceLabel: doc.source?.label ?? null,
        },
        artifacts: doc.artifacts.map((a) => ({
          id: a.id,
          kind: a.kind,
          fileName: a.fileName,
          contentType: a.contentType,
          fileSize: a.fileSize,
          sha256: a.sha256,
          relativePath: a.relativePath,
        })),
        absoluteArchivePath: doc.archivePath ? getAbsoluteArchivePath(doc.archivePath) : null,
        gmailDeepLink,
      };
    }),
});
