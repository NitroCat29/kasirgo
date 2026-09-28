// ============================================================
// AI Integration Routes — custom vision endpoint (OpenAI-compatible)
// ============================================================
// Konfigurasi disimpan di tabel ai_settings (1 row). Endpoint ini memakai
// standar /v1/chat/completions (OpenAI-compatible) sehingga bisa dipakai
// untuk OpenAI, OpenRouter, Ollama, LM Studio, vLLM, dst.
//
// Endpoint:
//   GET  /api/ai/settings   → { base_url, model, enabled, has_key }
//   POST /api/ai/settings   → simpan { base_url?, api_key?, model?, enabled? }
//   GET  /api/ai/models     → fetch daftar model dari {base_url}/models
//   POST /api/ai/recognize  → vision: gambar → { nama, kategori, merk, satuan }
//   POST /api/ai/barcode    → vision: gambar barcode → { barcode }
//
// Keamanan:
//   - Semua butuh login (getUser) — settings butuh role admin.
//   - api_key TIDAK pernah di-return ke client (hanya has_key boolean).
//   - env AI_BASE_URL / AI_API_KEY / AI_MODEL men-override nilai DB (CI/server).

import { db } from "../db";
import { json, getUser, requireRole, errorResponse, parseBody, clientIp, checkWriteRateLimit } from "../helpers";

type AiSettings = {
  base_url: string;
  api_key: string;
  model: string;
  enabled: number;
};

/** Baca settings: env override DB (berguna untuk deploy tanpa simpan key di DB). */
function readSettings(): AiSettings {
  const row = db.query("SELECT * FROM ai_settings WHERE id = 1").get() as AiSettings | null;
  return {
    base_url: process.env.AI_BASE_URL || row?.base_url || "",
    api_key: process.env.AI_API_KEY || row?.api_key || "",
    model: process.env.AI_MODEL || row?.model || "",
    enabled: row ? row.enabled : 1,
  };
}

/** Normalisasi base URL → tanpa trailing slash, tambah /v1 kalau belum ada. */
function normalizeBaseUrl(raw: string): string {
  let u = (raw || "").trim().replace(/\/+$/, "");
  if (!u) return "";
  // Kalau user isi https://xxx/v1 → biarkan. Kalau belum ada /v1 → tambah.
  if (!/\/v\d+$/.test(u) && !/\/chat\/completions$/.test(u)) u += "/v1";
  return u;
}

/** Timeout fetch standar — supaya UI nggak hang kalau endpoint mati. */
const FETCH_TIMEOUT_MS = 30_000;
async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(t);
  }
}

/** Ambil data URL gambar dari body request ({ image: dataURL }). */
function extractImage(data: any): { image: string; error?: Response } {
  const img = typeof data?.image === "string" ? data.image.trim() : "";
  if (!img) return { image: "", error: json({ error: "Gambar wajib dikirim (field image)" }, 400) };
  if (!img.startsWith("data:image/")) return { image: "", error: json({ error: "Format gambar tidak dikenali" }, 400) };
  return { image: img };
}

/** Panggil chat/completions dengan image + prompt. Return content string. */
async function callVision(
  settings: AiSettings,
  image: string,
  prompt: string,
  opts: { jsonMode?: boolean } = {},
): Promise<{ content: string; error?: Response }> {
  if (!settings.base_url) return { content: "", error: json({ error: "Endpoint AI belum diatur. Buka halaman Integrasi AI." }, 400) };
  if (!settings.api_key) return { content: "", error: json({ error: "API key belum diatur. Buka halaman Integrasi AI." }, 400) };
  if (!settings.model) return { content: "", error: json({ error: "Model belum dipilih. Buka halaman Integrasi AI." }, 400) };

  const url = `${normalizeBaseUrl(settings.base_url)}/chat/completions`;
  const body: Record<string, unknown> = {
    model: settings.model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: image } },
        ],
      },
    ],
    temperature: 0,
    max_tokens: 400,
  };
  if (opts.jsonMode) body.response_format = { type: "json_object" };

  let res: Response;
  try {
    res = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.api_key}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e: any) {
    const msg = e?.name === "AbortError" ? "Timeout: endpoint AI tidak merespons" : `Gagal menghubungi endpoint AI: ${e?.message || e}`;
    return { content: "", error: json({ error: msg }, 502) };
  }

  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    return { content: "", error: json({ error: `Endpoint AI error ${res.status}: ${detail}` }, 502) };
  }

  const jsonRes: any = await res.json().catch(() => null);
  const content = jsonRes?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    return { content: "", error: json({ error: "Endpoint AI tidak mengembalikan konten" }, 502) };
  }
  return { content };
}

/** Parse konten model → object JSON (toleran terhadap ```json fences). */
function parseJsonLoose(text: string): any {
  const stripped = text.replace(/```(?:json)?/gi, "").trim();
  try { return JSON.parse(stripped); } catch {}
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(stripped.slice(start, end + 1)); } catch {}
  }
  return null;
}

export const aiRoutes: Record<string, (req: Request) => Response | Promise<Response>> = {
  // ---- Settings ----
  "GET /api/ai/settings": (req) => {
    const user = getUser(req);
    if (!user) return json({ error: "Belum login" }, 401);
    const s = readSettings();
    return json({
      base_url: s.base_url,
      model: s.model,
      enabled: !!s.enabled,
      has_key: !!s.api_key,
      // kalau key datang dari env, kasih tahu user (tak bisa diedit dari UI)
      key_from_env: !!process.env.AI_API_KEY,
    });
  },

  "POST /api/ai/settings": async (req) => {
    const user = requireRole(req, ["admin"]);
    if (user instanceof Response) return user;
    const rl = checkWriteRateLimit(clientIp(req));
    if (!rl.allowed) return json({ error: "Terlalu banyak request, coba lagi nanti" }, 429);
    const { data, error } = await parseBody(req);
    if (error) return error;

    const current = db.query("SELECT * FROM ai_settings WHERE id = 1").get() as AiSettings | null;
    const next = {
      base_url: normalizeBaseUrl(typeof data?.base_url === "string" ? data.base_url : current?.base_url || ""),
      // api_key: "" = tidak diubah; "-" = hapus
      api_key: typeof data?.api_key === "string"
        ? (data.api_key === "-" ? "" : (data.api_key.trim() || (current?.api_key || "")))
        : (current?.api_key || ""),
      model: typeof data?.model === "string" ? data.model.trim() : (current?.model || ""),
      enabled: data?.enabled === 0 || data?.enabled === false ? 0 : 1,
    };
    db.query(
      `UPDATE ai_settings SET base_url = ?, api_key = ?, model = ?, enabled = ?, updated_at = datetime('now') WHERE id = 1`,
    ).run(next.base_url, next.api_key, next.model, next.enabled);
    return json({ ok: true, has_key: !!next.api_key });
  },

  // ---- Models ----
  "GET /api/ai/models": async (req) => {
    const user = getUser(req);
    if (!user) return json({ error: "Belum login" }, 401);
    const q = new URL(req.url).searchParams;
    const s = readSettings();
    const base = normalizeBaseUrl(q.get("base_url") || s.base_url);
    if (!base) return json({ error: "Isi endpoint dulu, lalu klik Muat Model" }, 400);

    try {
      const res = await fetchWithTimeout(`${base}/models`, {
        headers: { Authorization: `Bearer ${s.api_key || (q.get("api_key") || "")}` },
      });
      if (!res.ok) {
        const detail = (await res.text().catch(() => "")).slice(0, 300);
        return json({ error: `Gagal memuat model (${res.status}): ${detail}` }, 502);
      }
      const j: any = await res.json();
      const list: string[] = Array.isArray(j?.data)
        ? j.data.map((m: any) => (typeof m === "string" ? m : m?.id)).filter((x: any) => typeof x === "string" && x)
        : Array.isArray(j?.models)
          ? j.models.map((m: any) => (typeof m === "string" ? m : m?.name)).filter((x: any) => typeof x === "string" && x)
          : [];
      return json({ models: list.sort() });
    } catch (e: any) {
      const msg = e?.name === "AbortError" ? "Timeout: endpoint tidak merespons" : (e?.message || "Gagal menghubungi endpoint");
      return json({ error: msg }, 502);
    }
  },

  // ---- Vision: isi form produk ----
  "POST /api/ai/recognize": async (req) => {
    const user = getUser(req);
    if (!user) return json({ error: "Belum login" }, 401);
    const { data, error } = await parseBody(req);
    if (error) return error;
    const img = extractImage(data);
    if (img.error) return img.error;

    const prompt = `Foto ini menampilkan produk retail/UMKM. Ekstrak datanya.
Balas HANYA dengan JSON valid (tanpa teks lain):
{"nama":"nama produk (maks 80 char, Bahasa Indonesia)","kategori":"jenis/kategori produk","merk":"merek/brand, kosongkan jika tidak ada","satuan":"satuan jual, mis. pcs, pack, botol, kg, lembar"}
Jangan mengarang nama produk yang tidak terlihat. Jika produk tidak jelas, tetap isi sebaik mungkin dari apa yang terlihat.`;

    const { content, error: callErr } = await callVision(readSettings(), img.image, prompt, { jsonMode: true });
    if (callErr) return callErr;

    const parsed = parseJsonLoose(content) || {};
    return json({
      nama: String(parsed.nama || "").slice(0, 80),
      kategori: String(parsed.kategori || "").slice(0, 60),
      merk: String(parsed.merk || "").slice(0, 60),
      satuan: String(parsed.satuan || "").slice(0, 30),
    });
  },

  // ---- Vision: baca barcode ----
  "POST /api/ai/barcode": async (req) => {
    const user = getUser(req);
    if (!user) return json({ error: "Belum login" }, 401);
    const { data, error } = await parseBody(req);
    if (error) return error;
    const img = extractImage(data);
    if (img.error) return img.error;

    const prompt = `Foto ini memperlihatkan barcode / kode batang pada produk.
Balas HANYA dengan JSON valid: {"barcode":"angka/kode barcode yang terbaca"}
Jika tidak ada barcode yang terbaca, balas {"barcode":""}. Jangan mengarang angka.`;

    const { content, error: callErr } = await callVision(readSettings(), img.image, prompt, { jsonMode: true });
    if (callErr) return callErr;

    const parsed = parseJsonLoose(content) || {};
    const barcode = String(parsed.barcode || "").replace(/[^A-Za-z0-9\-]/g, "").slice(0, 64);
    return json({ barcode });
  },
};
