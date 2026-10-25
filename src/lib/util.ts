export const USERNAME_RE = /^[a-z0-9][a-z0-9_-]{1,31}$/;
export const PROJECT_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
export const TAG_RE = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/;
export const RESERVED_USERNAMES = new Set(['admin', 'administrator', 'bitlin', 'root', 'support', 'system', 'staff', 'null', 'undefined', 'anonymous']);

export const BIO_MAX_WORDS = 300;

export function wordCount(text: string): number {
    const t = text.trim();
    return t ? t.split(/\s+/).length : 0;
}

// Branch rules follow the spirit of git ref names so names stay URL- and shell-friendly.
export function validateBranchName(name: string): string | null {
    if (!name || name.length > 100) return 'Branch names must be 1–100 characters.';
    if (/[\s~^:?*[\\\x00-\x1f\x7f]/.test(name)) return 'Branch names cannot contain spaces or special characters like ~ ^ : ? * [ \\.';
    if (name.startsWith('/') || name.endsWith('/') || name.includes('//')) return 'Branch names cannot start or end with “/” or contain “//”.';
    if (name.startsWith('-') || name.startsWith('.') || name.endsWith('.') || name.endsWith('.lock')) return 'That branch name is not allowed.';
    if (name.includes('..') || name.includes('@{') || name === 'HEAD') return 'That branch name is not allowed.';
    return null;
}

export const userHref = (username: string) => `/*${username}`;
export const projectHref = (owner: string, project: string) => `/*${owner}/${project}`;

export function withRef(href: string, ref?: string | null, defaultRef?: string | null): string {
    if (!ref || ref === defaultRef) return href;
    return `${href}${href.includes('?') ? '&' : '?'}ref=${encodeURIComponent(ref)}`;
}

export const shortId = (id: string | null | undefined) => (id ? id.slice(0, 8) : '');

export function formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    const units = ['KB', 'MB', 'GB'];
    let v = n / 1024;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) {
        v /= 1024;
        i++;
    }
    return `${v >= 10 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`;
}

const RTF = typeof Intl !== 'undefined' ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' }) : null;

export function timeAgo(date: Date | string | number, now = Date.now()): string {
    const diff = (new Date(date).getTime() - now) / 1000;
    const abs = Math.abs(diff);
    if (abs < 45) return 'just now';
    const steps: [number, Intl.RelativeTimeFormatUnit][] = [
        [60, 'second'], [60, 'minute'], [24, 'hour'], [7, 'day'], [4.345, 'week'], [12, 'month'], [Infinity, 'year']
    ];
    let v = diff;
    for (const [div, unit] of steps) {
        if (Math.abs(v) < div) return RTF!.format(Math.round(v), unit);
        v /= div;
    }
    return '';
}

export function fileExt(path: string): string {
    const base = path.split('/').pop() ?? '';
    const i = base.lastIndexOf('.');
    return i > 0 ? base.slice(i + 1).toLowerCase() : '';
}

export const IMAGE_TYPES: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml', ico: 'image/x-icon'
};

export function isValidTimezone(tz: string): boolean {
    try {
        new Intl.DateTimeFormat('en', { timeZone: tz });
        return true;
    } catch {
        return false;
    }
}

export function debounce<A extends unknown[]>(fn: (...a: A) => void, ms: number) {
    let t: ReturnType<typeof setTimeout> | undefined;
    return (...a: A) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...a), ms);
    };
}

export const safeNext = (n: string | null) => (n && /^\/(?!\/)/.test(n) ? n : null);

export function plainText(md: string, max = 200): string {
    const t = md.replace(/```[\s\S]*?```/g, ' ').replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[#>*_`~|-]+/g, ' ').replace(/\s+/g, ' ').trim();
    return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}
