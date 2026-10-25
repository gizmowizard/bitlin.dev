import ignore from 'ignore';

// These never belong in a snapshot regardless of project rules.
const ALWAYS = ['.git/', '.bitlin/', '.DS_Store', 'Thumbs.db'];

export type IgnoreMatcher = (path: string) => boolean;

export function makeMatcher(rules: string): IgnoreMatcher {
    const ig = ignore().add(ALWAYS).add(rules);
    return (path) => {
        try {
            return ig.ignores(path);
        } catch {
            return false;
        }
    };
}

export function validateRules(rules: string): string | null {
    if (rules.length > 20_000) return 'Ignore rules are too long.';
    if (rules.split('\n').length > 1000) return 'Too many rules (limit 1000 lines).';
    return null;
}
