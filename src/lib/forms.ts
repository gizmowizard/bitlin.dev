import { applyAction, type SubmitFunction } from '$app/forms';
import { toast } from './toast.svelte.ts';

interface Options {
    busy?: (b: boolean) => void;
    success?: string;
    reset?: boolean;
    after?: (data: any) => void;
}

// One submit handler for every form: busy state, toast errors, keep the page in place on success.
export function enhanceForm(opts: Options = {}): SubmitFunction {
    return () => {
        opts.busy?.(true);
        return async ({ result, update }) => {
            opts.busy?.(false);
            if (result.type === 'error') toast(result.error?.message ?? 'Something went wrong.', 'error');
            else if (result.type === 'failure') toast((result.data as any)?.message ?? 'That did not work.', 'error');
            else if (result.type === 'redirect') return applyAction(result);
            else {
                if (opts.success) toast(opts.success, 'success');
                opts.after?.((result as any).data);
            }
            await update({ reset: opts.reset ?? false });
        };
    };
}

export async function api<T = any>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, init);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.message ?? `Request failed (${res.status})`);
    return body as T;
}
