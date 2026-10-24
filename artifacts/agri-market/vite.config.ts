import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vite';

const rawPort = process.env.PORT || '5173';
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Served at the site root by default. Override with BASE_PATH for
// deployment-specific routing.
const basePath = process.env.BASE_PATH || '/';

// Where the API server is reachable during local development.
const apiProxyTarget = process.env.API_PROXY_TARGET || 'http://localhost:5000';

export default defineConfig(async () => {
  return {
  base: basePath,
  plugins: [
    react(),
    tailwindcss({ optimize: true }),
    // Installable PWA for the PUBLIC marketplace + user account only. Admin and
    // the API are excluded from the offline/app-shell behaviour (navigation
    // denylist below) so the admin panel always goes to the network.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'logo.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'le7rithe — السوق الزراعي الموريتاني',
        short_name: 'le7rithe',
        description: 'سوق زراعي موريتاني لبيع وشراء وتأجير الأراضي والآليات والبذور والأسمدة والمنتجات الزراعية.',
        lang: 'ar',
        dir: 'rtl',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f6f1e6',
        theme_color: '#274e3e',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        // Keep admin + API out of the PWA app-shell (admin isn't part of the app).
        navigateFallbackDenylist: [/^\/api/, /^\/admin/],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            // Public read APIs — fresh when online, available when offline.
            urlPattern: ({ url }) =>
              /^\/api\/(listings|categories|banners|locations|market-pulse)/.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'public-api',
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            // Listing / banner images.
            urlPattern: ({ url }) =>
              /^\/api\/(listing-images|banners\/.+\/image)/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
  };
});
