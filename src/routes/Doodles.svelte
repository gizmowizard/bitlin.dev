<script lang="ts">
    import { onMount } from "svelte";

    type Shape = { d: string; dash?: string };
    type Placed = { d: string; dash?: string; x: number; y: number; r: number; s: number };

    let doodles: Placed[] = $state([]);
    let w = $state(0);
    let h = $state(0);
    let ready = $state(false);

    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const f = (n: number) => n.toFixed(1);
    function pick<T>(xs: T[]): T {
        return xs[Math.floor(Math.random() * xs.length)];
    }

    function smooth(p: [number, number][]): string {
        const n = p.length;
        const mid = (a: [number, number], b: [number, number]) => `${f((a[0] + b[0]) / 2)} ${f((a[1] + b[1]) / 2)}`;
        let d = `M${mid(p[n - 1], p[0])}`;
        for (let i = 0; i < n; i++) d += `Q${f(p[i][0])} ${f(p[i][1])} ${mid(p[i], p[(i + 1) % n])}`;
        return d + "Z";
    }

    function polygon(n: number, outer: number, inner: number, jitter: number): string {
        let d = "";
        const count = inner ? n * 2 : n;
        for (let i = 0; i < count; i++) {
            const a = (i / count) * Math.PI * 2 - Math.PI / 2;
            const r = (inner && i % 2 ? inner : outer) + rnd(-jitter, jitter);
            d += `${i ? "L" : "M"}${f(Math.cos(a) * r)} ${f(Math.sin(a) * r)}`;
        }
        return d + "Z";
    }

    const MAKERS: (() => Shape)[] = [
        () => ({ d: `M-28 0q7 ${f(-rnd(8, 16))} 14 0t14 0t14 0t14 0` }), // squiggle
        () => ({ d: "M-28 7l11-14l11 14l11-14l11 14" }), // zigzag
        () => {
            let d = "";
            const turns = rnd(2, 3);
            for (let i = 0; i <= 60; i++) {
                const t = i / 60;
                const a = t * turns * Math.PI * 2;
                d += `${i ? "L" : "M"}${f(Math.cos(a) * t * 22)} ${f(Math.sin(a) * t * 22)}`;
            }
            return { d };
        }, // spiral
        () => ({ d: smooth(Array.from({ length: 8 }, (_, i): [number, number] => {
            const a = (i / 8) * Math.PI * 2;
            const k = 16 * rnd(0.75, 1.15);
            return [Math.cos(a) * k, Math.sin(a) * k];
        })) }), // wobbly loop
        () => ({ d: polygon(5, 18, 8, 1.5) }), // star
        () => ({ d: polygon(3, 17, 0, 3) }), // triangle
        () => ({ d: "M-9 0H9M0-9V9" }), // plus
        () => ({ d: "M-8-8L8 8M8-8L-8 8" }), // cross
        () => ({ d: "M-15 0a15 15 0 1 0 30 0a15 15 0 1 0-30 0", dash: "3 6" }), // dashed circle
        () => ({ d: "M-15-8l-9 8l9 8M15-8l9 8l-9 8M4-13l-8 26" }), // </>
        () => ({ d: "M-10-12V12M-10 4Q-10-6 8-6M-13-12a3 3 0 1 0 6 0a3 3 0 1 0-6 0M-13 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0M5-6a3 3 0 1 0 6 0a3 3 0 1 0-6 0" }), // branch
        () => ({ d: "M-24 12Q-4-26 20-6M20-6l-11-1M20-6l-3 10" }) // arrow
    ];

    function generate() {
        w = Math.max(window.innerWidth, screen.width);
        h = Math.max(window.innerHeight, screen.height);
        const cell = 170;
        const out: Placed[] = [];
        for (let r = 0; r * cell < h; r++) {
            for (let c = 0; c * cell < w; c++) {
                if (Math.random() > 0.55) continue;
                out.push({ ...pick(MAKERS)(), x: (c + rnd(0.2, 0.8)) * cell, y: (r + rnd(0.2, 0.8)) * cell, r: rnd(-40, 40), s: rnd(0.8, 1.5) });
            }
        }
        doodles = out;
    }

    // Random on every load; generated in the browser so server and client markup never disagree.
    onMount(() => {
        generate();
        requestAnimationFrame(() => (ready = true));
    });
</script>

{#if doodles.length}
    <svg class="doodles" class:ready width={w} height={h} viewBox="0 0 {w} {h}" aria-hidden="true" focusable="false">
        {#each doodles as o}
            <path
                d={o.d}
                stroke-dasharray={o.dash}
                transform="translate({f(o.x)} {f(o.y)}) rotate({f(o.r)}) scale({o.s.toFixed(2)})"
            />
        {/each}
    </svg>
{/if}

<style>
    :global(body) {
        background: transparent;
    }
    .doodles {
        position: fixed;
        top: 0;
        left: 0;
        max-width: none;
        z-index: -1;
        pointer-events: none;
        color: var(--accent);
        opacity: 0;
        transition: opacity 0.6s ease;
    }
    .doodles.ready {
        opacity: 0.1;
    }
    .doodles path {
        fill: none;
        stroke: currentColor;
        stroke-width: 1.6;
        stroke-linecap: round;
        stroke-linejoin: round;
        vector-effect: non-scaling-stroke;
    }
    @media (prefers-reduced-motion: reduce) {
        .doodles {
            transition: none;
        }
    }
    @media print {
        .doodles {
            display: none;
        }
    }
</style>