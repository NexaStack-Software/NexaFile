// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors. Stub — Organisation-Authentication-
// Portal (SSO-Feature der Enterprise-Edition) ist in NexaSign deaktiviert.
import type { RequestMetadata } from '@nexasign/lib/universal/extract-request-metadata';

import { notAvailable } from '../_not-available';

export interface LinkOrganisationAccountOptions {
  token: string;
  requestMeta: RequestMetadata;
}

export const linkOrganisationAccount = async (_options: LinkOrganisationAccountOptions) => {
  throw notAvailable('linkOrganisationAccount (SSO)');
};
