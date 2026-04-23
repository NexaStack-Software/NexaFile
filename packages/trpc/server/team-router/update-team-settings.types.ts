import { z } from 'zod';

import { ZEnvelopeExpirationPeriod } from '@nexasign/lib/constants/envelope-expiration';
import { ZEnvelopeReminderSettings } from '@nexasign/lib/constants/envelope-reminder';
import { SUPPORTED_LANGUAGE_CODES } from '@nexasign/lib/constants/i18n';
import { ZDefaultRecipientsSchema } from '@nexasign/lib/types/default-recipients';
import { ZDocumentEmailSettingsSchema } from '@nexasign/lib/types/document-email';
import {
  ZDocumentMetaDateFormatSchema,
  ZDocumentMetaTimezoneSchema,
} from '@nexasign/lib/types/document-meta';
import { DocumentVisibility } from '@nexasign/lib/types/document-visibility';
import { zEmail } from '@nexasign/lib/utils/zod';

/**
 * Null = Inherit from organisation.
 * Undefined = Do nothing
 */
export const ZUpdateTeamSettingsRequestSchema = z.object({
  teamId: z.number(),
  data: z.object({
    // Document related settings.
    documentVisibility: z.nativeEnum(DocumentVisibility).nullish(),
    documentLanguage: z.enum(SUPPORTED_LANGUAGE_CODES).nullish(),
    documentTimezone: ZDocumentMetaTimezoneSchema.nullish(),
    documentDateFormat: ZDocumentMetaDateFormatSchema.nullish(),
    includeSenderDetails: z.boolean().nullish(),
    includeSigningCertificate: z.boolean().nullish(),
    includeAuditLog: z.boolean().nullish(),
    typedSignatureEnabled: z.boolean().nullish(),
    uploadSignatureEnabled: z.boolean().nullish(),
    drawSignatureEnabled: z.boolean().nullish(),
    delegateDocumentOwnership: z.boolean().nullish(),
    envelopeExpirationPeriod: ZEnvelopeExpirationPeriod.nullish(),
    reminderSettings: ZEnvelopeReminderSettings.nullish(),

    // Branding related settings.
    brandingEnabled: z.boolean().nullish(),
    brandingLogo: z.string().nullish(),
    brandingUrl: z.string().nullish(),
    brandingCompanyDetails: z.string().nullish(),

    // Email related settings.
    emailId: z.string().nullish(),
    emailReplyTo: zEmail().nullish(),
    // emailReplyToName: z.string().nullish(),
    emailDocumentSettings: ZDocumentEmailSettingsSchema.nullish(),

    // Default recipients settings.
    defaultRecipients: ZDefaultRecipientsSchema.nullish(),
    // AI features settings.
    aiFeaturesEnabled: z.boolean().nullish(),
  }),
});

export const ZUpdateTeamSettingsResponseSchema = z.void();
