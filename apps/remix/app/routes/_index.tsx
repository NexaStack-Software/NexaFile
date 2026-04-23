import { redirect } from 'react-router';

import { extractCookieFromHeaders } from '@nexasign/auth/server/lib/utils/cookies';
import { getOptionalSession } from '@nexasign/auth/server/lib/utils/get-session';
import { getTeams } from '@nexasign/lib/server-only/team/get-teams';
import { formatDocumentsPath } from '@nexasign/lib/utils/teams';
import { ZTeamUrlSchema } from '@nexasign/trpc/server/team-router/schema';

import type { Route } from './+types/_index';

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getOptionalSession(request);

  if (session.isAuthenticated) {
    const teamUrlCookie = extractCookieFromHeaders('preferred-team-url', request.headers);

    // const referrer = request.headers.get('referer');
    // let isReferrerFromTeamUrl = false;

    // if (referrer) {
    //   const referrerUrl = new URL(referrer);

    //   if (referrerUrl.pathname.startsWith('/t/')) {
    //     isReferrerFromTeamUrl = true;
    //   }
    // }

    const preferredTeamUrl =
      teamUrlCookie && ZTeamUrlSchema.safeParse(teamUrlCookie).success ? teamUrlCookie : undefined;

    // // Early return for no preferred team.
    // if (!preferredTeamUrl || isReferrerFromTeamUrl) {
    //   throw redirect('/inbox');
    // }

    const teams = await getTeams({ userId: session.user.id });

    let currentTeam = teams.find((team) => team.url === preferredTeamUrl);

    if (!currentTeam && teams.length === 1) {
      currentTeam = teams[0];
    }

    if (!currentTeam) {
      throw redirect('/inbox');
    }

    throw redirect(formatDocumentsPath(currentTeam.url));
  }

  throw redirect('/signin');
}
