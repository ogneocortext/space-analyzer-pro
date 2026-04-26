import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

// Vue 3 configuration for performance optimization
export default defineConfig({
  plugins: [
    tailwindcss(),
    vue()
  ],
  root: '.',
  base: '/',
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@components': resolve(__dirname, './src/components'),
      '@hooks': resolve(__dirname, './src/hooks'),
      '@utils': resolve(__dirname, './src/utils'),
      '@services': resolve(__dirname, './src/services'),
      '@styles': resolve(__dirname, './src/styles'),
      '@routes': resolve(__dirname, './src/routes'),
      '@workers': resolve(__dirname, './src/workers'),
      '@types': resolve(__dirname, './src/types'),
      '@store': resolve(__dirname, './src/store'),
      '@lib': resolve(__dirname, './src/lib'),
    },
    // Dedupe common packages to reduce resolution time
    dedupe: ['vue', 'vue-router', 'pinia']
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true, // Clean dist directory before each build
    sourcemap: process.env.NODE_ENV === 'development', // Only enable in dev
    // Vite 8 uses Rolldown's built-in minifier by default
    cssCodeSplit: true,
    copyPublicDir: true, // Copy public assets to dist
    // Advanced chunking for optimal performance - Vite 8 uses Rolldown
    rollupOptions: {
      output: {
        // manualChunks as function for Rolldown compatibility
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('vue') || id.includes('vue-router') || id.includes('pinia')) {
              return 'vue-vendor';
            }
            if (id.includes('lucide-react') || id.includes('framer-motion') || id.includes('cmdk')) {
              return 'ui-vendor';
            }
            if (id.includes('recharts')) {
              return 'charts-vendor';
            }
            if (id.includes('@google/generative-ai') || id.includes('@google/genai')) {
              return 'ai-vendor';
            }
            if (id.includes('date-fns') || id.includes('zod') || id.includes('sonner')) {
              return 'utils-vendor';
            }
          }
        },
        // Optimize chunk naming and hashing
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      },
      // Rolldown tree-shaking options (simplified for Vite 8)
      treeshake: true
    },
    // Performance optimizations
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 500, // More strict warning limit
    // Target modern browsers for better performance
    target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],
    // Enable compressed size reporting for optimization
    reportCompressedSize: true
  },
  server: {
    port: 3001, // Correct port
    strictPort: false,
    host: true,
    open: false,
    cors: true,
    headers: {
      // Permissive CSP for development - allows necessary resources
      'Content-Security-Policy': "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: ws: wss: http: https:; img-src 'self' data: blob: http: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: http: https:; style-src 'self' 'unsafe-inline' data: blob: http: https:; font-src 'self' data: blob: http: https:; connect-src 'self' data: blob: ws: wss: http: https:; worker-src 'self' blob: data:; frame-src 'self' blob:; media-src 'self' data: blob: http: https:;"
    },
    // Optimized proxy configuration
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        secure: false,
        timeout: 30000,
        rewrite: (path) => path,
        // Add retry logic
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('Proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            proxyReq.setHeader('X-Forwarded-Host', req.headers.host || '');
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('Proxy response:', proxyRes.statusCode, req.url);
          });
        }
      }
    }
  },
  // Optimize dependencies - Vite 8 uses Rolldown for pre-bundling
  optimizeDeps: {
    include: [
      'vue',
      'vue-router',
      'pinia',
      'lucide-react',
      'framer-motion',
      'date-fns',
      'zod',
      'sonner',
      'recharts',
      'cmdk'
    ],
    exclude: [],
    // Pre-bundle for faster dev server and builds
    force: false,
    // Hold results in memory to avoid re-processing
    holdUntilCrawlEnd: true
  },
  // Vite 8 uses Rolldown/Oxc for faster builds - minification handled automatically
  // Define global constants for better tree shaking
  define: {
    __DEV__: process.env.NODE_ENV === 'development',
    __PROD__: process.env.NODE_ENV === 'production',
    __VERSION__: JSON.stringify(process.env.npm_package_version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  // Enable CSS optimizations
  css: {
    devSourcemap: process.env.NODE_ENV === 'development',
    // Enable CSS modules optimizations
    modules: {
      localsConvention: 'camelCaseOnly',
      generateScopedName: process.env.NODE_ENV === 'production'
        ? '[hash:base64:8]'
        : '[name]__[local]__[hash:base64:5]'
    },
    // PostCSS for processing (default)
    postcss: {}
  },
  // Worker configuration
  worker: {
    format: 'es',
    plugins: () => [vue()]
  },
  // Preview server configuration
  preview: {
    port: 3002,
    strictPort: true,
    host: true
  }
});
