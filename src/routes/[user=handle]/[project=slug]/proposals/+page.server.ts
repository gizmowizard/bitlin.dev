import type { PageServerLoad } from './$types';
import { listProposals } from '#lib/server/proposals.ts';

export const load: PageServerLoad = async ({ parent, url, depends }) => {
    depends('bitlin:proposals');
    const { project } = await parent();
    const status = url.searchParams.get('status') === 'closed' ? 'closed' : 'open';
    const [shown, openRows] = await Promise.all([listProposals(project.id, status), status === 'open' ? null : listProposals(project.id, 'open')]);
    return { proposals: shown, status, openCount: (openRows ?? shown).length };
};
