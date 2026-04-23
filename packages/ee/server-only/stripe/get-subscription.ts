// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors. Stub — Stripe-Billing deaktiviert.
//
// Kein Abo → gibt null zurück. Der Union-Type im Return bleibt vollständig,
// damit Callers die beiden Eigenschaften (organisationSubscription,
// stripeSubscription) typsicher lesen können, wenn ein Wert vorhanden ist.
import type { Subscription } from '@prisma/client';
import type Stripe from 'stripe';

export type GetSubscriptionOptions = { userId: number; organisationId: string };

export type GetSubscriptionResult = {
  organisationSubscription: Subscription;
  stripeSubscription: Stripe.Subscription;
};

export const getSubscription = async (
  _options: GetSubscriptionOptions,
): Promise<GetSubscriptionResult | null> => {
  return null;
};
