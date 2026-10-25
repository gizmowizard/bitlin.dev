// One shared ticker keeps every relative timestamp fresh without per-component timers.
export const clock = $state({ now: Date.now() });
if (typeof window !== 'undefined') setInterval(() => (clock.now = Date.now()), 30_000);
