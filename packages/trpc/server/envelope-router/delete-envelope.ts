import { DocumentStatus, EnvelopeType } from '@prisma/client';
import { match } from 'ts-pattern';

import { AppError, AppErrorCode } from '@nexasign/lib/errors/app-error';
import { deleteDocument } from '@nexasign/lib/server-only/document/delete-document';
import { deleteTemplate } from '@nexasign/lib/server-only/template/delete-template';
import { prisma } from '@nexasign/prisma';

import { ZGenericSuccessResponse } from '../schema';
import { authenticatedProcedure } from '../trpc';
import {
  ZDeleteEnvelopeRequestSchema,
  ZDeleteEnvelopeResponseSchema,
  deleteEnvelopeMeta,
} from './delete-envelope.types';

/**
 * NexaSign — WORM-Strict-Mode (Opt-in).
 *
 * NexaSign selbst verhindert bereits das *physische* Löschen von COMPLETED-Dokumenten
 * (siehe `delete-document.ts`: Soft-Delete via `deletedAt`, zusätzlich SQL-Guard
 * `status: { not: COMPLETED }` beim Hard-Delete). Für die reguläre GoBD-Aufbewahrung
 * ist das hinreichend — die Datensätze bleiben in der DB, werden nur für den Sender
 * ausgeblendet; das Export-Tool (`nexasign-gobd-export`) findet sie weiter.
 *
 * Mit NEXASIGN_WORM_STRICT=true lässt sich zusätzlich auch das *Ausblenden*
 * (Soft-Delete, `deletedAt`) sperren — für Buchhaltungs-Umgebungen, die das
 * COMPLETED-Dokument auch in der Sender-UI zwingend sichtbar lassen wollen.
 * Betrifft nur DOCUMENT-Typ; Templates sind keine steuerrelevanten Belege.
 */
const NEXASIGN_WORM_STRICT = process.env.NEXASIGN_WORM_STRICT === 'true';

export const deleteEnvelopeRoute = authenticatedProcedure
  .meta(deleteEnvelopeMeta)
  .input(ZDeleteEnvelopeRequestSchema)
  .output(ZDeleteEnvelopeResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId } = ctx;
    const { envelopeId } = input;

    ctx.logger.info({
      input: {
        envelopeId,
      },
    });

    const unsafeEnvelope = await prisma.envelope.findUnique({
      where: {
        id: envelopeId,
      },
      select: {
        type: true,
        status: true,
      },
    });

    if (!unsafeEnvelope) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Envelope not found',
      });
    }

    // WORM-Strict-Mode: nur aktiv wenn NEXASIGN_WORM_STRICT=true gesetzt.
    // Default-Fall (NexaSign-Verhalten) kümmert sich um das physische Löschen via
    // delete-document.ts (Soft-Delete bei COMPLETED). Strict-Mode sperrt zusätzlich
    // das Ausblenden für den Sender — z. B. für Buchhaltungen, die das COMPLETED-
    // Dokument auch in der Sender-UI dauerhaft sichtbar lassen wollen.
    if (
      NEXASIGN_WORM_STRICT &&
      unsafeEnvelope.type === EnvelopeType.DOCUMENT &&
      unsafeEnvelope.status === DocumentStatus.COMPLETED
    ) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message:
          'Dieses Dokument ist abgeschlossen signiert und unterliegt der 10-jährigen Aufbewahrungspflicht nach § 147 AO / § 257 HGB (GoBD). Auch das Ausblenden ist im strikten WORM-Modus systemseitig gesperrt — bitte direkt archivieren. (NEXASIGN_WORM_STRICT)',
      });
    }

    await match(unsafeEnvelope.type)
      .with(EnvelopeType.DOCUMENT, async () =>
        deleteDocument({
          userId: ctx.user.id,
          teamId,
          id: {
            type: 'envelopeId',
            id: envelopeId,
          },
          requestMetadata: ctx.metadata,
        }),
      )
      .with(EnvelopeType.TEMPLATE, async () =>
        deleteTemplate({
          userId: ctx.user.id,
          teamId,
          id: {
            type: 'envelopeId',
            id: envelopeId,
          },
        }),
      )
      .exhaustive();

    return ZGenericSuccessResponse;
  });
