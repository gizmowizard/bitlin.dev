export type ThemePref = 'system' | 'light' | 'dark';

const KEY = 'bitlin-theme';
const QUERY = '(prefers-color-scheme: dark)';

export const theme = $state<{ pref: ThemePref }>({ pref: 'system' });

function resolve(pref: ThemePref): 'light' | 'dark' {
    if (pref === 'system') return matchMedia(QUERY).matches ? 'dark' : 'light';
    return pref;
}

function apply() {
    document.documentElement.dataset.theme = resolve(theme.pref);
}

function stored(): ThemePref {
    try {
        const v = localStorage.getItem(KEY);
        if (v === 'light' || v === 'dark') return v;
    } catch {
    }
    return 'system';
}

export function initTheme(): () => void {
    theme.pref = stored();
    apply();
    const mq = matchMedia(QUERY);
    const onChange = () => {
        if (theme.pref === 'system') apply();
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
}

export function setTheme(pref: ThemePref) {
    theme.pref = pref;
    try {
        if (pref === 'system') localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, pref);
    } catch {
    }
    apply();
}
