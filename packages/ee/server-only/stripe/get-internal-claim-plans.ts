// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors. Stub — Stripe-Billing deaktiviert.
//
// Behält die vollständige Typ-Shape der Upstream-Edition (inklusive der
// optionalen monthlyPrice/yearlyPrice-Felder), damit die Callers in
// billing-plans.tsx und organisation-create-dialog.tsx ihre Feld-Zugriffe
// typsicher compilieren. Zur Runtime liefern wir nur die Basis-Claims
// ohne Preise — der UI-Code rendert dann „Preis nicht verfügbar" etc.
import { clone } from 'remeda';
import type Stripe from 'stripe';

import {
  type INTERNAL_CLAIM_ID,
  type InternalClaim,
  internalClaims,
} from '@nexasign/lib/types/subscription';

export type InternalClaimPlans = {
  [key in INTERNAL_CLAIM_ID]: InternalClaim & {
    monthlyPrice?: Stripe.Price & {
      product: Stripe.Product;
      isVisibleInApp: boolean;
      friendlyPrice: string;
    };
    yearlyPrice?: Stripe.Price & {
      product: Stripe.Product;
      isVisibleInApp: boolean;
      friendlyPrice: string;
    };
  };
};

export const getInternalClaimPlans = async (): Promise<InternalClaimPlans> => {
  return clone(internalClaims) as InternalClaimPlans;
};
