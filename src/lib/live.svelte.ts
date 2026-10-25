import { invalidate } from '$app/navigation';
import { ws } from './ws.svelte.ts';

const pending = new Set<string>();
let timer: ReturnType<typeof setTimeout> | undefined;

// Bursts of events (e.g. a multi-file save) collapse into one refetch per dependency key.
export function refresh(...keys: string[]) {
    keys.forEach((k) => pending.add(k));
    clearTimeout(timer);
    timer = setTimeout(() => {
        const batch = [...pending];
        pending.clear();
        batch.forEach((k) => void invalidate(k));
    }, 120);
}

/** Subscribes for the lifetime of the calling component. The topic may be reactive. */
export function useLive(topic: () => string | null, handler: (type: string, data: Record<string, any>) => void) {
    $effect(() => {
        const t = topic();
        if (!t) return;
        return ws.on(t, handler);
    });
}
