import { diffArrays } from 'diff';
import { getBlob, putBlob } from '../storage.ts';
import { decodeText } from './diff.ts';
import type { Entry, Tree } from '../../types.ts';

interface Hunk {
    bs: number;
    be: number;
    lines: string[];
}

// Regions of `base` replaced in `side` (half-open ranges over base lines).
function hunks(base: string[], side: string[]): Hunk[] {
    const out: Hunk[] = [];
    let cur: Hunk | null = null;
    let bi = 0;
    for (const part of diffArrays(base, side)) {
        const n = part.value.length;
        if (part.added) {
            cur ??= { bs: bi, be: bi, lines: [] };
            cur.lines.push(...part.value);
        } else if (part.removed) {
            cur ??= { bs: bi, be: bi, lines: [] };
            cur.be += n;
            bi += n;
        } else {
            if (cur) out.push(cur);
            cur = null;
            bi += n;
        }
    }
    if (cur) out.push(cur);
    return out;
}

function applyHunks(base: string[], hs: Hunk[], start: number, end: number): string[] {
    const out: string[] = [];
    let p = start;
    for (const h of hs) {
        out.push(...base.slice(p, h.bs), ...h.lines);
        p = h.be;
    }
    out.push(...base.slice(p, end));
    return out;
}

export interface TextMerge {
    text: string;
    conflicts: number;
}

export function merge3(baseText: string, oursText: string, theirsText: string, labels: { ours: string; theirs: string }): TextMerge {
    const base = baseText.split('\n');
    const A = hunks(base, oursText.split('\n'));
    const B = hunks(base, theirsText.split('\n'));
    const out: string[] = [];
    let pos = 0;
    let i = 0;
    let j = 0;
    let conflicts = 0;

    while (i < A.length || j < B.length) {
        const start = Math.min(A[i]?.bs ?? Infinity, B[j]?.bs ?? Infinity);
        out.push(...base.slice(pos, start));
        const ga: Hunk[] = [];
        const gb: Hunk[] = [];
        let end = start;
        // Gather every hunk that touches the growing region; touching edits count as overlapping.
        for (;;) {
            if (i < A.length && A[i].bs <= end) {
                end = Math.max(end, A[i].be);
                ga.push(A[i++]);
            } else if (j < B.length && B[j].bs <= end) {
                end = Math.max(end, B[j].be);
                gb.push(B[j++]);
            } else break;
        }
        const ours = applyHunks(base, ga, start, end);
        const theirs = applyHunks(base, gb, start, end);
        if (!gb.length) out.push(...ours);
        else if (!ga.length) out.push(...theirs);
        else if (ours.join('\n') === theirs.join('\n')) out.push(...ours);
        else {
            conflicts++;
            out.push(`<<<<<<< ${labels.ours}`, ...ours, '=======', ...theirs, `>>>>>>> ${labels.theirs}`);
        }
        pos = end;
    }
    out.push(...base.slice(pos));
    return { text: out.join('\n'), conflicts };
}

export interface Conflict {
    path: string;
    kind: 'content' | 'modify-delete' | 'both-added' | 'binary';
    ours: Entry | null;
    theirs: Entry | null;
    markers: string | null; // merged text with conflict markers, when both sides are text
}

export interface MergeOutcome {
    tree: Tree;
    conflicts: Conflict[];
    autoMerged: string[];
    changed: number; // files that differ from ours
}

const same = (a?: Entry, b?: Entry) => (!a && !b) || (!!a && !!b && a.h === b.h);

export async function mergeTrees(base: Tree, ours: Tree, theirs: Tree, labels: { ours: string; theirs: string }): Promise<MergeOutcome> {
    const tree: Tree = {};
    const conflicts: Conflict[] = [];
    const autoMerged: string[] = [];
    const paths = new Set([...Object.keys(base), ...Object.keys(ours), ...Object.keys(theirs)]);

    for (const path of paths) {
        const b = base[path];
        const o = ours[path];
        const t = theirs[path];
        let take: Entry | undefined;
        if (same(o, t)) take = o;
        else if (same(b, o)) take = t;
        else if (same(b, t)) take = o;
        else {
            const res = await resolveBoth(path, b, o, t, labels);
            if (res.entry) {
                take = res.entry;
                autoMerged.push(path);
            } else {
                conflicts.push(res.conflict!);
                // Until resolved, keep our side so the preview tree stays coherent.
                take = o;
            }
        }
        if (take) tree[path] = take;
    }
    const changed = [...paths].filter((p) => !same(ours[p], tree[p])).length;
    return { tree, conflicts, autoMerged, changed };
}

async function resolveBoth(path: string, b: Entry | undefined, o: Entry | undefined, t: Entry | undefined, labels: { ours: string; theirs: string }): Promise<{ entry?: Entry; conflict?: Conflict }> {
    const conflict = (kind: Conflict['kind'], markers: string | null = null): { conflict: Conflict } => ({
        conflict: { path, kind, ours: o ?? null, theirs: t ?? null, markers }
    });
    if (!o || !t) return conflict('modify-delete');
    const [ob, tb, bb] = await Promise.all([getBlob(o.h), getBlob(t.h), b ? getBlob(b.h) : Promise.resolve(Buffer.alloc(0))]);
    const [ot, tt, bt] = [decodeText(ob), decodeText(tb), decodeText(bb)];
    if (ot === null || tt === null || bt === null) return conflict('binary');
    const m = merge3(bt, ot, tt, labels);
    if (m.conflicts === 0) {
        const buf = Buffer.from(m.text, 'utf8');
        const { hash, size } = await putBlob(buf);
        return { entry: { h: hash, s: size } };
    }
    return conflict(b ? 'content' : 'both-added', m.text);
}

export type Resolution = { choice: 'ours' | 'theirs' | 'delete' } | { choice: 'custom'; content: string };

export async function applyResolutions(tree: Tree, conflicts: Conflict[], resolutions: Record<string, Resolution>): Promise<{ tree: Tree; unresolved: Conflict[] }> {
    const out: Tree = { ...tree };
    const unresolved: Conflict[] = [];
    for (const c of conflicts) {
        const r = resolutions[c.path];
        if (!r) {
            unresolved.push(c);
            continue;
        }
        let entry: Entry | null | undefined;
        if (r.choice === 'ours') entry = c.ours;
        else if (r.choice === 'theirs') entry = c.theirs;
        else if (r.choice === 'delete') entry = null;
        else if (r.choice === 'custom') {
            const { hash, size } = await putBlob(Buffer.from(r.content, 'utf8'));
            entry = { h: hash, s: size };
        }
        if (entry) out[c.path] = entry;
        else delete out[c.path];
    }
    return { tree: out, unresolved };
}
