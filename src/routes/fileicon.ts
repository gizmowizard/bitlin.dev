import type { IconName } from './Icon.svelte';
import { fileExt, IMAGE_TYPES } from '#lib/util.ts';

const CODE = new Set(['js', 'ts', 'jsx', 'tsx', 'svelte', 'vue', 'py', 'rs', 'go', 'java', 'c', 'h', 'cpp', 'cs', 'rb', 'php', 'sh', 'sql', 'css', 'scss', 'html', 'json', 'yaml', 'yml', 'toml', 'kt', 'swift', 'lua']);
const ARCHIVE = new Set(['zip', 'tar', 'gz', 'tgz', '7z', 'rar', 'jar']);

export function fileIcon(path: string): IconName {
    const e = fileExt(path);
    if (IMAGE_TYPES[e]) return 'image';
    if (CODE.has(e)) return 'code';
    if (['md', 'markdown', 'txt', 'rst'].includes(e)) return 'file-text';
    if (ARCHIVE.has(e)) return 'file-archive';
    return 'file';
}
