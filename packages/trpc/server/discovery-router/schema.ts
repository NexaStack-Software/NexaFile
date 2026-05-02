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

// Filter-Wert für die Listenansicht. „all" zeigt alle Belege unabhängig vom
// Status — Hauptzweck: Überblick „welche Mail mit welcher Rechnung wann".
// Der DB-Filter ignoriert dann die status-Spalte komplett.
export const ZDiscoveryListFilterSchema = z.union([
  z.literal('all'),
  ZDiscoveryDocumentStatusSchema,
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
  // Anzahl ATTACHMENT-Artifacts mit nicht-leerem archivePath. Wenn 0 → Mail
  // hat keine herunterladbaren Anhänge (entweder MANUAL ohne PDF, oder vor-
  // Archive-Sync-Datensatz). Wird im Listen-Loader vorberechnet.
  attachmentCount: z.number().int().nonnegative(),
  hasArchive: z.boolean(),
  signingEnvelopeId: z.string().nullable().optional(),
  canCreateSigningDocument: z.boolean().optional(),
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

export const ZDiscoverySummarySchema = z.object({
  total: z.number().int().nonnegative(),
  accepted: z.number().int().nonnegative(),
  needsReview: z.number().int().nonnegative(),
  downloadable: z.number().int().nonnegative(),
  missingAmount: z.number().int().nonnegative(),
  missingInvoiceNumber: z.number().int().nonnegative(),
  months: z.array(
    z.object({
      key: z.string(),
      count: z.number().int().nonnegative(),
    }),
  ),
});

export const ZFindDiscoveryDocumentsRequestSchema = z.object({
  query: z.string().trim().optional(),
  // status entweder ein konkreter Status oder "all" für alle.
  status: ZDiscoveryListFilterSchema.optional(),
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
  summary: ZDiscoverySummarySchema.nullable().optional(),
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
      signingEnvelopeId: z.string().nullable(),
      canCreateSigningDocument: z.boolean(),
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
export type TDiscoverySummary = z.infer<typeof ZDiscoverySummarySchema>;
export type TDiscoveryDocumentAction = z.infer<typeof ZDiscoveryDocumentActionSchema>;
export type TDiscoveryArtifact = z.infer<typeof ZDiscoveryArtifactSchema>;
export type TGetDocumentDetailResponse = z.infer<typeof ZGetDocumentDetailResponseSchema>;

export type TFindDiscoveryDocumentsRequest = z.infer<typeof ZFindDiscoveryDocumentsRequestSchema>;
export type TFindDiscoveryDocumentsResponse = z.infer<typeof ZFindDiscoveryDocumentsResponseSchema>;
export type TGetDiscoveryDocumentRequest = z.infer<typeof ZGetDiscoveryDocumentRequestSchema>;
export type TGetDiscoveryDocumentResponse = z.infer<typeof ZGetDiscoveryDocumentResponseSchema>;

// Re-Sync einer einzelnen Mail aus IMAP — laedt Archive nach fuer Belege,
// die vor Aktivierung des Archive-Features importiert wurden.
export const ZResyncSingleDocumentRequestSchema = z.object({
  id: z.string(),
});

export const ZResyncSingleDocumentResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    archivePath: z.string(),
    attachmentsAdded: z.number().int().nonnegative(),
    alreadyHadArchive: z.boolean(),
  }),
  z.object({
    ok: z.literal(false),
    reason: z.string(),
  }),
]);

export type TResyncSingleDocumentRequest = z.infer<typeof ZResyncSingleDocumentRequestSchema>;
export type TResyncSingleDocumentResponse = z.infer<typeof ZResyncSingleDocumentResponseSchema>;

export const ZCreateSigningDocumentRequestSchema = z.object({
  id: z.string(),
});

export const ZCreateSigningDocumentResponseSchema = z.object({
  envelopeId: z.string(),
  alreadyExisted: z.boolean(),
});

export type TCreateSigningDocumentRequest = z.infer<typeof ZCreateSigningDocumentRequestSchema>;
export type TCreateSigningDocumentResponse = z.infer<typeof ZCreateSigningDocumentResponseSchema>;
