import type { LayoutServerLoad } from './$types';
import { config } from '#lib/server/config.ts';

export const load: LayoutServerLoad = async ({ locals, depends }) => {
    depends('bitlin:user');
    return { user: locals.user, origin: config.canonicalOrigin };
};
