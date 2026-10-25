const env = process.env;

function num(key: string, fallback: number): number {
    const n = Number(env[key]);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

// Read lazily so `vite build` can analyse server modules without a full environment.
export const config = {
    get prod() {
        return env.NODE_ENV === 'production';
    },
    get origin() {
        return (env.ORIGIN ?? 'http://localhost:5173').replace(/\/$/, '');
    },
    get canonicalOrigin() {
        return (env.CANONICAL_ORIGIN ?? 'https://bitlin.dev').replace(/\/$/, '');
    },
    get secret() {
        const s = env.SECRET_KEY;
        if (!s || s.length < 32) {
            if (this.prod) throw new Error('SECRET_KEY must be set (32+ chars)');
            return 'dev-only-secret-key-do-not-use-in-production';
        }
        return s;
    },
    get databaseUrl() {
        return env.DATABASE_URL ?? 'postgres://bitlin:bitlin@localhost:5432/bitlin';
    },
    get redisUrl() {
        return env.REDIS_URL ?? 'redis://localhost:6379';
    },
    get s3() {
        return {
            endPoint: env.S3_ENDPOINT ?? 'localhost',
            port: num('S3_PORT', 9000),
            useSSL: env.S3_USE_SSL === 'true',
            accessKey: env.S3_ACCESS_KEY ?? 'minioadmin',
            secretKey: env.S3_SECRET_KEY ?? 'minioadmin',
            bucket: env.S3_BUCKET ?? 'bitlin'
        };
    },
    get ipHeader() {
        return (env.IP_HEADER ?? 'cf-connecting-ip').toLowerCase();
    },
    get allowPrivateRemotes() {
        return env.ALLOW_PRIVATE_REMOTES === 'true';
    },
    limits: {
        get maxFileBytes() {
            return num('MAX_FILE_MB', 25) * 1024 * 1024;
        },
        get maxFiles() {
            return num('MAX_FILES', 5000);
        },
        get maxUploadBytes() {
            return num('MAX_UPLOAD_MB', 60) * 1024 * 1024;
        },
        get maxUnzipBytes() {
            return num('MAX_UNZIP_MB', 150) * 1024 * 1024;
        },
        maxProjectsPerUser: 200
    },
    oauth(provider: string) {
        const P = provider.toUpperCase();
        const id = env[`${P}_CLIENT_ID`];
        const secret = env[`${P}_CLIENT_SECRET`];
        return id && secret ? { id, secret } : null;
    }
};
