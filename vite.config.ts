// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const isCloudflare =
  process.env["NITRO_PRESET"] === "cloudflare-module" ||
  process.env["NITRO_PRESET"] === "cloudflare-pages" ||
  Boolean(process.env["CF_PAGES"]);

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    ...(isCloudflare ? { target: "cloudflare" } : {}),
  },
  nitro: {
    preset: process.env["NITRO_PRESET"] || (isCloudflare ? "cloudflare-module" : "node-server"),
  },
  vite: {
    plugins: [],
    define: {
      "import.meta.env.VITE_LINE_LIFF_ID": JSON.stringify(
        process.env["VITE_LINE_LIFF_ID"] || process.env["LINE_LIFF_ID"] || "2011710264-gaZ7oEcK",
      ),
    },
  },
});
