// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors. Independent re-implementation.
//
// HTTP-Handler hinter `/api/limits`. Gibt die aktuellen Quota-Werte als JSON
// zurück. In NexaSign ist das immer „unbegrenzt" — der Handler ist trotzdem
// nötig, weil der `LimitsProvider` im Frontend beim Seitenladen pollt.
import { getSession } from '@nexasign/auth/server/lib/utils/get-session';

import { ERROR_CODES } from './errors';
import { getServerLimits } from './server';

export const limitsHandler = async (req: Request): Promise<Response> => {
  try {
    const { user } = await getSession(req);

    const rawTeamId = req.headers.get('team-id');
    const teamId =
      typeof rawTeamId === 'string' && /^\d+$/.test(rawTeamId) ? parseInt(rawTeamId, 10) : null;

    if (teamId === null) {
      return Response.json({ error: ERROR_CODES.INVALID_TEAM_ID }, { status: 400 });
    }

    const limits = await getServerLimits({ userId: user.id, teamId });

    return Response.json(limits, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    const mapped = ERROR_CODES[message] ?? ERROR_CODES.UNKNOWN;
    const status = message === 'UNAUTHORIZED' ? 401 : 500;
    return Response.json({ error: mapped }, { status });
  }
};
