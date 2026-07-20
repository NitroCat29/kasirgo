// ============================================================
// KasirGo Backend — Entry Point
// ============================================================
// db.ts auto-runs schema + seed on import
import "./db";
import { json, config, validateCsrf, corsHeaders } from "./helpers";
import { resolveHandler } from "./router";

const FRONTEND_DIST = import.meta.dir + "/../frontend/dist";
const RESOLVED_DIST = Bun.path.resolve(FRONTEND_DIST);

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

// --- Path traversal protection ---
// Decode URL-encoded traversal (%2e%2e, %2f, %5c) then resolve.
// Returns null if path escapes FRONTEND_DIST.
function safeStaticPath(urlPath: string): string | null {
  // Decode percent-encoded chars first (prevents %2e%2e%2f bypass)
  const decoded = decodeURIComponent(urlPath);
  // Reject absolute paths and backslash traversal (Windows)
  if (decoded.startsWith("/") || decoded.includes("\\")) return null;
  // Reject any segment that is or contains ".."
  const segments = decoded.split("/");
  if (segments.some(s => s === ".." || s === "")) return null;
  // Resolve and verify still inside FRONTEND_DIST
  const resolved = Bun.path.resolve(FRONTEND_DIST, decoded);
  if (!resolved.startsWith(RESOLVED_DIST)) return null;
  return resolved;
}

// --- Security headers ---
function securityHeaders(): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    // CSP: allow self + Google Fonts + hCaptcha; restrict everything else
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self' https://js.hcaptcha.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      "connect-src 'self'",
      "frame-src https://hcaptcha.com https://*.hcaptcha.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  };
}

// HSTS only in production (HTTPS)
function hstsHeader(): Record<string, string> {
  return config.cookieSecure
    ? { "Strict-Transport-Security": "max-age=31536000; includeSubDomains" }
    : {};
}

// Apply CORS + security headers to a Response
function withCors(res: Response, req: Request): Response {
  for (const [k, v] of Object.entries(corsHeaders(req))) {
    res.headers.set(k, v);
  }
  for (const [k, v] of Object.entries(securityHeaders())) {
    res.headers.set(k, v);
  }
  for (const [k, v] of Object.entries(hstsHeader())) {
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

    // ---- Static file serving from frontend/dist (production only) ----
    if (!config.devEnv) {
    // Root
    if (url.pathname === "/") {
      const f = Bun.file(FRONTEND_DIST + "/index.html");
      if (await f.exists()) {
        const headers: Record<string, string> = { "content-type": "text/html; charset=utf-8" };
        Object.assign(headers, securityHeaders(), hstsHeader());
        return new Response(f, { headers });
      }
    }

    // Assets with extension — with path traversal protection
    const ext = url.pathname.match(/\.([a-z]+)$/)?.[1] || "";
    if (ext && MIME[ext]) {
      const safe = safeStaticPath(url.pathname);
      if (safe) {
        const f = Bun.file(safe);
        if (await f.exists()) {
          const headers: Record<string, string> = { "content-type": MIME[ext] };
          Object.assign(headers, securityHeaders(), hstsHeader());
          return new Response(f, { headers });
        }
      }
    }

    // SPA fallback: serve index.html for client-side routes
    const spa = Bun.file(FRONTEND_DIST + "/index.html");
    if (await spa.exists()) {
      const headers: Record<string, string> = { "content-type": "text/html; charset=utf-8" };
      Object.assign(headers, securityHeaders(), hstsHeader());
      return new Response(spa, { headers });
    }
    } // end if (!config.devEnv)

    return json({ error: "Not found" }, 404, req);
  },
});

console.log(`🚀 Backend KasirGo berjalan di http://localhost:${config.port}`);
