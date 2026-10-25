import { defineConfig, loadEnv, type Plugin } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-node';

function bitlinWsDev(): Plugin {
    return {
        name: 'bitlin-ws-dev',
        configureServer(server) {
            server.httpServer?.on('upgrade', async (req, socket, head) => {
                if (new URL(req.url ?? '/', 'http://x').pathname !== '/ws') return;
                try {
                    const mod = await server.ssrLoadModule('/src/lib/server/ws/upgrade.ts');
                    await mod.handleUpgrade(req, socket, head);
                } catch (err) {
                    console.error('[ws] dev upgrade failed', err);
                    socket.destroy();
                }
            });
        }
    };
}

export default defineConfig(({ mode }) => {
    Object.assign(process.env, { ...loadEnv(mode, process.cwd(), ''), ...process.env });

    return {
        plugins: [
            sveltekit({
                compilerOptions: {
                    // Force runes mode for the project, except for libraries.
                    runes: ({ filename }) =>
                        filename.split(/[/\\]/).includes('node_modules') ? undefined : true
                },
                adapter: adapter({ precompress: true })
            }),
            bitlinWsDev()
        ],
        build: { target: 'es2022' }
    };
});
