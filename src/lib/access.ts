import type { Role } from './types.ts';

const RANK: Record<Role, number> = { none: 0, read: 1, write: 2, admin: 3, owner: 4 };
export const can = (role: Role, need: Exclude<Role, 'none'>) => RANK[role] >= RANK[need];
