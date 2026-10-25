import { structuredPatch } from 'diff';
import { getBlob } from '../storage.ts';
import type { DiffHunk, DiffLine, Entry, FileDiff, Tree } from '../../types.ts';

export interface FileChange {
    path: string;
    status: 'added' | 'removed' | 'modified' | 'renamed';
    old?: Entry;
    new?: Entry;
    from?: string;
}

export function diffTrees(a: Tree | null, b: Tree): FileChange[] {
    const before = a ?? {};
    const out: FileChange[] = [];
    for (const [path, e] of Object.entries(b)) {
        const old = before[path];
        if (!old) out.push({ path, status: 'added', new: e });
        else if (old.h !== e.h) out.push({ path, status: 'modified', old, new: e });
    }
    for (const [path, e] of Object.entries(before)) if (!b[path]) out.push({ path, status: 'removed', old: e });

    // Pair identical content that vanished and appeared elsewhere as a rename.
    const removedByHash = new Map<string, FileChange>();
    for (const c of out) if (c.status === 'removed') removedByHash.set(c.old!.h, c);
    const dropped = new Set<FileChange>();
    for (const c of out) {
        if (c.status !== 'added') continue;
        const r = removedByHash.get(c.new!.h);
        if (r && !dropped.has(r)) {
            c.status = 'renamed';
            c.from = r.path;
            c.old = r.old;
            dropped.add(r);
        }
    }
    return out.filter((c) => !dropped.has(c)).sort((x, y) => x.path.localeCompare(y.path));
}

const decoder = new TextDecoder('utf-8', { fatal: true });

export function decodeText(buf: Buffer): string | null {
    if (buf.subarray(0, 8000).includes(0)) return null;
    try {
        return decoder.decode(buf);
    } catch {
        return null;
    }
}

export function textDiff(oldText: string, newText: string, context = 3): { hunks: DiffHunk[]; additions: number; deletions: number } | null {
    const patch = structuredPatch('a', 'b', oldText, newText, '', '', { context, timeout: 2000 } as any) as unknown as { hunks: { oldStart: number; oldLines: number; newStart: number; newLines: number; lines: string[] }[] } | undefined;
    if (!patch) return null;
    let additions = 0;
    let deletions = 0;
    const hunks = patch.hunks.map((h) => {
        let o = h.oldStart;
        let n = h.newStart;
        const lines: DiffLine[] = h.lines.map((raw) => {
            const c = raw[0];
            const t = raw.slice(1);
            if (c === '+') {
                additions++;
                return { k: 'a', t, n: n++ };
            }
            if (c === '-') {
                deletions++;
                return { k: 'd', t, o: o++ };
            }
            if (c === '\\') return { k: 'm', t };
            return { k: 'c', t, o: o++, n: n++ };
        });
        return { header: `@@ -${h.oldStart},${h.oldLines} +${h.newStart},${h.newLines} @@`, lines };
    });
    return { hunks, additions, deletions };
}

const MAX_DIFF_BYTES = 400 * 1024;
const MAX_DIFFED_FILES = 60;

export async function buildFileDiffs(changes: FileChange[]): Promise<FileDiff[]> {
    const results: FileDiff[] = [];
    let diffed = 0;
    for (const c of changes) {
        const base: FileDiff = {
            path: c.path,
            status: c.status,
            from: c.from,
            binary: false,
            skipped: false,
            additions: 0,
            deletions: 0,
            hunks: [],
            oldSize: c.old?.s ?? null,
            newSize: c.new?.s ?? null
        };
        const tooBig = (c.old?.s ?? 0) > MAX_DIFF_BYTES || (c.new?.s ?? 0) > MAX_DIFF_BYTES;
        if (tooBig || diffed >= MAX_DIFFED_FILES || (c.status === 'renamed' && c.old?.h === c.new?.h)) {
            base.skipped = c.status !== 'renamed';
            results.push(base);
            continue;
        }
        diffed++;
        try {
            const [oldBuf, newBuf] = await Promise.all([c.old ? getBlob(c.old.h) : Buffer.alloc(0), c.new ? getBlob(c.new.h) : Buffer.alloc(0)]);
            const oldText = decodeText(oldBuf);
            const newText = decodeText(newBuf);
            if (oldText === null || newText === null) {
                base.binary = true;
            } else {
                const d = textDiff(oldText, newText);
                if (d) Object.assign(base, d);
                else base.skipped = true;
            }
        } catch {
            base.skipped = true;
        }
        results.push(base);
    }
    return results;
}
