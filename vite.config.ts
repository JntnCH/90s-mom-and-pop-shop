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
      server: { entry: "server" },
      ...(isCloudflare ? { target: "cloudflare" as const } : {}),
    }),
    nitro({ preset: nitroPreset }),
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
    host: "::",
    port: 8080,
  },
  define: {
    "import.meta.env.VITE_LINE_LIFF_ID": JSON.stringify(
      process.env["VITE_LINE_LIFF_ID"] || process.env["LINE_LIFF_ID"] || "2011710264-gaZ7oEcK",
    ),
  },
});
