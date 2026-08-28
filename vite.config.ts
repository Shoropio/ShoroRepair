import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: './',
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
        manifest: {
          name: 'Shoro Repair',
          short_name: 'ShoroRepair',
          description: 'Shoro Repair Management System',
          theme_color: '#0088cc',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      target: 'esnext',
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules')) {
              if (id.includes('firebase') || id.includes('@firebase')) return 'firebase';
              if (id.includes('@google/genai')) return 'ai';
              if (id.includes('recharts') || id.includes('d3')) return 'charts';
              if (id.includes('jspdf')) return 'pdf';
              if (id.includes('dexie')) return 'db';
              if (id.includes('lucide-react') || id.includes('sonner')) return 'ui';
              if (id.includes('qrcode') || id.includes('jsbarcode')) return 'barcode';
              if (id.includes('i18next')) return 'i18n';
              if (
                id.includes('react-router') ||
                id.includes('react-dom') ||
                id.includes('/react/') ||
                id.includes('scheduler')
              ) return 'vendor';
              return 'vendor';
            }
          }
        }
      }
    }
  };
});
