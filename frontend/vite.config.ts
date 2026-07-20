import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ command }) => ({
  base: '/',
  plugins: [solid(), tailwindcss()],
  // Build-time guard: force VITE_DEV_MODE=false di production builds
  ...(command === "build" ? { define: { "import.meta.env.VITE_DEV_MODE": '"false"' } } : {}),
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3456",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@shared": "../shared",
    },
  },
}));
