import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // The token layer imports the shipped design system, which lives outside
    // this app's root. Vite's filesystem guard has to be told the monorepo is
    // fair game.
    fs: { allow: [repoRoot] },
    // Dev proxies /api to Spring Boot so local development has the same
    // single-origin shape as production, where Caddy does this (ADR-0002).
    // Nothing in this codebase should ever need a cross-origin request.
    proxy: {
      "/api": {
        target: process.env.API_ORIGIN ?? "http://localhost:8080",
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    // Never inline fonts. Vite base64s any asset under 4KB into the stylesheet,
    // which catches the small `latin-ext` subsets — and an inlined @font-face
    // src defeats its own `unicode-range`, so every visitor downloads glyphs
    // they will almost certainly never render, inside the one file that blocks
    // rendering. Kept as separate files they are fetched on demand and cached
    // independently of the CSS.
    assetsInlineLimit: (filePath) => !filePath.endsWith(".woff2"),
  },
});
