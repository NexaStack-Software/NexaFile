// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors

export { getSourceAdapter, listRegisteredKinds, registerSourceAdapter } from './registry';
export type {
  SourceAdapter,
  SyncRangeContext,
  SyncRangeProgress,
  SyncRangeResult,
  TestConnectionInput,
  TestConnectionResult,
} from './types';
