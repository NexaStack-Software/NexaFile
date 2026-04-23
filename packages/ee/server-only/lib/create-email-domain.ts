// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors. Stub — Custom Email-Domains sind in der
// NexaSign-AGPL-Edition deaktiviert. Emails werden über den in .env
// konfigurierten SMTP-Transport versendet.
import { notAvailable } from '../_not-available';

export const getSesClient = () => {
  throw notAvailable('AWS SES client (Email-Domains)');
};

export async function verifyDomainWithDKIM(
  _domain: string,
  _selector: string,
  _privateKey: string,
) {
  throw notAvailable('verifyDomainWithDKIM (Email-Domains)');
}

type CreateEmailDomainOptions = { domain: string; organisationId: string };

export const createEmailDomain = async (_options: CreateEmailDomainOptions) => {
  throw notAvailable('createEmailDomain');
};
