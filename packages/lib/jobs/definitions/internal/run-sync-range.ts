// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors

import { z } from 'zod';

import { type JobDefinition } from '../../client/_internal/job';

const RUN_SYNC_RANGE_JOB_DEFINITION_ID = 'internal.run-sync-range';

const RUN_SYNC_RANGE_JOB_DEFINITION_SCHEMA = z.object({
  syncRunId: z.string(),
});

export type TRunSyncRangeJobDefinition = z.infer<typeof RUN_SYNC_RANGE_JOB_DEFINITION_SCHEMA>;

/**
 * User-getriggerter Sync-Lauf über einen expliziten Zeitraum. Job lädt den
 * SyncRun-Record (enthält rangeFrom/rangeTo), dispatcht zum SourceAdapter und
 * schreibt Counter zurück. Cron-Auto-Sync existiert nicht — jeder Lauf wird
 * vom User in der UI ausgelöst.
 */
export const RUN_SYNC_RANGE_JOB_DEFINITION = {
  id: RUN_SYNC_RANGE_JOB_DEFINITION_ID,
  name: 'Run Sync Range',
  version: '1.0.0',
  optimizeParallelism: true,
  trigger: {
    name: RUN_SYNC_RANGE_JOB_DEFINITION_ID,
    schema: RUN_SYNC_RANGE_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./run-sync-range.handler');
    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof RUN_SYNC_RANGE_JOB_DEFINITION_ID,
  TRunSyncRangeJobDefinition
>;
