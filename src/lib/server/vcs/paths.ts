import type { Tree } from '../../types.ts';

export function normalizePath(raw: string): string | null {
    if (raw.includes('\0') || /[\x01-\x1f\x7f]/.test(raw)) return null;
    const segs = raw.replace(/\\/g, '/').split('/').filter((s) => s !== '' && s !== '.');
    if (!segs.length || segs.some((s) => s === '..' || s.length > 255)) return null;
    const p = segs.join('/');
    return p.length > 512 ? null : p;
}

// A path can't be both a file and a directory.
export function findShapeConflict(tree: Tree): string | null {
    for (const path of Object.keys(tree)) {
        let i = path.indexOf('/');
        while (i !== -1) {
            if (tree[path.slice(0, i)]) return path.slice(0, i);
            i = path.indexOf('/', i + 1);
        }
    }
    return null;
}

export interface DirEntry {
    name: string;
    path: string;
    type: 'file' | 'dir';
    size: number;
    count: number; // files beneath a directory
}

export function listDir(tree: Tree, dir: string): DirEntry[] {
    const prefix = dir ? `${dir}/` : '';
    const map = new Map<string, DirEntry>();
    for (const [path, e] of Object.entries(tree)) {
        if (!path.startsWith(prefix)) continue;
        const rest = path.slice(prefix.length);
        const slash = rest.indexOf('/');
        if (slash === -1) {
            map.set(rest, { name: rest, path, type: 'file', size: e.s, count: 1 });
        } else {
            const name = rest.slice(0, slash);
            const cur = map.get(name);
            if (cur) {
                cur.size += e.s;
                cur.count++;
            } else map.set(name, { name, path: prefix + name, type: 'dir', size: e.s, count: 1 });
        }
    }
    return [...map.values()].sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, undefined, { numeric: true }) : a.type === 'dir' ? -1 : 1));
}

export function dirExists(tree: Tree, dir: string): boolean {
    if (!dir) return true;
    const prefix = `${dir}/`;
    for (const p in tree) if (p.startsWith(prefix)) return true;
    return false;
}

export function treesEqual(a: Tree, b: Tree): boolean {
    const ka = Object.keys(a);
    if (ka.length !== Object.keys(b).length) return false;
    return ka.every((k) => b[k]?.h === a[k].h);
}
