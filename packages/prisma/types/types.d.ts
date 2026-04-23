/* eslint-disable @typescript-eslint/no-namespace */
import type { TDefaultRecipient } from '@nexasign/lib/types/default-recipients';
import type {
  TDocumentAuthOptions,
  TRecipientAuthOptions,
} from '@nexasign/lib/types/document-auth';
import type { TDocumentEmailSettings } from '@nexasign/lib/types/document-email';
import type { TDocumentFormValues } from '@nexasign/lib/types/document-form-values';
import type { TEnvelopeAttachmentType } from '@nexasign/lib/types/envelope-attachment';
import type { TFieldMetaNotOptionalSchema } from '@nexasign/lib/types/field-meta';
import type { TClaimFlags } from '@nexasign/lib/types/subscription';

/**
 * Global types for Prisma.Json instances.
 */
declare global {
  namespace PrismaJson {
    type ClaimFlags = TClaimFlags;

    type DocumentFormValues = TDocumentFormValues;
    type DocumentAuthOptions = TDocumentAuthOptions;
    type DocumentEmailSettings = TDocumentEmailSettings;
    type DocumentEmailSettingsNullable = TDocumentEmailSettings | null;

    type RecipientAuthOptions = TRecipientAuthOptions;

    type FieldMeta = TFieldMetaNotOptionalSchema;

    type EnvelopeAttachmentType = TEnvelopeAttachmentType;

    type DefaultRecipient = TDefaultRecipient;
  }
}

export {};
