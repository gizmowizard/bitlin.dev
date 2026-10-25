import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { config } from './config.ts';

export const sha256 = (data: string | Uint8Array): string => createHash('sha256').update(data).digest('hex');

export const randomToken = (bytes = 32): string => randomBytes(bytes).toString('base64url');

const key = () => createHash('sha256').update(`bitlin:enc:${config.secret}`).digest();

export function encrypt(plain: string): string {
    const iv = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', key(), iv);
    const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
    return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64');
}

export function decrypt(blob: string): string | null {
    try {
        const buf = Buffer.from(blob, 'base64');
        const d = createDecipheriv('aes-256-gcm', key(), buf.subarray(0, 12));
        d.setAuthTag(buf.subarray(12, 28));
        return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8');
    } catch {
        return null;
    }
}

export function sign(value: string): string {
    const mac = createHmac('sha256', config.secret).update(value).digest('base64url');
    return `${value}.${mac}`;
}

export function unsign(signed: string): string | null {
    const i = signed.lastIndexOf('.');
    if (i < 0) return null;
    const value = signed.slice(0, i);
    const expected = Buffer.from(sign(value));
    const given = Buffer.from(signed);
    return expected.length === given.length && timingSafeEqual(expected, given) ? value : null;
}
