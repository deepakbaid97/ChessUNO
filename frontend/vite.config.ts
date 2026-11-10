/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  let base = env.VITE_BASE_PATH;
  if (!base && env.VITE_APP_BASE_URL) {
    try {
      const url = new URL(env.VITE_APP_BASE_URL);
      if (url.pathname && url.pathname !== '/') {
        base = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
      }
    } catch {}
  }
  if (!base) {
    base = command === 'build' ? '/game/chessUno/' : '/';
  }

  return {
    base,
    plugins: [svelte()],
    build: {
      target: 'es2020',
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('@microsoft/signalr')) {
              return 'signalr';
            }
            if (
              id.includes('/components/chess/') ||
              id.includes('/components/cards/') ||
              id.includes('/components/game/') ||
              id.includes('GameArena.svelte')
            ) {
              return 'arena';
            }
          }
        }
      }
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true
        },
        '/hubs': {
          target: 'http://localhost:5000',
          ws: true
        }
      }
    },
    test: {
      globals: true,
      environment: 'jsdom',
      include: ['src/**/*.test.ts'],
      exclude: ['e2e/**', 'node_modules/**']
    }
  };
});
