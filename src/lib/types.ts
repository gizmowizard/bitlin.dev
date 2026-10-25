export interface PublicUser {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
}

export interface SessionUser extends PublicUser {
    onboarded: boolean;
    timezone: string;
    region: string | null;
}

export type Role = 'none' | 'read' | 'write' | 'admin' | 'owner';
export type Collaboratorrole = 'read' | 'write' | 'admin';

export interface Entry {
    h: string; // blob sha256
    s: number; // size in bytes
}
export type Tree = Record<string, Entry>;

export interface BranchInfo {
    name: string;
    head: string | null;
    tracking: string | null;
    updated_at: Date;
}

export interface SnapshotInfo {
    id: string;
    parents: string[];
    message: string;
    created_at: Date;
    author: PublicUser | null;
    author_name: string;
}

export interface ResolvedRef {
    name: string;
    kind: 'branch' | 'tag' | 'snapshot';
    snapshot: string | null;
    branch: string | null; // set only when the ref is a writable branch
}

export type LiveEvent = {
    t: 'ev';
    topic: string;
    type: string;
    data: Record<string, any>;
    ts: number;
};

export interface DiffLine {
    k: 'c' | 'a' | 'd' | 'm'; // context, added, deleted, meta ("no newline" markers)
    t: string;
    o?: number;
    n?: number;
}
export interface DiffHunk {
    header: string;
    lines: DiffLine[];
}
export interface FileDiff {
    path: string;
    status: 'added' | 'removed' | 'modified' | 'renamed';
    from?: string;
    binary: boolean;
    skipped: boolean; // content not diffed (too large / too many files)
    additions: number;
    deletions: number;
    hunks: DiffHunk[];
    oldSize: number | null;
    newSize: number | null;
}
