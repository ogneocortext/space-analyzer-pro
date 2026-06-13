import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig({
  plugins: [
    vue(),
  ],
  
  resolve: {
    alias: {
      "@": resolve(process.cwd(), "src"),
    },
  },
  
  server: {
    port: 5176,
    strictPort: false,
    host: true,
    open: false,
    cors: true,
  },
  
  build: {
    outDir: "dist",
    sourcemap: false,
  },
  
  // Clear cache and disable optimizations to avoid conflicts
  clearScreen: false,
  optimizeDeps: {
    force: true,
    include: ["vue"],
  },
  
  // Ensure Vue files are processed correctly
  ssr: {
    noExternal: ["vue"],
  },
});