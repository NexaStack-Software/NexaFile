// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors. Independent re-implementation.
//
// `getServerLimits` — liefert die aktuellen Quota-Informationen für einen
// User + Team.
//
// NexaSign ist rein self-hosted und verzichtet bewusst auf die Stripe-
// Kopplung und Subscription-gestufte Quotas des Upstream-Originals. Wir
// geben daher einfach immer „unbegrenzt" zurück. Die Signatur bleibt
// unverändert, damit die 40+ Caller im Hauptcode unmodifiziert weiterlaufen.
//
// Wir lesen `maximumEnvelopeItemCount` aus der Organisation-Claim-Tabelle
// nach — dieses Feld wird in mehreren UI-Stellen für „Dateien pro Envelope"
// genutzt und ist ein berechtigter Org-spezifischer Wert, der nichts mit
// Stripe-Plänen zu tun hat.
import { prisma } from '@nexasign/prisma';

import { SELFHOSTED_PLAN_LIMITS } from './constants';
import type { TLimitsResponseSchema } from './schema';

export type GetServerLimitsOptions = {
  userId: number;
  teamId: number;
};

export const getServerLimits = async ({
  userId,
  teamId,
}: GetServerLimitsOptions): Promise<TLimitsResponseSchema> => {
  const organisation = await prisma.organisation.findFirst({
    where: {
      teams: { some: { id: teamId } },
      members: { some: { userId } },
    },
    include: {
      organisationClaim: true,
    },
  });

  const maximumEnvelopeItemCount = organisation?.organisationClaim?.envelopeItemCount ?? 5;

  return {
    quota: SELFHOSTED_PLAN_LIMITS,
    remaining: SELFHOSTED_PLAN_LIMITS,
    maximumEnvelopeItemCount,
  };
};
