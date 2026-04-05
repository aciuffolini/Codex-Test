import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// Track if we've already warned about the API server (module-level)
let apiServerWarningShown = false;

// Plugin to suppress proxy connection errors
const suppressProxyErrorsPlugin = () => ({
  name: 'suppress-proxy-errors',
  enforce: 'pre',
  configureServer(server) {
    const originalError = server.config.logger.error.bind(server.config.logger);
    server.config.logger.error = (msg, options) => {
      const message = typeof msg === 'string' ? msg :
        msg?.message || (msg instanceof Error ? msg.toString() : String(msg));
      const isProxyError =
        message.includes('http proxy error') ||
        message.includes('proxy error') ||
        (message.includes('ECONNREFUSED') && (
          message.includes('AggregateError') ||
          message.includes('proxy') ||
          message.includes('/api/') ||
          message.includes('localhost:8000')
        ));
      if (isProxyError) {
        if (!apiServerWarningShown) {
          apiServerWarningShown = true;
          server.config.logger.warn('⚠️  vNext gateway not running on port 8000.');
          server.config.logger.warn('   Start with: python -m gateway.app (from next-version/)');
        }
        return;
      }
      originalError(msg, options);
    };
  }
});

export default defineConfig(({ mode }) => {
  const disablePWA = mode === 'android' || process.env.BUILD_TARGET === 'android';
  const isAndroidBuild = mode === 'android' || process.env.BUILD_TARGET === 'android';
  const basePath = isAndroidBuild
    ? './'
    : (process.env.VITE_BASE_PATH || (process.env.NODE_ENV === 'production' ? '/' : '/'));

  return {
    base: basePath,
    resolve: {
      alias: {
        // Point to local shared package (replicated from baseline)
        '@farm-visit/shared': path.resolve(__dirname, '../shared/src'),
      },
    },
    plugins: [
      react(),
      suppressProxyErrorsPlugin(),
      ...(disablePWA ? [] : [
        VitePWA({
          registerType: "autoUpdate",
          base: basePath,
          manifest: {
            name: "Farm Visit App II",
            short_name: "Farm Visit II",
            start_url: basePath,
            scope: basePath,
            display: "standalone",
            background_color: "#ffffff",
            theme_color: "#22c55e",
            orientation: "portrait",
            icons: [
              { src: "pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
              { src: "pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
            ]
          },
          workbox: {
            globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
            navigateFallback: `${basePath}index.html`,
            maximumFileSizeToCacheInBytes: 15 * 1024 * 1024
          }
        })
      ])
    ],
    server: {
      port: 5173,
      strictPort: true,
      host: true,
      open: true,
      proxy: {
        // ★ KEY CHANGE: proxy to vNext gateway on port 8000 instead of baseline on 3000
        "/api": {
          target: "http://localhost:8000",
          changeOrigin: true,
          configure: (proxy, _options) => {
            proxy.on('error', (err, req, res) => {
              const errorMessage = err.message || '';
              if (errorMessage.includes('ECONNREFUSED') || err.code === 'ECONNREFUSED') {
                if (res && !res.headersSent) {
                  res.writeHead(503, {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                  });
                  res.end(JSON.stringify({
                    error: 'vNext gateway unavailable',
                    message: 'Start with: python -m gateway.app (from next-version/)',
                  }));
                }
                return;
              }
              console.error('[Proxy Error]', err.message);
            });
          },
        },
      },
    },
  };
});
