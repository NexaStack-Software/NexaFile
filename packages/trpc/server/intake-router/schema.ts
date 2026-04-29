// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors
import { z } from 'zod';

import { ZDiscoveryDocumentSchema } from '../discovery-router/schema';

// Upload: Bytes kommen base64-kodiert vom Client, weil tRPC nativ kein
// Multipart unterstützt. Größenlimit pro Upload: 25 MB.
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const ZUploadIntakeDocumentRequestSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(127).default('application/pdf'),
  base64: z.string().refine(
    (s) => {
      const approxBytes = (s.length * 3) / 4;
      return approxBytes <= MAX_UPLOAD_BYTES;
    },
    { message: 'Datei zu groß (max. 25 MB).' },
  ),
});

export const ZUploadIntakeDocumentResponseSchema = ZDiscoveryDocumentSchema;

export type TUploadIntakeDocumentRequest = z.infer<typeof ZUploadIntakeDocumentRequestSchema>;
export type TUploadIntakeDocumentResponse = z.infer<typeof ZUploadIntakeDocumentResponseSchema>;
