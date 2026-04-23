// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors. Stub — Stripe-Webhooks sind in der
// NexaSign-AGPL-Edition deaktiviert. Der Endpoint liefert 410 Gone, damit
// irrtümlich eingetragene Stripe-Webhook-URLs nicht scheinen zu funktionieren.

export const stripeWebhookHandler = async (_req: Request): Promise<Response> => {
  return Response.json(
    {
      success: false,
      message:
        'Stripe-Webhooks sind in der NexaSign-AGPL-Edition deaktiviert. ' +
        'Siehe packages/ee/FEATURES.',
    },
    { status: 410 },
  );
};
