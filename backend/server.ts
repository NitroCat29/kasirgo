// ============================================================
// KasirGo Backend — Entry Point
// ============================================================
// db.ts auto-runs schema + seed on import
import "./db";
import { json, config, validateCsrf, corsHeaders } from "./helpers";
import { resolveHandler } from "./router";

const FRONTEND_DIST = import.meta.dir + "/../frontend/dist";

const MIME: Record<string, string> = {
  html: "text/html; charset=utf-8",
  css: "text/css",
  js: "application/javascript",
  wasm: "application/wasm",
  json: "application/json",
  png: "image/png",
  svg: "image/svg+xml",
  ico: "image/x-icon",
};

// Inject CORS headers into any Response (for endpoints yang build Response manual)
function withCors(res: Response, req: Request): Response {
  for (const [k, v] of Object.entries(corsHeaders(req))) {
    res.headers.set(k, v);
  }
  return res;
}

Bun.serve({
  port: config.port,
  async fetch(req) {
    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(req),
      });
    }

    const url = new URL(req.url);
    const p = url.pathname.split("/").filter(Boolean);

    // ---- API routing ----
    if (url.pathname.startsWith("/api/")) {
      // CSRF validation for state-changing requests
      const csrfExempt = [
        "/api/auth/login",
        "/api/auth/signup",
        "/api/auth/logout",
        "/api/auth/verify-email",
        "/api/auth/resend-verification",
        "/api/auth/forgot-password",
        "/api/auth/verify-reset-code",
        "/api/auth/reset-password",
      ];
      if (!csrfExempt.includes(url.pathname) && !validateCsrf(req)) {
        return withCors(json({ error: "CSRF token tidak valid" }, 403), req);
      }

      const handler = resolveHandler(req, p);
      if (handler) {
        try {
          const res = await handler(req, p);
          return withCors(res, req);
        } catch (err: any) {
          console.error("API error:", err);
          return withCors(json({ error: "Internal server error" }, 500), req);
        }
      }
      return withCors(json({ error: "Not found" }, 404), req);
    }

    // ---- Static file serving from frontend/dist ----
    // Root
    if (url.pathname === "/") {
      const f = Bun.file(FRONTEND_DIST + "/index.html");
      if (await f.exists()) return new Response(f, { headers: { "content-type": "text/html; charset=utf-8" } });
    }

    // Assets with extension
    const ext = url.pathname.match(/\.([a-z]+)$/)?.[1] || "";
    if (ext && MIME[ext]) {
      const f = Bun.file(FRONTEND_DIST + url.pathname);
      if (await f.exists()) return new Response(f, { headers: { "content-type": MIME[ext] } });
    }

    // SPA fallback: serve index.html for client-side routes
    const spa = Bun.file(FRONTEND_DIST + "/index.html");
    if (await spa.exists()) {
      return new Response(spa, { headers: { "content-type": "text/html; charset=utf-8" } });
    }

    return json({ error: "Not found" }, 404, req);
  },
});

console.log(`🚀 Backend KasirGo berjalan di http://localhost:${config.port}`);
