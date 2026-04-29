// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors
import { z } from 'zod';

import { ZSourceKindSchema, ZSourceSyncStatusSchema } from '../discovery-router/schema';

export const ZSourceListItemSchema = z.object({
  id: z.string(),
  kind: ZSourceKindSchema,
  label: z.string(),
  teamId: z.number().int().positive(),
  teamName: z.string(),
  lastSyncAt: z.coerce.date().nullable(),
  lastSyncAttemptedAt: z.coerce.date().nullable(),
  lastSyncStatus: ZSourceSyncStatusSchema,
  lastSyncError: z.string().nullable(),
  consecutiveFailures: z.number().int().nonnegative(),
  createdAt: z.coerce.date(),
});

export const ZListSourcesResponseSchema = z.array(ZSourceListItemSchema);

export const ZDeleteSourceRequestSchema = z.object({
  sourceId: z.string(),
});

export const ZDeleteSourceResponseSchema = z.object({
  deleted: z.boolean(),
});

export const ZImapConnectionConfigSchema = z.object({
  host: z.string().min(1).max(255),
  port: z.number().int().min(1).max(65535).default(993),
  username: z.string().min(1).max(255),
  password: z.string().min(1).max(1024),
  tlsVerify: z.boolean().default(true),
});

export const ZCreateImapSourceRequestSchema = ZImapConnectionConfigSchema.extend({
  teamId: z.number().int().positive(),
  label: z.string().min(1).max(120),
});

export const ZUpdateImapSourceRequestSchema = ZCreateImapSourceRequestSchema.extend({
  sourceId: z.string(),
  password: z.string().min(1).max(1024).optional(),
});

export const ZTestSourceRequestSchema = z.object({
  sourceId: z.string().optional(),
  config: ZImapConnectionConfigSchema.optional(),
});

export const ZTestSourceResponseSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
});

export const ZTriggerSyncRequestSchema = z.object({
  sourceId: z.string(),
});

export const ZTriggerSyncResponseSchema = z.object({
  triggered: z.boolean(),
});

export const ZReactivateSourceRequestSchema = z.object({
  sourceId: z.string(),
});

export const ZReactivateSourceResponseSchema = z.object({
  reactivated: z.boolean(),
});

export const ZSourceCapabilitiesResponseSchema = z.object({
  imap: z.object({
    maxAccountsPerUser: z.number().int().positive(),
    allowedHosts: z.array(z.string()),
    customHostsAllowed: z.boolean(),
  }),
  availableTeams: z.array(
    z.object({
      id: z.number().int().positive(),
      name: z.string(),
      url: z.string(),
      organisationName: z.string(),
    }),
  ),
});

export type TSourceListItem = z.infer<typeof ZSourceListItemSchema>;
export type TListSourcesResponse = z.infer<typeof ZListSourcesResponseSchema>;
export type TDeleteSourceRequest = z.infer<typeof ZDeleteSourceRequestSchema>;
export type TCreateImapSourceRequest = z.infer<typeof ZCreateImapSourceRequestSchema>;
export type TUpdateImapSourceRequest = z.infer<typeof ZUpdateImapSourceRequestSchema>;
export type TTestSourceRequest = z.infer<typeof ZTestSourceRequestSchema>;
export type TTestSourceResponse = z.infer<typeof ZTestSourceResponseSchema>;
export type TTriggerSyncRequest = z.infer<typeof ZTriggerSyncRequestSchema>;
export type TReactivateSourceRequest = z.infer<typeof ZReactivateSourceRequestSchema>;
