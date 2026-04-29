import { redirect } from 'react-router';

import { extractCookieFromHeaders } from '@nexasign/auth/server/lib/utils/cookies';
import { getSession } from '@nexasign/auth/server/lib/utils/get-session';
import { getTeams } from '@nexasign/lib/server-only/team/get-teams';
import { ZTeamUrlSchema } from '@nexasign/trpc/server/team-router/schema';

export const getPreferredTeamUrlOrRedirect = async (request: Request): Promise<string> => {
  const { user } = await getSession(request);
  const teamUrlCookie = extractCookieFromHeaders('preferred-team-url', request.headers);
  const preferredTeamUrl =
    teamUrlCookie && ZTeamUrlSchema.safeParse(teamUrlCookie).success ? teamUrlCookie : undefined;

  const teams = await getTeams({ userId: user.id });
  const currentTeam =
    teams.find((team) => team.url === preferredTeamUrl) ?? (teams.length === 1 ? teams[0] : null);

  if (!currentTeam) {
    throw redirect('/inbox');
  }

  return currentTeam.url;
};
