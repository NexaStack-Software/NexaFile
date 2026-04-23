// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors. Stub — Stripe-Billing deaktiviert.
import type Stripe from 'stripe';

import { notAvailable } from '../_not-available';

export type CreateCheckoutSessionOptions = {
  customerId: string;
  priceId: string;
  returnUrl: string;
  subscriptionMetadata?: Stripe.Metadata;
};

export const createCheckoutSession = async (
  _options: CreateCheckoutSessionOptions,
): Promise<string> => {
  throw notAvailable('createCheckoutSession (Stripe)');
};
