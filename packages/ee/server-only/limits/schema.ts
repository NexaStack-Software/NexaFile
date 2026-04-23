// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors. Independent re-implementation.
//
// Zod-Schema für Quota-Limits. Ersetzt den proprietären Upstream-Code durch
// eine eigene AGPL-Implementierung mit identischen Public-API-Shapes, damit
// die Caller im Haupt-Code (42 Importstellen) unverändert weiterlaufen.
//
// Bei NexaSign sind alle Werte „unlimited" — wir geben dafür `Infinity` in
// den runtime-Objekten und `null` in JSON-Antworten aus (JSON kann Infinity
// nicht serialisieren; der preprocess-Schritt im Schema übersetzt null → ∞).
import { z } from 'zod';

import { DEFAULT_MINIMUM_ENVELOPE_ITEM_COUNT } from './constants';

const unlimitedNumber = z
  .preprocess((raw) => (raw === null ? Infinity : Number(raw)), z.number())
  .optional()
  .default(0);

export const ZLimitsSchema = z.object({
  documents: unlimitedNumber,
  recipients: unlimitedNumber,
  directTemplates: unlimitedNumber,
});

export type TLimitsSchema = z.infer<typeof ZLimitsSchema>;

export const ZLimitsResponseSchema = z.object({
  quota: ZLimitsSchema,
  remaining: ZLimitsSchema,
  maximumEnvelopeItemCount: z.number().optional().default(DEFAULT_MINIMUM_ENVELOPE_ITEM_COUNT),
});

export type TLimitsResponseSchema = z.infer<typeof ZLimitsResponseSchema>;

export const ZLimitsErrorResponseSchema = z.object({
  error: z.string(),
});

export type TLimitsErrorResponseSchema = z.infer<typeof ZLimitsErrorResponseSchema>;
