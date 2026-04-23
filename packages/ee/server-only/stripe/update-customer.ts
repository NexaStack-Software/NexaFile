// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors. Stub — Stripe-Billing deaktiviert.
import type Stripe from 'stripe';

export type UpdateCustomerOptions = { customerId: string; name?: string; email?: string };

export const updateCustomer = async (
  _options: UpdateCustomerOptions,
): Promise<Stripe.Customer | undefined> => undefined;
