// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors. Stub — wird vom Handler nie aufgerufen.
import type { Stripe } from '@nexasign/lib/server-only/stripe';

export type OnSubscriptionUpdatedOptions = {
  subscription: Stripe.Subscription;
  previousAttributes: Partial<Stripe.Subscription> | null;
};

export const onSubscriptionUpdated = async (_options: OnSubscriptionUpdatedOptions) => undefined;

export const extractStripeClaimId = async (_price: Stripe.Price): Promise<string | null> => null;

export const extractStripeClaim = async (_price: Stripe.Price) => null;
