import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const isCloudflare =
  process.env["NITRO_PRESET"] === "cloudflare-module" ||
  process.env["NITRO_PRESET"] === "cloudflare-pages" ||
  Boolean(process.env["CF_PAGES"]);

const nitroPreset =
  process.env["NITRO_PRESET"] || (isCloudflare ? "cloudflare-module" : "node-server");

// Prevent nitro:main from overriding Vite's dev server port (3000) with Cloud Run's PORT=8080
if (process.env["NODE_ENV"] !== "production") {
  process.env["PORT"] = "3000";
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    tanstackStart({
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
      // Redirect TanStack Start's bundled server entry to src/server.ts (SSR error wrapper)
      server: { entry: "server" },
      ...(isCloudflare ? { target: "cloudflare" as const } : {}),
    }),
    // Critical: disable Nitro's default renderer so TanStack Start shellComponent + Scripts work.
    // Without this, production serves the raw index.html template (white screen).
    nitro({
      preset: nitroPreset,
      // @ts-expect-error nitro vite plugin accepts renderer option used by TanStack Start
      renderer: false,
    }),
    react(),
  ],
  resolve: {
    tsconfigPaths: true,
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: true,
  },
  define: {
    "import.meta.env.VITE_LINE_LIFF_ID": JSON.stringify(
      process.env["VITE_LINE_LIFF_ID"] || process.env["LINE_LIFF_ID"] || "2011710264-gaZ7oEcK",
    ),
  },
});
