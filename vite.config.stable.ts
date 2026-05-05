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

  server: {
    port: 5173,
    strictPort: false, // Allow port to change if 5173 is busy
    host: true,
    open: false, // Don't auto-open browser
    cors: true,

    // Proxy disabled for Tauri - backend is built-in
    // Only enable proxy if explicitly needed for external API
    proxy: {},
  },

  // Simplified build configuration
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["vue", "vue-router", "pinia"],
        },
      },
    },
  },

  // Optimized dependency pre-bundling
  optimizeDeps: {
    include: ["vue", "vue-router", "pinia"],
    force: false, // Don't force rebuild unless needed
  },

  // Simple CSS configuration
  css: {
    devSourcemap: true,
  },

  // Clear define statements
  define: {
    __DEV__: true,
  },
});
