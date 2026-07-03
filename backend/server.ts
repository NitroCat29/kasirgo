// ============================================================
// KasirGo Backend — Entry Point
// ============================================================
// db.ts auto-runs schema + seed on import
import "./db";
import { json, config, validateCsrf } from "./helpers";
import { resolveHandler } from "./router";

const ROOT = import.meta.dir + "/..";

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

Bun.serve({
  port: config.port,
  async fetch(req) {
    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "access-control-allow-origin": config.corsOrigin,
          "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
          "access-control-allow-headers": "content-type,x-csrf-token",
          "access-control-allow-credentials": "true",
        },
      });
    }

    const url = new URL(req.url);
    const p = url.pathname.split("/").filter(Boolean);

    // ---- Static file serving ----
    if (url.pathname === "/") {
      return new Response(Bun.file(ROOT + "/index.html"), {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    const ext = url.pathname.match(/\.([a-z]+)$/)?.[1] || "";
    if (ext && MIME[ext]) {
      const f = Bun.file(ROOT + url.pathname);
      if (await f.exists()) {
        return new Response(f, { headers: { "content-type": MIME[ext] } });
      }
    }

    // Clean URL: /login → /login.html, /dashboard → /dashboard.html
    if (!ext) {
      const htmlFile = Bun.file(ROOT + url.pathname + ".html");
      if (await htmlFile.exists()) {
        return new Response(htmlFile, { headers: { "content-type": "text/html; charset=utf-8" } });
      }
    }

    // ---- CSRF validation for API state-changing requests ----
    // Skip CSRF for auth endpoints (login/signup issue the token)
    const csrfExempt = ["/api/auth/login", "/api/auth/signup", "/api/auth/logout"];
    if (url.pathname.startsWith("/api/") && !csrfExempt.includes(url.pathname) && !validateCsrf(req)) {
      return json({ error: "CSRF token tidak valid" }, 403);
    }

    // ---- API routing ----
    const handler = resolveHandler(req, p);

    let res: Response;
    try {
      res = handler
        ? await handler(req, p)
        : json({ error: "Not found" }, 404);
    } catch (e: any) {
      res = json({ error: e.message }, 500);
    }

    // Custom 404.html for browser requests
    if (res.status === 404 && req.headers.get("accept")?.includes("text/html")) {
      const f404 = Bun.file(ROOT + "/404.html");
      if (await f404.exists()) {
        res = new Response(f404, { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
      }
    }

    res.headers.set("access-control-allow-origin", config.corsOrigin);
    res.headers.set("access-control-allow-credentials", "true");
    return res;
  },
});

console.log(`🚀 Backend KasirGo berjalan di http://localhost:${config.port}`);
