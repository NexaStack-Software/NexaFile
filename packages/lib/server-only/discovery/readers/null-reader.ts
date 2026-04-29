// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors
import type { DiscoveryContext, DiscoveryFilter, DiscoveryPage, DiscoveryReader } from '../types';

/**
 * Stub-Reader — wird nur explizit aktiviert, wenn ein Setup absichtlich kein
 * Discovery-Backend hat. In allen anderen Fällen ist der DB-Reader der Default.
 */
export const nullDiscoveryReader: DiscoveryReader = {
  id: 'null',

  async findDocuments(
    _filter: DiscoveryFilter,
    _cursor?: string | null,
    _ctx?: DiscoveryContext,
  ): Promise<DiscoveryPage> {
    return Promise.resolve({ documents: [], total: 0, nextCursor: null });
  },

  async getDocument(_id: string, _ctx?: DiscoveryContext) {
    return Promise.resolve(null);
  },

  async getDocumentContent(_id: string, _ctx?: DiscoveryContext) {
    return Promise.resolve(null);
  },
};
