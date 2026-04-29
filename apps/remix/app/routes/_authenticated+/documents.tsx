import { redirect } from 'react-router';

import { formatDocumentsPath } from '@nexasign/lib/utils/teams';

import { getPreferredTeamUrlOrRedirect } from '~/utils/redirect-to-preferred-team.server';

import type { Route } from './+types/documents';

export async function loader({ request }: Route.LoaderArgs) {
  const teamUrl = await getPreferredTeamUrlOrRedirect(request);

  throw redirect(formatDocumentsPath(teamUrl));
}
