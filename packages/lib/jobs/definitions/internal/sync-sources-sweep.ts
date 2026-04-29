// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors
import { z } from 'zod';

import { type JobDefinition } from '../../client/_internal/job';

const SYNC_SOURCES_SWEEP_JOB_DEFINITION_ID = 'internal.sync-sources-sweep';

const SYNC_SOURCES_SWEEP_JOB_DEFINITION_SCHEMA = z.object({});

export type TSyncSourcesSweepJobDefinition = z.infer<
  typeof SYNC_SOURCES_SWEEP_JOB_DEFINITION_SCHEMA
>;

export const SYNC_SOURCES_SWEEP_JOB_DEFINITION = {
  id: SYNC_SOURCES_SWEEP_JOB_DEFINITION_ID,
  name: 'Sync Sources Sweep',
  version: '1.0.0',
  trigger: {
    name: SYNC_SOURCES_SWEEP_JOB_DEFINITION_ID,
    schema: SYNC_SOURCES_SWEEP_JOB_DEFINITION_SCHEMA,
    cron: '*/10 * * * *', // Every 10 minutes.
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./sync-sources-sweep.handler');
    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof SYNC_SOURCES_SWEEP_JOB_DEFINITION_ID,
  TSyncSourcesSweepJobDefinition
>;
