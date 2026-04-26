import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { visualizer } from 'rollup-plugin-visualizer';

// Enable React Compiler for automatic performance optimization
export default defineConfig({
  plugins: [
    react({
      // Enable React Compiler (React 19+)
      babel: {
        plugins: [
          ['babel-plugin-react-compiler', {}]
        ]
      }
    }),
    // Bundle analyzer for production builds
    process.env.ANALYZE && visualizer({
      filename: 'dist/stats.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
    })
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
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true, // Clean dist directory before each build
    sourcemap: process.env.NODE_ENV === 'development', // Only enable in dev
    minify: 'esbuild',
    cssCodeSplit: true,
    copyPublicDir: true, // Copy public assets to dist
    // Advanced chunking for optimal performance
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React ecosystem
          'react-vendor': ['react', 'react-dom'],

          // State management & data fetching
          'data-vendor': ['@tanstack/react-query', 'zustand'],

          // UI components and icons
          'ui-vendor': ['lucide-react', 'framer-motion', 'cmdk'],

          // Charts and visualization
          'charts-vendor': ['recharts'],

          // AI and ML dependencies
          'ai-vendor': ['@google/generative-ai', '@google/genai'],

          // Utility libraries
          'utils-vendor': ['date-fns', 'zod', 'sonner'],

          // Network and API
          'network-vendor': ['axios', 'socket.io-client']
        },
        // Optimize chunk naming and hashing
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      },
    },
    // Performance optimizations
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 500, // More strict warning limit
    // Target modern browsers for better performance
    target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],
    // Enable compressed size reporting for optimization
    reportCompressedSize: true,
    // Rollup options for better tree-shaking
    rollupOptions: {
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        unknownGlobalSideEffects: false
      }
    }
  },
  server: {
    port: 3001, // Correct port
    strictPort: false,
    host: true,
    open: false,
    cors: true,
    // Optimized proxy configuration
    proxy: {
      '/api': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        secure: false,
        timeout: 30000,
        // Add retry logic
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('Proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            proxyReq.setHeader('X-Forwarded-Host', req.headers.host || '');
          });
        }
      }
    }
  },
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@tanstack/react-query',
      'zustand',
      'lucide-react',
      'framer-motion',
      '@tanstack/react-query-devtools',
      'date-fns',
      'zod',
      'sonner'
    ],
    exclude: [], // Add any problematic deps here
    // Pre-bundle for faster dev server
    force: false,
    // ESBuild options for faster dependency optimization
    esbuildOptions: {
      target: 'es2020',
      // Enable JSX optimizations
      jsxFactory: 'React.createElement',
      jsxFragment: 'React.Fragment',
    }
  },
  // Enhanced esbuild configuration
  esbuild: {
    target: 'es2020',
    // Enable JSX optimizations
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    // Tree shaking optimizations
    treeShaking: true,
    // Minification options
    minifyWhitespace: true,
    minifyIdentifiers: true,
    minifySyntax: true,
    // Keep names for debugging
    keepNames: process.env.NODE_ENV === 'development'
  },
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
    // PostCSS optimizations
    postcss: {},
    // CSS minification
    minify: process.env.NODE_ENV === 'production'
  },
  // Performance and optimization settings
  optimize: {
    // Preload critical dependencies
    preload: ['react', 'react-dom'],
    // Bundle size optimization
    bundleSize: {
      maxSize: '2MB',
      warning: true
    }
  },
  // Worker configuration
  worker: {
    format: 'es',
    plugins: () => [react()]
  },
  // Preview server configuration
  preview: {
    port: 3002,
    strictPort: true,
    host: true
  }
});
