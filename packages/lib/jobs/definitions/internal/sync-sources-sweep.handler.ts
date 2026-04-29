// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors
import { DateTime } from 'luxon';

import { prisma } from '@nexasign/prisma';

import { jobs } from '../../client';
import type { JobRunIO } from '../../client/_internal/job';
import type { TSyncSourcesSweepJobDefinition } from './sync-sources-sweep';

const STALE_AFTER_MINUTES = 15;
const SOURCES_PER_SWEEP = 50;

/**
 * Sweep-Job — selektiert Sources, deren letzter Sync zu lange her ist, und
 * triggert pro Source einen `sync-source`-Job. SUSPENDED-Sources werden
 * übersprungen — sie brauchen einen manuellen Reactivate-Trigger.
 *
 * Fairness: Nach `lastSyncAttemptedAt` aufsteigend sortiert (NULLS first), dann
 * 50 Stück pro Lauf. Damit kommt ein neu angelegter Account schnell dran und
 * ein Account, der gerade läuft, blockiert nicht die anderen.
 */
export const run = async ({ io }: { payload: TSyncSourcesSweepJobDefinition; io: JobRunIO }) => {
  const now = DateTime.now();
  const cutoff = now.minus({ minutes: STALE_AFTER_MINUTES }).toJSDate();

  const sources = await prisma.source.findMany({
    where: {
      lastSyncStatus: { not: 'SUSPENDED' },
      OR: [{ lastSyncAttemptedAt: null }, { lastSyncAttemptedAt: { lt: cutoff } }],
      AND: [
        {
          OR: [{ syncLockUntil: null }, { syncLockUntil: { lt: now.toJSDate() } }],
        },
      ],
    },
    orderBy: [{ lastSyncAttemptedAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }],
    take: SOURCES_PER_SWEEP,
    select: { id: true },
  });

  if (sources.length === 0) {
    io.logger.info('No sources due for sync');
    return;
  }

  io.logger.info(`Triggering sync for ${sources.length} sources`);

  await Promise.allSettled(
    sources.map(async (source) =>
      jobs.triggerJob({
        name: 'internal.sync-source',
        payload: { sourceId: source.id, triggeredBy: 'cron' },
      }),
    ),
  );
};
