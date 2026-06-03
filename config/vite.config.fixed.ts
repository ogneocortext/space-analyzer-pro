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
    rollupOptions: {
      onwarn(warning, warn) {
        // Suppress warnings that might prevent loading
        if (warning.code === "THIS_IS_UNDEFINED") return;
        if (warning.code === "MODULE_LEVEL_DIRECTIVE") return;
        warn(warning);
      },
    },
  },
  optimizeDeps: {
    force: true,
    include: ["vue", "vue-router", "pinia"],
  },
  clearScreen: false,
});
