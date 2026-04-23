// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors. Independent re-implementation.
//
// React-Context, der die Quota-Informationen überall in der App bereitstellt.
// In NexaSign sind die Werte immer „unbegrenzt" — der Provider pollt trotzdem
// den /api/limits-Endpoint, damit die Typen+Shapes upstream-kompatibel
// bleiben und ein späteres Wiedereinführen echter Limits keine Breaking-Change
// wäre.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { getLimits } from '../client';
import { DEFAULT_MINIMUM_ENVELOPE_ITEM_COUNT, SELFHOSTED_PLAN_LIMITS } from '../constants';
import type { TLimitsResponseSchema } from '../schema';

export type LimitsContextValue = TLimitsResponseSchema & { refreshLimits: () => Promise<void> };

const LimitsContext = createContext<LimitsContextValue | null>(null);

export const useLimits = (): LimitsContextValue => {
  const ctx = useContext(LimitsContext);
  if (ctx === null) {
    throw new Error('useLimits() must be used inside a <LimitsProvider>.');
  }
  return ctx;
};

export type LimitsProviderProps = {
  initialValue?: TLimitsResponseSchema;
  /** Aus Legacy-Gründen: wenn true, wird kein /api/limits-Polling gemacht. */
  disableLimitsFetch?: boolean;
  teamId: number;
  children?: React.ReactNode;
};

const DEFAULT_INITIAL: TLimitsResponseSchema = {
  quota: SELFHOSTED_PLAN_LIMITS,
  remaining: SELFHOSTED_PLAN_LIMITS,
  maximumEnvelopeItemCount: DEFAULT_MINIMUM_ENVELOPE_ITEM_COUNT,
};

export const LimitsProvider = ({
  initialValue = DEFAULT_INITIAL,
  disableLimitsFetch = false,
  teamId,
  children,
}: LimitsProviderProps) => {
  const [limits, setLimits] = useState<TLimitsResponseSchema>(initialValue);

  const refreshLimits = useCallback(async () => {
    if (disableLimitsFetch) return;
    const next = await getLimits({ teamId });
    setLimits((prev) => {
      // Billige Gleichheitsprüfung — reicht, weil die Struktur flach ist.
      const same =
        prev.quota.documents === next.quota.documents &&
        prev.quota.recipients === next.quota.recipients &&
        prev.quota.directTemplates === next.quota.directTemplates &&
        prev.remaining.documents === next.remaining.documents &&
        prev.remaining.recipients === next.remaining.recipients &&
        prev.remaining.directTemplates === next.remaining.directTemplates &&
        prev.maximumEnvelopeItemCount === next.maximumEnvelopeItemCount;
      return same ? prev : next;
    });
  }, [disableLimitsFetch, teamId]);

  useEffect(() => {
    void refreshLimits();
  }, [refreshLimits]);

  useEffect(() => {
    if (disableLimitsFetch) return;
    const onFocus = () => void refreshLimits();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [disableLimitsFetch, refreshLimits]);

  return (
    <LimitsContext.Provider value={{ ...limits, refreshLimits }}>{children}</LimitsContext.Provider>
  );
};
