// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors. Stub — Stripe-Billing deaktiviert.
//
// Liefert eine leere Stripe.ApiList<Invoice>-Shape. Self-Hoster haben keine
// NexaSign-SaaS-Rechnungen; der UI-Code rendert dann schlicht „keine".
import type Stripe from 'stripe';

export type GetInvoicesOptions = { customerId: string };

export const getInvoices = async (
  _options: GetInvoicesOptions,
): Promise<Stripe.ApiList<Stripe.Invoice>> => {
  return {
    object: 'list',
    data: [],
    has_more: false,
    url: '/v1/invoices',
  };
};
