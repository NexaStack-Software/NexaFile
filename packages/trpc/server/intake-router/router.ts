// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors
import { base64 } from '@scure/base';

import { AppError, AppErrorCode } from '@nexasign/lib/errors/app-error';
import { uploadIntakeDocument } from '@nexasign/lib/server-only/intake';

import { authenticatedProcedure, router } from '../trpc';
import { ZUploadIntakeDocumentRequestSchema, ZUploadIntakeDocumentResponseSchema } from './schema';

/**
 * Intake-Router — Park-Pfad für manuellen Upload.
 *
 * In Schritt 1 des Lifecycles („Dokumente finden") gehört kein Upload, weil
 * Upload-Aktivität semantisch ein „Erstellen/Ablegen"-Schritt ist. Der
 * Mutation-Endpoint ist hier vorbereitet und ans gleiche `DiscoveryDocument`-
 * Storage angebunden, sodass Schritt 2 des Lifecycles ihn unverändert
 * benutzen kann sobald die UI dafür existiert.
 */
export const intakeRouter = router({
  uploadDocument: authenticatedProcedure
    .input(ZUploadIntakeDocumentRequestSchema)
    .output(ZUploadIntakeDocumentResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId, user } = ctx;
      if (!teamId) {
        throw new AppError(AppErrorCode.UNAUTHORIZED, {
          message: 'Upload braucht einen Team-Kontext.',
        });
      }

      const bytes = base64.decode(input.base64);

      const created = await uploadIntakeDocument({
        teamId,
        userId: user.id,
        fileName: input.fileName,
        contentType: input.contentType,
        bytes,
      });

      return {
        id: created.id,
        nativeId: created.id,
        title: created.title,
        correspondent: created.correspondent,
        documentType: created.documentType,
        tags: created.tags,
        documentDate: created.documentDate,
        capturedAt: created.capturedAt,
        status: 'inbox' as const,
        // Lokal hochgeladene Belege haben ihre Bytes direkt in `DocumentData`
        // (nicht im IMAP-Archive). Für die Listen-/UI-Logik zaehlen wir das
        // als "ein Anhang verfügbar", auch wenn es kein DiscoveryArtifact-Record
        // ist — der Download lauft hier nicht ueber das ZIP-Endpoint.
        attachmentCount: 1,
        hasArchive: true,
      };
    }),
});
