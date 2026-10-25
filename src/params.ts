import { defineParams } from '@sveltejs/kit/params';

const accept = (re: RegExp) => (param: string) => (re.test(param) ? param : undefined);

export const params = defineParams({
    // User URLs look like /*alice; the asterisk is part of the path segment.
    handle: accept(/^\*[a-zA-Z0-9][a-zA-Z0-9_-]{1,31}$/),
    slug: accept(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/),
    num: accept(/^[1-9]\d{0,8}$/),
    hex: accept(/^[0-9a-f]{6,64}$/)
});
