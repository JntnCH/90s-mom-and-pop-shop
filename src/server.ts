import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);
    if (url.pathname === "/api/health" || url.pathname === "/healthz") {
      return new Response(
        JSON.stringify({
          status: "ok",
          service: "โชห่วยยุค90s",
          uptime: typeof process !== "undefined" && process.uptime ? process.uptime() : 0,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-cache, no-store, must-revalidate",
          },
        },
      );
    }

    // Serve LINE PNG Image Messages for Messaging API & LIFF Target Picker
    if (url.pathname.startsWith("/api/line-image")) {
      const { getLineImage, storeLineImageFromBase64 } = await import("./lib/line-image-storage");

      // Handle upload of image (POST /api/line-image/upload)
      if (url.pathname === "/api/line-image/upload" && request.method === "POST") {
        try {
          const body = (await request.json()) as { imageBase64?: string; id?: string };
          if (!body.imageBase64) {
            return new Response(
              JSON.stringify({ success: false, error: "imageBase64 is required" }),
              { status: 400, headers: { "content-type": "application/json" } },
            );
          }

          const imageId = storeLineImageFromBase64(body.imageBase64, body.id);
          const proto =
            request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "") || "https";
          const host =
            request.headers.get("x-forwarded-host") || request.headers.get("host") || url.host;
          const imageUrl = `${proto}://${host}/api/line-image/${imageId}.png`;

          return new Response(JSON.stringify({ success: true, imageId, imageUrl }), {
            status: 200,
            headers: {
              "content-type": "application/json",
              "access-control-allow-origin": "*",
            },
          });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: String(err) }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      }

      // Handle retrieve of image (GET /api/line-image/:id[.png])
      if (request.method === "GET") {
        const pathParts = url.pathname.split("/").filter(Boolean);
        const filename = pathParts[pathParts.length - 1] || "";
        const stored = getLineImage(filename);

        if (stored) {
          return new Response(new Uint8Array(stored.buffer), {
            status: 200,
            headers: {
              "content-type": stored.contentType || "image/png",
              "cache-control": "public, max-age=604800, immutable",
              "content-disposition": `inline; filename="${filename}"`,
              "access-control-allow-origin": "*",
            },
          });
        }

        return new Response("Image not found or expired", {
          status: 404,
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      }
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
