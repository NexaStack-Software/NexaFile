// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors. Independent re-implementation.
//
// Quota-Konstanten. NexaSign ist ausschließlich self-hosted und kennt keine
// Stripe-gekoppelten Plan-Stufen — alle Limits sind unbegrenzt. Die anderen
// Konstanten bleiben als Shape-Kompatibilität für Callers bestehen, die
// historisch verschiedene Plan-Niveaus abfragen.
import type { TLimitsSchema } from './schema';

const UNLIMITED: TLimitsSchema = {
  documents: Infinity,
  recipients: Infinity,
  directTemplates: Infinity,
};

const ZERO: TLimitsSchema = {
  documents: 0,
  recipients: 0,
  directTemplates: 0,
};

/** Historischer „Free-Plan"-Identifier. In NexaSign ebenfalls unbegrenzt. */
export const FREE_PLAN_LIMITS: TLimitsSchema = UNLIMITED;

/** Historischer „Inactive"-Identifier (abgelaufenes Abo). Bei uns N/A. */
export const INACTIVE_PLAN_LIMITS: TLimitsSchema = ZERO;

/** Historischer „Paid"-Identifier. Bei uns unbegrenzt. */
export const PAID_PLAN_LIMITS: TLimitsSchema = UNLIMITED;

/** Self-Hosted (unser Default) — unbegrenzt. */
export const SELFHOSTED_PLAN_LIMITS: TLimitsSchema = UNLIMITED;

/** Start-Wert fürs Frontend, bevor die API-Antwort vorliegt. */
export const DEFAULT_MINIMUM_ENVELOPE_ITEM_COUNT = 5;
