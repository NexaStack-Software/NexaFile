// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors. Stub — wird vom Handler nie aufgerufen.
import type { Stripe } from '@nexasign/lib/server-only/stripe';

export type OnSubscriptionCreatedOptions = { subscription: Stripe.Subscription };

export const onSubscriptionCreated = async (_options: OnSubscriptionCreatedOptions) => undefined;
