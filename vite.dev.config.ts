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
    },
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: undefined, // Disable code splitting for faster dev
      },
    },
    target: "esnext",
    minify: false, // Disable minification for faster dev builds
    reportCompressedSize: false,
  },
  optimizeDeps: {
    // Minimal dependencies for fastest startup
    include: ["vue"],
    exclude: ["*"],
    force: false,
  },
  css: {
    devSourcemap: false,
  },
});
