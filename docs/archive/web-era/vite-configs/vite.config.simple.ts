import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "../src"),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    host: true,
    open: false,
    cors: true,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
  optimizeDeps: {
    force: false,
    disabled: false,
  },
});