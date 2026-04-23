// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors. Independent re-implementation.
//
// Error-Codes für den limits/handler. Die Map-Form bleibt erhalten, damit der
// bestehende Upstream-Code (ts-pattern match in handler.ts) unverändert
// funktioniert.

export const ERROR_CODES: Record<string, string> = {
  UNAUTHORIZED: 'You must be signed in to access this resource.',
  USER_FETCH_FAILED: 'Could not resolve the requesting user account.',
  INVALID_TEAM_ID: 'No valid team-id was supplied in the request.',
  UNKNOWN: 'An unknown error occurred while resolving quotas.',
};
