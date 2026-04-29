// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors
import { z } from 'zod';

export const ZDiscoveryDocumentStatusSchema = z.enum(['inbox', 'pending-manual', 'processed']);

export const ZDiscoveryDocumentSchema = z.object({
  id: z.string(),
  nativeId: z.string(),
  title: z.string(),
  correspondent: z.string().nullable(),
  documentType: z.string().nullable(),
  tags: z.array(z.string()),
  documentDate: z.coerce.date().nullable(),
  capturedAt: z.coerce.date(),
  status: ZDiscoveryDocumentStatusSchema,
});

export const ZSourceKindSchema = z.enum(['IMAP']);

export const ZSourceSyncStatusSchema = z.enum(['PENDING', 'SUCCESS', 'FAILED', 'SUSPENDED']);

export const ZSourceSummarySchema = z.object({
  id: z.string(),
  kind: ZSourceKindSchema,
  label: z.string(),
  lastSyncAt: z.coerce.date().nullable(),
  lastSyncStatus: ZSourceSyncStatusSchema.nullable(),
});

export const ZFindDiscoveryDocumentsRequestSchema = z.object({
  query: z.string().trim().optional(),
  status: ZDiscoveryDocumentStatusSchema.optional(),
  correspondent: z.string().trim().optional(),
  documentDateFrom: z.coerce.date().optional(),
  documentDateTo: z.coerce.date().optional(),
  cursor: z.string().nullable().optional(),
});

export const ZFindDiscoveryDocumentsResponseSchema = z.object({
  documents: z.array(ZDiscoveryDocumentSchema),
  total: z.number().int().nonnegative(),
  nextCursor: z.string().nullable(),
  configured: z.boolean(),
  hasAnySource: z.boolean(),
  sources: z.array(ZSourceSummarySchema),
});

export const ZGetDiscoveryDocumentRequestSchema = z.object({
  id: z.string(),
});

export const ZGetDiscoveryDocumentResponseSchema = ZDiscoveryDocumentSchema.nullable();

export const ZDiscoveryDocumentActionSchema = z.enum([
  'accept',
  'mark-pending-manual',
  'archive',
  'ignore',
]);

export const ZUpdateDiscoveryDocumentStatusRequestSchema = z.object({
  id: z.string(),
  action: ZDiscoveryDocumentActionSchema,
});

export const ZUpdateDiscoveryDocumentStatusResponseSchema = z.object({
  ok: z.boolean(),
});

export type TDiscoveryDocument = z.infer<typeof ZDiscoveryDocumentSchema>;
export type TSourceSummary = z.infer<typeof ZSourceSummarySchema>;
export type TDiscoveryDocumentAction = z.infer<typeof ZDiscoveryDocumentActionSchema>;

export type TFindDiscoveryDocumentsRequest = z.infer<typeof ZFindDiscoveryDocumentsRequestSchema>;
export type TFindDiscoveryDocumentsResponse = z.infer<typeof ZFindDiscoveryDocumentsResponseSchema>;
export type TGetDiscoveryDocumentRequest = z.infer<typeof ZGetDiscoveryDocumentRequestSchema>;
export type TGetDiscoveryDocumentResponse = z.infer<typeof ZGetDiscoveryDocumentResponseSchema>;
