// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors
import { z } from 'zod';

import { type JobDefinition } from '../../client/_internal/job';

const SYNC_SOURCE_JOB_DEFINITION_ID = 'internal.sync-source';

const SYNC_SOURCE_JOB_DEFINITION_SCHEMA = z.object({
  sourceId: z.string(),
  triggeredBy: z.enum(['cron', 'manual']),
});

export type TSyncSourceJobDefinition = z.infer<typeof SYNC_SOURCE_JOB_DEFINITION_SCHEMA>;

export const SYNC_SOURCE_JOB_DEFINITION = {
  id: SYNC_SOURCE_JOB_DEFINITION_ID,
  name: 'Sync Source',
  version: '1.0.0',
  optimizeParallelism: true,
  trigger: {
    name: SYNC_SOURCE_JOB_DEFINITION_ID,
    schema: SYNC_SOURCE_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./sync-source.handler');
    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<typeof SYNC_SOURCE_JOB_DEFINITION_ID, TSyncSourceJobDefinition>;
