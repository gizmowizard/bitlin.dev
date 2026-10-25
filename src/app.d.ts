import type { SessionUser } from '#lib/types.ts';

declare global {
    namespace App {
        interface Locals {
            user: SessionUser | null;
            sessionHash: string | null;
        }
        interface Error {
            message: string;
        }
    }
}

export {};
