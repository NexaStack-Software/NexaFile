// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors. Stub — Stripe-Billing deaktiviert.
import type { OrganisationClaim, Subscription } from '@prisma/client';

export type UpdateSubscriptionItemQuantityOptions = {
  subscriptionId: string;
  quantity: number;
  priceId: string;
};

export const updateSubscriptionItemQuantity = async (
  _options: UpdateSubscriptionItemQuantityOptions,
) => undefined;

/**
 * Wäre im Upstream für Seat-basierte Stripe-Abos zuständig. Ohne Stripe-Kopplung
 * einfach ein No-Op — NexaSign-Self-Hoster haben unbegrenzt viele Members.
 */
export const syncMemberCountWithStripeSeatPlan = async (
  _subscription: Subscription,
  _organisationClaim: OrganisationClaim,
  _quantity: number,
) => undefined;
