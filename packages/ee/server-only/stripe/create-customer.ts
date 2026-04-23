// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors. Stub — Stripe-Billing deaktiviert.
//
// Return-Type entspricht Stripe.Customer, damit die aufrufenden tRPC-Routes
// (die `customer.id` lesen) typsicher kompilieren. Die Funktion wirft zur
// Runtime, weil Self-Hoster kein Stripe nutzen.
import type Stripe from 'stripe';

import { notAvailable } from '../_not-available';

export type CreateCustomerOptions = { name: string; email: string };

export const createCustomer = async (_options: CreateCustomerOptions): Promise<Stripe.Customer> => {
  throw notAvailable('createCustomer (Stripe)');
};
