import { fileURLToPath } from "node:url";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

// Only continuous integration holds the upload token, so this is off for every
// local build and for anyone's fork. A minified stack trace is a poor error
// report, but a build that fails because a contributor has no Sentry account is
// worse.
const uploadSourceMaps = Boolean(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_PROJECT);

// The design system specimen gallery is a test fixture that happens to be a
// page. It is built only when the visual regression harness asks for it, so no
// deployed bundle carries a second entry point, and nothing a visitor can reach
// renders it (ADR-0012).
const buildSpecimens = process.env.VISUAL === "1";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    ...(uploadSourceMaps
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT,
            authToken: process.env.SENTRY_AUTH_TOKEN,
            // The same commit the bundle reports itself as. If these two ever
            // disagree, Sentry holds readable maps it will never apply to the
            // stack traces they belong to — which looks exactly like not having
            // uploaded them at all.
            release: { name: process.env.VITE_COMMIT_SHA },
            sourcemaps: {
              // Uploaded, then removed from the build output. Serving them
              // would publish the entire source of the application to every
              // visitor, which is a decision worth making deliberately rather
              // than by leaving a default alone.
              filesToDeleteAfterUpload: ["./dist/**/*.map"],
            },
          }),
        ]
      : []),
  ],
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
    ...(buildSpecimens
      ? {
          rollupOptions: {
            input: {
              index: fileURLToPath(new URL("index.html", import.meta.url)),
              specimens: fileURLToPath(new URL("specimens.html", import.meta.url)),
            },
          },
        }
      : {}),
    // `hidden` rather than `true`: the maps are still generated, so they can be
    // uploaded and stack traces stay readable, but no `sourceMappingURL`
    // comment points a browser at them.
    sourcemap: "hidden",
    // Never inline fonts. Vite base64s any asset under 4KB into the stylesheet,
    // which catches the small `latin-ext` subsets — and an inlined @font-face
    // src defeats its own `unicode-range`, so every visitor downloads glyphs
    // they will almost certainly never render, inside the one file that blocks
    // rendering. Kept as separate files they are fetched on demand and cached
    // independently of the CSS.
    assetsInlineLimit: (filePath) => !filePath.endsWith(".woff2"),
  },
});
