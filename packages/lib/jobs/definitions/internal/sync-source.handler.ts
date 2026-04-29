// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors
import { DateTime } from 'luxon';

import { prisma } from '@nexasign/prisma';

import { decryptImapConfig } from '../../../server-only/sources/imap';
import { getSourceAdapter } from '../../../server-only/sources/registry';
import type { JobRunIO } from '../../client/_internal/job';
import type { TSyncSourceJobDefinition } from './sync-source';

const SUSPEND_AFTER_FAILURES = 3;
const LOCK_DURATION_MINUTES = 10;

/**
 * Lädt die Source, dispatcht zum passenden Adapter, schreibt Sync-Status zurück.
 *
 * Ablauf:
 *   1. Source mit Lock-Stempel laden (`syncLockUntil` setzen). Wenn der Lock
 *      noch frisch ist, beendet der Job sofort — verhindert konkurrierende
 *      Sync-Läufe nach manuellem Trigger.
 *   2. Konfig entschlüsseln → Adapter holen → `sync()` aufrufen.
 *   3. Status updaten (SUCCESS / FAILED / SUSPENDED nach 3 Login-Fehlern).
 *   4. Audit-Log: Started + Completed/LoginFailed.
 */
export const run = async ({ payload, io }: { payload: TSyncSourceJobDefinition; io: JobRunIO }) => {
  const { sourceId } = payload;
  const now = DateTime.now();
  const lockUntil = now.plus({ minutes: LOCK_DURATION_MINUTES }).toJSDate();

  // Atomares Lock + Attempted-Stempel.
  const claim = await prisma.source.updateMany({
    where: {
      id: sourceId,
      OR: [{ syncLockUntil: null }, { syncLockUntil: { lt: now.toJSDate() } }],
    },
    data: {
      syncLockUntil: lockUntil,
      lastSyncAttemptedAt: now.toJSDate(),
    },
  });

  if (claim.count === 0) {
    io.logger.info(`Sync ${sourceId} skipped: lock active`);
    return;
  }

  const source = await prisma.source.findUnique({ where: { id: sourceId } });
  if (!source) {
    io.logger.warn(`Sync ${sourceId} skipped: source disappeared`);
    return;
  }

  if (source.lastSyncStatus === 'SUSPENDED') {
    io.logger.info(`Sync ${sourceId} skipped: SUSPENDED`);
    await prisma.source.update({
      where: { id: sourceId },
      data: { syncLockUntil: null },
    });
    return;
  }

  const adapter = getSourceAdapter(source.kind);
  if (!adapter) {
    io.logger.error(`No adapter registered for kind ${source.kind}`);
    await prisma.source.update({
      where: { id: sourceId },
      data: {
        syncLockUntil: null,
        lastSyncStatus: 'FAILED',
        lastSyncError: `Kein Adapter für Source-Typ "${source.kind}" registriert.`,
        consecutiveFailures: { increment: 1 },
      },
    });
    return;
  }

  await prisma.discoveryAuditLog.create({
    data: {
      event: 'IMAP_SYNC_STARTED',
      sourceId,
      userId: source.userId,
      metadata: { triggeredBy: payload.triggeredBy ?? 'cron' },
    },
  });

  let decryptedConfig: unknown;
  try {
    decryptedConfig = decryptImapConfig({
      ciphertext: source.encryptedConfig,
      keyVersion: source.encryptedConfigKeyVersion,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Konfig-Decrypt fehlgeschlagen';
    io.logger.error(`Sync ${sourceId} decrypt error: ${message}`);
    await prisma.source.update({
      where: { id: sourceId },
      data: {
        syncLockUntil: null,
        lastSyncStatus: 'FAILED',
        lastSyncError: message,
        consecutiveFailures: { increment: 1 },
      },
    });
    return;
  }

  // Team-Zuordnung kommt aus der Source selbst — User hat sie beim Anlegen
  // gewählt. Verhindert Belege im falschen Team bei Multi-Team-Mitgliedschaft.
  const teamId = source.teamId;

  let result;
  try {
    result = await adapter.sync({
      sourceId,
      userId: source.userId,
      teamId,
      since: source.lastSyncAt,
      decryptedConfig,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const newFailures = source.consecutiveFailures + 1;
    const shouldSuspend = newFailures >= SUSPEND_AFTER_FAILURES;

    await prisma.$transaction([
      prisma.source.update({
        where: { id: sourceId },
        data: {
          syncLockUntil: null,
          lastSyncStatus: shouldSuspend ? 'SUSPENDED' : 'FAILED',
          lastSyncError: message,
          consecutiveFailures: newFailures,
        },
      }),
      prisma.discoveryAuditLog.create({
        data: {
          event: 'IMAP_SYNC_LOGIN_FAILED',
          sourceId,
          userId: source.userId,
          metadata: { error: message, suspended: shouldSuspend },
        },
      }),
    ]);
    return;
  }

  // Adapter darf result.failed > 0 melden, ohne dass Suspend greift — das wäre
  // pro-Mail-Fail, nicht ein Login-Problem.
  await prisma.$transaction([
    prisma.source.update({
      where: { id: sourceId },
      data: {
        syncLockUntil: null,
        lastSyncAt: new Date(),
        lastSyncStatus: 'SUCCESS',
        lastSyncError: null,
        consecutiveFailures: 0,
      },
    }),
    prisma.discoveryAuditLog.create({
      data: {
        event: 'IMAP_SYNC_COMPLETED',
        sourceId,
        userId: source.userId,
        teamId,
        metadata: {
          imported: result.imported,
          failed: result.failed,
          errors: result.errors ?? [],
        },
      },
    }),
  ]);
};
