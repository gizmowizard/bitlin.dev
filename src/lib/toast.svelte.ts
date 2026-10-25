export interface Toast {
    id: number;
    text: string;
    kind: 'info' | 'error' | 'success';
    href?: string;
}

export const toasts = $state<Toast[]>([]);
let seq = 0;

export function toast(text: string, kind: Toast['kind'] = 'info', href?: string) {
    const id = ++seq;
    toasts.push({ id, text, kind, href });
    setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 4500);
}

export function dismiss(id: number) {
    const i = toasts.findIndex((t) => t.id === id);
    if (i >= 0) toasts.splice(i, 1);
}
