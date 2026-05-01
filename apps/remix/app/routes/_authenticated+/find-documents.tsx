import { redirect } from 'react-router';

import { getPreferredTeamUrlOrRedirect } from '~/utils/redirect-to-preferred-team.server';

import type { Route } from './+types/find-documents';

export async function loader({ request }: Route.LoaderArgs) {
  const teamUrl = await getPreferredTeamUrlOrRedirect(request);

  throw redirect(`/t/${teamUrl}/find-documents`);
}
