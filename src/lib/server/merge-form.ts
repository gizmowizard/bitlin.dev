import type { Resolution } from './vcs/merge.ts';

// Conflict forms post c_<i> (choice), p_<i> (path) and t_<i> (edited text) triples.
export function parseResolutions(f: FormData): Record<string, Resolution> {
    const out: Record<string, Resolution> = {};
    for (let i = 0; i < 3000; i++) {
        const path = f.get(`p_${i}`);
        if (typeof path !== 'string') break;
        const choice = f.get(`c_${i}`);
        if (choice === 'ours' || choice === 'theirs' || choice === 'delete') out[path] = { choice };
        else if (choice === 'custom') out[path] = { choice: 'custom', content: String(f.get(`t_${i}`) ?? '') };
    }
    return out;
}
