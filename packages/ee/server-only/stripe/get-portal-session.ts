// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors. Stub — Stripe-Billing deaktiviert.
import { notAvailable } from '../_not-available';

export type GetPortalSessionOptions = { customerId: string; returnUrl?: string };

export const getPortalSession = async (_options: GetPortalSessionOptions): Promise<string> => {
  throw notAvailable('getPortalSession (Stripe)');
};
