// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors. Independent re-implementation.
//
// Frontend-Fetch für `/api/limits`. Fällt bei Netzwerk-/Parse-Fehlern auf die
// Default-Konstanten zurück, damit die UI nie hängt. Das Schema wird
// server-seitig immer „unbegrenzt" zurückgeben — Client kann diese Antwort
// aber generisch behandeln.
import { NEXT_PUBLIC_WEBAPP_URL } from '@nexasign/lib/constants/app';

import { DEFAULT_MINIMUM_ENVELOPE_ITEM_COUNT, SELFHOSTED_PLAN_LIMITS } from './constants';
import type { TLimitsResponseSchema } from './schema';
import { ZLimitsResponseSchema } from './schema';

export type GetLimitsOptions = {
  headers?: Record<string, string>;
  teamId: number;
};

const FALLBACK_RESPONSE: TLimitsResponseSchema = {
  quota: SELFHOSTED_PLAN_LIMITS,
  remaining: SELFHOSTED_PLAN_LIMITS,
  maximumEnvelopeItemCount: DEFAULT_MINIMUM_ENVELOPE_ITEM_COUNT,
};

export const getLimits = async ({
  headers,
  teamId,
}: GetLimitsOptions): Promise<TLimitsResponseSchema> => {
  const target = new URL('/api/limits', NEXT_PUBLIC_WEBAPP_URL());
  const requestHeaders: Record<string, string> = { ...(headers ?? {}) };

  if (teamId) {
    requestHeaders['team-id'] = String(teamId);
  }

  try {
    const res = await fetch(target, { headers: requestHeaders });
    if (!res.ok) return FALLBACK_RESPONSE;
    const payload = await res.json();
    return ZLimitsResponseSchema.parse(payload);
  } catch {
    return FALLBACK_RESPONSE;
  }
};
