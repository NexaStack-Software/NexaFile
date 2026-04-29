// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors
import { z } from 'zod';

export const ZDiscoveryDocumentStatusSchema = z.enum([
  'inbox',
  'pending-manual',
  'accepted',
  'archived',
  'ignored',
  'processed',
]);

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
  // Optional in Listenansicht (vor allem akzeptierte Belege).
  detectedAmount: z.string().nullable().optional(),
  detectedInvoiceNumber: z.string().nullable().optional(),
  acceptedAt: z.coerce.date().nullable().optional(),
  acceptedByName: z.string().nullable().optional(),
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

export const ZDiscoveryArtifactKindSchema = z.enum([
  'MAIL_EML',
  'MAIL_BODY_TEXT',
  'MAIL_BODY_HTML',
  'MAIL_METADATA',
  'ATTACHMENT',
]);

export const ZDiscoveryArtifactSchema = z.object({
  id: z.string(),
  kind: ZDiscoveryArtifactKindSchema,
  fileName: z.string(),
  contentType: z.string(),
  fileSize: z.number().int().nonnegative(),
  sha256: z.string().length(64),
  relativePath: z.string(),
});

export const ZGetDocumentDetailRequestSchema = z.object({
  id: z.string(),
});

export const ZGetDocumentDetailResponseSchema = z
  .object({
    document: ZDiscoveryDocumentSchema.extend({
      bodyText: z.string().nullable(),
      bodyHasHtml: z.boolean(),
      archivePath: z.string().nullable(),
      detectedAmount: z.string().nullable(),
      detectedInvoiceNumber: z.string().nullable(),
      portalHint: z.string().nullable(),
      messageIdHash: z.string().nullable(),
      providerSource: z.string(),
      providerNativeId: z.string().nullable(),
      acceptedAt: z.coerce.date().nullable(),
      acceptedByName: z.string().nullable(),
      sourceLabel: z.string().nullable(),
    }),
    artifacts: z.array(ZDiscoveryArtifactSchema),
    /** Absoluter Pfad auf dem Server zum Mail-Ordner (für FTP/SCP-Hinweis). */
    absoluteArchivePath: z.string().nullable(),
    /** Deep-Link zur Mail in Gmail, falls messageId vorhanden und Provider Gmail. */
    gmailDeepLink: z.string().nullable(),
  })
  .nullable();

export type TDiscoveryDocument = z.infer<typeof ZDiscoveryDocumentSchema>;
export type TSourceSummary = z.infer<typeof ZSourceSummarySchema>;
export type TDiscoveryDocumentAction = z.infer<typeof ZDiscoveryDocumentActionSchema>;
export type TDiscoveryArtifact = z.infer<typeof ZDiscoveryArtifactSchema>;
export type TGetDocumentDetailResponse = z.infer<typeof ZGetDocumentDetailResponseSchema>;

export type TFindDiscoveryDocumentsRequest = z.infer<typeof ZFindDiscoveryDocumentsRequestSchema>;
export type TFindDiscoveryDocumentsResponse = z.infer<typeof ZFindDiscoveryDocumentsResponseSchema>;
export type TGetDiscoveryDocumentRequest = z.infer<typeof ZGetDiscoveryDocumentRequestSchema>;
export type TGetDiscoveryDocumentResponse = z.infer<typeof ZGetDiscoveryDocumentResponseSchema>;
