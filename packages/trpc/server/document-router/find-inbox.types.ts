// import type { OpenApiMeta } from 'trpc-to-openapi';
import type { z } from 'zod';

import { ZDocumentManySchema } from '@nexasign/lib/types/document';
import { ZFindResultResponse, ZFindSearchParamsSchema } from '@nexasign/lib/types/search-params';

export const ZFindInboxRequestSchema = ZFindSearchParamsSchema;

export const ZFindInboxResponseSchema = ZFindResultResponse.extend({
  data: ZDocumentManySchema.array(),
});

export type TFindInboxResponse = z.infer<typeof ZFindInboxResponseSchema>;
