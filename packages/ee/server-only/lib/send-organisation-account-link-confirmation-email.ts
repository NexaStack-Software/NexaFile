// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors. Stub — Organisation-SSO deaktiviert.
import type { TOrganisationAccountLinkMetadata } from '@nexasign/lib/types/organisation';

export type SendOrganisationAccountLinkConfirmationEmailProps = TOrganisationAccountLinkMetadata & {
  organisationName: string;
};

export const sendOrganisationAccountLinkConfirmationEmail = async (
  _props: SendOrganisationAccountLinkConfirmationEmailProps,
) => undefined;
