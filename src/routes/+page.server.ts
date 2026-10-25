import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { enabledProviders } from '#lib/server/oauth.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
    if (locals.user) redirect(303, locals.user.onboarded ? '/dashboard' : '/welcome');
    return {
        providers: enabledProviders(),
        error: url.searchParams.get('error'),
        next: url.searchParams.get('next')
    };
};
