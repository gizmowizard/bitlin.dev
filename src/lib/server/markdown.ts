import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

const TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'em', 'strong', 'del', 'hr', 'br', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'input', 'span', 'sup', 'sub', 'details', 'summary'];

function resolveRelative(src: string, rawBase?: string): string | null {
    if (/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(src)) return /^https?:/i.test(src) ? src : null;
    if (!rawBase) return null;
    const parts = src.replace(/^\.?\//, '').split('/');
    if (parts.some((p) => p === '..' || p === '')) return null;
    return `${rawBase}/${parts.map(encodeURIComponent).join('/')}`;
}

export interface MarkdownOptions {
    /** Base URL used to resolve relative image paths (a project's raw file route). */
    rawBase?: string;
}

export function renderMarkdown(source: string, opts: MarkdownOptions = {}): string {
    const html = marked.parse(source, { async: false, gfm: true, breaks: false }) as string;
    return sanitizeHtml(html, {
        allowedTags: TAGS,
        allowedAttributes: {
            a: ['href', 'title'],
            img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
            th: ['align'],
            td: ['align'],
            code: ['class'],
            input: ['type', 'checked', 'disabled']
        },
        allowedClasses: { code: [/^language-[\w-]+$/] },
        allowedSchemes: ['http', 'https', 'mailto'],
        allowProtocolRelative: false,
        transformTags: {
            a: (_t, attribs) => ({
                tagName: 'a',
                attribs: { ...attribs, rel: 'nofollow noopener noreferrer ugc', target: '_blank' }
            }),
            img: (_t, attribs) => {
                const src = resolveRelative(attribs.src ?? '', opts.rawBase);
                return { tagName: 'img', attribs: { ...attribs, src: src ?? '', loading: 'lazy' } };
            }
        },
        exclusiveFilter: (f) => (f.tag === 'img' && !f.attribs.src) || (f.tag === 'input' && f.attribs.type !== 'checkbox')
    });
}
