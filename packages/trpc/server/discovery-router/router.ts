// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors
import { EnvelopeType } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { AppError, AppErrorCode } from '@nexasign/lib/errors/app-error';
import { getDiscoveryReader, isDiscoveryConfigured } from '@nexasign/lib/server-only/discovery';
import { createEnvelope } from '@nexasign/lib/server-only/envelope/create-envelope';
import { getAbsoluteArchivePath } from '@nexasign/lib/server-only/sources/archive';
import { resyncSingleDocument } from '@nexasign/lib/server-only/sources/imap';
import { putNormalizedPdfFileServerSide } from '@nexasign/lib/universal/upload/put-file.server';
import { prisma } from '@nexasign/prisma';

import { authenticatedProcedure, router } from '../trpc';
import {
  ZCreateSigningDocumentRequestSchema,
  ZCreateSigningDocumentResponseSchema,
  ZFindDiscoveryDocumentsRequestSchema,
  ZFindDiscoveryDocumentsResponseSchema,
  ZGetDiscoveryDocumentRequestSchema,
  ZGetDiscoveryDocumentResponseSchema,
  ZGetDocumentDetailRequestSchema,
  ZGetDocumentDetailResponseSchema,
  ZResyncSingleDocumentRequestSchema,
  ZResyncSingleDocumentResponseSchema,
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

const getPrimaryPdfDocumentDataId = async (doc: {
  title: string;
  dataId: string | null;
  archivePath: string | null;
  artifacts: Array<{
    kind: string;
    relativePath: string;
    fileName: string;
    contentType: string;
  }>;
}): Promise<string> => {
  if (doc.dataId) {
    return doc.dataId;
  }

  const pdfArtifact = doc.artifacts.find(
    (artifact) =>
      artifact.kind === 'ATTACHMENT' &&
      (artifact.contentType === 'application/pdf' ||
        artifact.fileName.toLowerCase().endsWith('.pdf')),
  );

  if (!doc.archivePath || !pdfArtifact) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message:
        'Dieses Dokument hat noch keine PDF-Datei. Laden Sie zuerst die Mail erneut aus IMAP oder ziehen Sie den Beleg manuell.',
      statusCode: 400,
    });
  }

  const archiveDir = path.resolve(getAbsoluteArchivePath(doc.archivePath));
  const filePath = path.resolve(archiveDir, pdfArtifact.relativePath);

  if (!filePath.startsWith(`${archiveDir}${path.sep}`)) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'Ungültiger Archivpfad.',
      statusCode: 400,
    });
  }

  const bytes = await readFile(filePath);
  const data = await putNormalizedPdfFileServerSide({
    name: pdfArtifact.fileName || `${doc.title}.pdf`,
    type: 'application/pdf',
    arrayBuffer: async () =>
      Promise.resolve(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)),
  });

  return data.id;
};

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
        where: { userId: ctx.user.id, ...(ctx.teamId ? { teamId: ctx.teamId } : {}) },
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
          summary: null,
        };
      }

      const reader = getDiscoveryReader();
      const { teamId, user } = ctx;
      const { cursor, ...filter } = input;

      const discoveryContext = {
        teamId: teamId ?? undefined,
        userId: user.id,
      };

      const [page, summary] = await Promise.all([
        reader.findDocuments(filter, cursor ?? null, discoveryContext),
        reader.summarizeDocuments?.(filter, discoveryContext) ?? Promise.resolve(null),
      ]);

      return {
        documents: page.documents,
        total: page.total,
        nextCursor: page.nextCursor,
        configured: true,
        hasAnySource: sourceSummaries.length > 0,
        sources: sourceSummaries,
        summary,
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
      await prisma.$transaction(async (tx) => {
        // accept/archive setzen acceptedAt + acceptedById exakt einmal.
        // Wichtig für GoBD: Auch ein direkt archivierter Beleg ist damit
        // aufbewahrungspflichtig und landet im Exportfluss.
        const updateData: {
          status: typeof newStatus;
          acceptedAt?: Date;
          acceptedById?: number;
        } = { status: newStatus };
        const startsRetention =
          !doc.acceptedAt && (input.action === 'accept' || input.action === 'archive');
        if (startsRetention) {
          updateData.acceptedAt = new Date();
          updateData.acceptedById = user.id;
        }

        await tx.discoveryDocument.update({
          where: { id: doc.id },
          data: updateData,
        });

        const auditEvent =
          startsRetention && input.action === 'archive'
            ? 'DISCOVERY_DOCUMENT_ACCEPTED'
            : ACTION_AUDIT_MAP[input.action];

        if (auditEvent) {
          await tx.discoveryAuditLog.create({
            data: {
              event: auditEvent,
              discoveryDocumentId: doc.id,
              userId: user.id,
              teamId,
              metadata: {
                action: input.action,
                providerSource: doc.providerSource,
                retentionStarted: startsRetention,
              },
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

      // attachmentCount/hasArchive werden vom Listen-Schema verlangt; in der
      // Detail-Antwort spiegeln wir sie aus den realen Artifacts wider.
      const attachmentCount = doc.artifacts.filter((a) => a.kind === 'ATTACHMENT').length;
      const hasArchive =
        doc.archivePath !== null && doc.archivePath !== '' && doc.artifacts.length > 0;

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
          signingEnvelopeId: doc.signingEnvelopeId,
          canCreateSigningDocument:
            doc.dataId !== null ||
            doc.artifacts.some(
              (a) =>
                a.kind === 'ATTACHMENT' &&
                (a.contentType === 'application/pdf' || a.fileName.toLowerCase().endsWith('.pdf')),
            ),
          attachmentCount,
          hasArchive,
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

  createSigningDocument: authenticatedProcedure
    .input(ZCreateSigningDocumentRequestSchema)
    .output(ZCreateSigningDocumentResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId, user } = ctx;
      if (!teamId) {
        throw new AppError(AppErrorCode.UNAUTHORIZED, {
          message: 'Signatur-Vorbereitung braucht einen Team-Kontext.',
        });
      }

      const doc = await prisma.discoveryDocument.findFirst({
        where: {
          id: input.id,
          teamId,
          OR: [{ providerSource: 'local' }, { uploadedById: user.id }],
        },
        include: {
          artifacts: true,
          signingEnvelope: { select: { id: true } },
        },
      });

      if (!doc) {
        throw new AppError(AppErrorCode.NOT_FOUND, {
          message: 'Dokument nicht gefunden oder nicht änderbar.',
        });
      }

      if (doc.signingEnvelopeId) {
        if (!doc.acceptedAt || doc.status !== 'SIGNED') {
          await prisma.$transaction(async (tx) => {
            await tx.discoveryDocument.update({
              where: { id: doc.id },
              data: {
                status: doc.status === 'ARCHIVED' ? 'ARCHIVED' : 'SIGNED',
                acceptedAt: doc.acceptedAt ?? new Date(),
                acceptedById: doc.acceptedById ?? user.id,
              },
            });

            if (!doc.acceptedAt) {
              await tx.discoveryAuditLog.create({
                data: {
                  event: 'DISCOVERY_DOCUMENT_ACCEPTED',
                  discoveryDocumentId: doc.id,
                  userId: user.id,
                  teamId,
                  metadata: {
                    action: 'create-signing-document',
                    envelopeId: doc.signingEnvelopeId,
                    providerSource: doc.providerSource,
                    retentionStarted: true,
                  },
                },
              });
            }
          });
        }
        return { envelopeId: doc.signingEnvelopeId, alreadyExisted: true };
      }

      const documentDataId = await getPrimaryPdfDocumentDataId(doc);

      const envelope = await createEnvelope({
        userId: user.id,
        teamId,
        internalVersion: 1,
        normalizePdf: true,
        data: {
          type: EnvelopeType.DOCUMENT,
          title: doc.title,
          envelopeItems: [{ documentDataId }],
        },
        meta: {
          timezone: 'Europe/Berlin',
          distributionMethod: 'NONE',
        },
        bypassDefaultRecipients: true,
        requestMetadata: ctx.metadata,
      });

      await prisma.$transaction(async (tx) => {
        const startsRetention = !doc.acceptedAt;

        await tx.discoveryDocument.update({
          where: { id: doc.id },
          data: {
            signingEnvelopeId: envelope.id,
            status: doc.status === 'ARCHIVED' ? 'ARCHIVED' : 'SIGNED',
            acceptedAt: doc.acceptedAt ?? new Date(),
            acceptedById: doc.acceptedById ?? user.id,
          },
        });

        if (startsRetention) {
          await tx.discoveryAuditLog.create({
            data: {
              event: 'DISCOVERY_DOCUMENT_ACCEPTED',
              discoveryDocumentId: doc.id,
              userId: user.id,
              teamId,
              metadata: {
                action: 'create-signing-document',
                envelopeId: envelope.id,
                providerSource: doc.providerSource,
                retentionStarted: true,
              },
            },
          });
        }

        await tx.discoveryAuditLog.create({
          data: {
            event: 'DISCOVERY_SIGNING_DOCUMENT_CREATED',
            discoveryDocumentId: doc.id,
            userId: user.id,
            teamId,
            metadata: {
              action: 'create-signing-document',
              envelopeId: envelope.id,
            },
          },
        });
      });

      return { envelopeId: envelope.id, alreadyExisted: false };
    }),

  /**
   * Re-Sync einer einzelnen Mail aus IMAP — laedt Archive nach (eml + body +
   * attachments + metadata) fuer Belege, die vor Aktivierung des Archive-
   * Features importiert wurden. Idempotent — keine Duplikat-Documents,
   * kein Status-Verlust. User-Berechtigungs-Check liegt in resyncSingleDocument().
   */
  resyncSingle: authenticatedProcedure
    .input(ZResyncSingleDocumentRequestSchema)
    .output(ZResyncSingleDocumentResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId, user } = ctx;
      if (!teamId) {
        throw new AppError(AppErrorCode.UNAUTHORIZED, {
          message: 'Re-Sync braucht einen Team-Kontext.',
        });
      }
      return resyncSingleDocument({
        documentId: input.id,
        userId: user.id,
        teamId,
      });
    }),
});
