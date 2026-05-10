import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig({
  plugins: [vue()],

  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },

  // Aggressive optimization for fast startup
  optimizeDeps: {
    // Minimal pre-bundling for fastest startup
    include: ["vue"],
    // Exclude everything else to load on demand
    exclude: [
      "vue-router",
      "pinia",
      "three",
      "d3",
      "puppeteer",
      "jspdf",
      "lucide-vue-next",
      "@tauri-apps/api/core",
      "@tauri-apps/plugin-dialog",
      "@tauri-apps/plugin-fs",
      "@tauri-apps/plugin-notification",
    ],
    // Disable force optimization
    force: false,
  },

  server: {
    port: 5178,
    strictPort: true,
    host: true,
    open: false,
    cors: true,
    hmr: {
      overlay: false,
    },
    fs: {
      strict: false,
    },
    watch: {
      usePolling: false,
      interval: 200, // Slightly slower but more stable
    },
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        secure: false,
      },
    },
  },

  // Minimal build config
  build: {
    outDir: "dist",
    sourcemap: false, // Disable for faster builds
    rollupOptions: {
      onwarn(warning, warn) {
        // Suppress all warnings for faster startup
        if (
          warning.code === "SOURCEMAP_ERROR" ||
          (warning.message && warning.message.includes("zodiac-"))
        ) {
          return;
        }
        warn(warning);
      },
    },
    target: "esnext",
    minify: false, // Disable minification for faster builds in dev
    chunkSizeWarningLimit: 1000, // Increase threshold
    reportCompressedSize: false,
  },

  // CSS configuration
  css: {
    devSourcemap: false,
  },

  // Define global constants
  define: {
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
  },
});
