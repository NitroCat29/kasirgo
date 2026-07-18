import { randomUUID } from "node:crypto";
import { db } from "../db";
import { json, parseBody, requireRole, assertCanWrite, logAudit, deductWallet, clientIp, checkWriteRateLimit, checkIdempotency } from "../helpers";
import { validateProdukCreate, validateProdukUpdate } from "../../shared/validation";
import { searchCacheGet, searchCacheSet, searchCacheInvalidateToko } from "../cache";

// Satuan whitelist (canonical) — case-insensitive accept, store canonical
const SATUAN_CANON = ["Pcs", "Pack", "Rim", "Ikat"];
function normalizeSatuan(v: string | undefined): string {
  if (!v) return "";
  const t = v.trim();
  const i = SATUAN_CANON.findIndex((s) => s.toLowerCase() === t.toLowerCase());
  return i === -1 ? t : SATUAN_CANON[i];
}

// Generate SKU: PRD-{5 consonants from nama}-{5 digit unique number}
function generateSku(nama: string): string {
  const consonants = nama
    .toUpperCase()
    .replace(/[^A-Z]/g, "")       // strip non-letters
    .replace(/[AEIOU]/g, "");     // strip vowels
  const code = (consonants + "XXXXX").slice(0, 5); // pad to 5
  const prefix = `PRD-${code}-`;
  // Find max existing number for this prefix
  const row = db.query("SELECT sku FROM produk WHERE sku LIKE ? ORDER BY sku DESC LIMIT 1").get(`${prefix}%`) as any;
  let next = 1;
  if (row) {
    const match = row.sku.match(/(\d{5})$/);
    if (match) next = Number(match[1]) + 1;
  }
  return `${prefix}${String(next).padStart(5, "0")}`;
}

// ============================================================
// Produk Routes
// ============================================================
export const produkRoutes: Record<string, (req: Request, path: string[]) => Response | Promise<Response>> = {
  // Search endpoint untuk combobox (Fase 1: restock mode detection)
  "GET /api/produk/search": (req) => {
    const user = requireRole(req, ["admin", "manajer", "kasir"]);
    if (user instanceof Response) return user;
    const url = new URL(req.url);
    const q = url.searchParams.get("q") || "";
    const requestedLimit = Number.parseInt(url.searchParams.get("limit") || "8", 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 20) : 8;
    
    if (!q.trim()) {
      return json([]);
    }
    
    const query = `%${q}%`;
    const rows = db.query(`
      SELECT
        p.id, p.nama, p.merk, p.kategori, p.satuan, p.harga, p.harga_modal, p.stok, p.stock_threshold, p.toko_id,
        t.nama as toko_nama
      FROM produk p
      LEFT JOIN toko t ON p.toko_id = t.id
      WHERE p.nama LIKE ? COLLATE NOCASE
      ORDER BY p.nama
      LIMIT ?
    `).all(query, limit);
    
    return json(rows);
  },

  "GET /api/produk": (req) => {
    const user = requireRole(req, ["admin", "manajer", "kasir"]);
    if (user instanceof Response) return user;
    const url = new URL(req.url);
    const tokoId = url.searchParams.get("toko_id") || "";
    const search = url.searchParams.get("search");
    let rows;
    let cacheHit = false;
    if (search) {
      // Cek cache dulu (per toko + query) — skip cache kalau tokoId kosong
      if (tokoId) {
        const cached = searchCacheGet<unknown[]>(tokoId, search);
        if (cached) {
          const res = json(cached);
          res.headers.set("x-cache-hit", "true");
          return res;
        }
      }
      const q = `%${search}%`;
      rows = tokoId
        ? db.query("SELECT * FROM produk WHERE toko_id = ? AND (nama LIKE ? COLLATE NOCASE OR sku LIKE ? COLLATE NOCASE) ORDER BY nama LIMIT 20").all(tokoId, q, q)
        : db.query("SELECT * FROM produk WHERE nama LIKE ? COLLATE NOCASE OR sku LIKE ? COLLATE NOCASE ORDER BY nama LIMIT 20").all(q, q);
      if (tokoId) searchCacheSet(tokoId, search, rows);
    } else {
      rows = tokoId
        ? db.query("SELECT * FROM produk WHERE toko_id = ? ORDER BY created_at DESC").all(tokoId)
        : db.query("SELECT * FROM produk ORDER BY created_at DESC").all();
    }
    const res = json(rows);
    if (search) res.headers.set("x-cache-hit", "false");
    return res;
  },

  "GET /api/produk/:id": (req, path) => {
    const user = requireRole(req, ["admin", "manajer", "kasir"]);
    if (user instanceof Response) return user;
    const row = db.query("SELECT * FROM produk WHERE id = ?").get(path[2]);
    if (!row) return json({ error: "Produk tidak ditemukan" }, 404);
    return json(row);
  },

  "POST /api/produk": async (req) => {
    const user = requireRole(req, ["admin", "manajer"]);
    if (user instanceof Response) return user;
    const writeBlocked = assertCanWrite(user);
    if (writeBlocked) return writeBlocked;
    const rl = checkWriteRateLimit(clientIp(req));
    if (!rl.allowed) return json({ error: "Terlalu banyak request, coba lagi nanti" }, 429);
    const idemKey = req.headers.get("x-idempotency-key");
    if (idemKey) {
      const idem = checkIdempotency(idemKey);
      if (!idem.allowed) return json({ error: "Request duplikat terdeteksi" }, 409);
    }
    const { data: body, error } = await parseBody(req);
    if (error) return error;
    const v = validateProdukCreate(body);
    if (!v.ok) return json({ error: v.error }, 400);
    // Validasi toko exists (only if toko_id provided)
    const tokoId = v.data.toko_id || "";
    if (tokoId) {
      const toko = db.query("SELECT id FROM toko WHERE id = ?").get(tokoId);
      if (!toko) return json({ error: "Toko tidak ditemukan" }, 400);
    }

    const qty = v.data.stok || 0;
    const modal = v.data.harga_modal || 0;
    const totalCost = qty * modal;
    const id = randomUUID();
    const sku = v.data.sku || generateSku(v.data.nama);

    db.run("BEGIN");
    try {
      db.run(
        "INSERT INTO produk (id, toko_id, sku, nama, merk, kategori, satuan, harga, harga_modal, stok, stock_threshold) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [id, tokoId, sku, v.data.nama, v.data.merk || "", v.data.kategori || "", normalizeSatuan(v.data.satuan), v.data.harga || 0, modal, qty, v.data.stock_threshold ?? 10]
      );
      if (totalCost > 0) {
        const deduction = deductWallet(user.id, totalCost, `Pembelian stok awal: ${v.data.nama} (${qty} @ ${modal})`);
        if (!deduction.ok) {
          db.run("ROLLBACK");
          return json({ error: deduction.error }, 402);
        }
      }
      db.run("COMMIT");
    } catch (err: any) {
      db.run("ROLLBACK");
      console.error("POST /api/produk error:", err);
      return json({ error: "Gagal menyimpan produk" }, 500);
    }

    logAudit({ user_id: user.id, username: user.username, action: "CREATE", entity_type: "produk", entity_id: id, details: { nama: v.data.nama, toko_id: tokoId, harga_modal: modal, stok: qty, cost: totalCost } });
    if (tokoId) searchCacheInvalidateToko(tokoId);
    const row = db.query("SELECT * FROM produk WHERE id = ?").get(id);
    return json(row, 201);
  },

  // ---- POST /api/produk/restock — tambah stok + potong saldo wallet ----
  "POST /api/produk/restock": async (req) => {
    const user = requireRole(req, ["admin", "manajer"]);
    if (user instanceof Response) return user;
    const writeBlocked = assertCanWrite(user);
    if (writeBlocked) return writeBlocked;
    const rl = checkWriteRateLimit(clientIp(req));
    if (!rl.allowed) return json({ error: "Terlalu banyak request, coba lagi nanti" }, 429);
    const idemKey = req.headers.get("x-idempotency-key");
    if (idemKey) {
      const idem = checkIdempotency(idemKey);
      if (!idem.allowed) return json({ error: "Request duplikat terdeteksi" }, 409);
    }
    const { data: body, error } = await parseBody(req);
    if (error) return error;
    const produkId = body.produk_id;
    const qty = Number(body.qty);
    const modal = Number(body.harga_modal);
    if (!produkId || typeof produkId !== "string") return json({ error: "produk_id wajib diisi" }, 400);
    if (!Number.isFinite(qty) || qty <= 0) return json({ error: "qty harus angka > 0" }, 400);
    if (!Number.isFinite(modal) || modal < 0) return json({ error: "harga_modal harus angka >= 0" }, 400);

    const e = db.query("SELECT * FROM produk WHERE id = ?").get(produkId) as any;
    if (!e) return json({ error: "Produk tidak ditemukan" }, 404);

    const totalCost = qty * modal;
    db.run("BEGIN");
    try {
      db.run("UPDATE produk SET stok = stok + ? WHERE id = ?", qty, produkId);
      if (totalCost > 0) {
        const deduction = deductWallet(user.id, totalCost, `Restock: ${e.nama} (+${qty} @ ${modal})`);
        if (!deduction.ok) {
          db.run("ROLLBACK");
          return json({ error: deduction.error }, 402);
        }
      }
      db.run("COMMIT");
    } catch (err: any) {
      db.run("ROLLBACK");
      console.error("POST /api/produk/restock error:", err);
      return json({ error: "Gagal restock produk" }, 500);
    }

    logAudit({ user_id: user.id, username: user.username, action: "UPDATE", entity_type: "produk", entity_id: produkId, details: { nama: e.nama, restock_qty: qty, harga_modal: modal, cost: totalCost } });
    searchCacheInvalidateToko(e.toko_id);
    const row = db.query("SELECT * FROM produk WHERE id = ?").get(produkId);
    return json(row);
  },

  "POST /api/produk/bulk": async (req) => {
    const user = requireRole(req, ["admin", "manajer"]);
    if (user instanceof Response) return user;
    const writeBlocked = assertCanWrite(user);
    if (writeBlocked) return writeBlocked;
    const rl = checkWriteRateLimit(clientIp(req));
    if (!rl.allowed) return json({ error: "Terlalu banyak request, coba lagi nanti" }, 429);

    const { data: body, error } = await parseBody(req);
    if (error) return error;

    if (!Array.isArray(body.items)) {
      return json({ error: "items harus array" }, 400);
    }

    const results = { created: 0, errors: [] as string[] };
    const affectedTokoIds = new Set<string>();

    for (let i = 0; i < body.items.length; i++) {
      const item = body.items[i];
      try {
        // Validasi field required
        if (!item.nama || !item.nama.trim()) {
          results.errors.push(`Item ${i + 1}: nama wajib diisi`);
          continue;
        }

        // Resolve toko_id: optional, support lookup by nama
        let tokoId = "";
        if (item.toko_id && item.toko_id.trim()) {
          tokoId = item.toko_id;
          if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tokoId)) {
            const tokoByName = db.query("SELECT id FROM toko WHERE nama = ? COLLATE NOCASE").get(item.toko_id);
            if (!tokoByName) {
              results.errors.push(`Item ${i + 1}: Toko '${item.toko_id}' tidak ditemukan`);
              continue;
            }
            tokoId = (tokoByName as any).id;
          } else {
            const toko = db.query("SELECT id FROM toko WHERE id = ?").get(tokoId);
            if (!toko) {
              results.errors.push(`Item ${i + 1}: Toko dengan ID '${tokoId}' tidak ditemukan`);
              continue;
            }
          }
        }

        const id = randomUUID();
        const sku = item.sku || generateSku(item.nama);
        const harga = Number(item.harga) || 0;
        const harga_modal = item.harga_modal !== undefined ? Number(item.harga_modal) : 0;
        const stok = Number(item.stok) || 0;
        const stock_threshold = item.stock_threshold !== undefined ? Number(item.stock_threshold) : 10;

        db.run(
          "INSERT INTO produk (id, toko_id, sku, nama, merk, kategori, satuan, harga, harga_modal, stok, stock_threshold) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [id, tokoId, sku, item.nama, item.merk || "", item.kategori || "", normalizeSatuan(item.satuan), harga, harga_modal, stok, stock_threshold]
        );

        logAudit({ user_id: user.id, username: user.username, action: "CREATE", entity_type: "produk", entity_id: id, details: { nama: item.nama, toko_id: tokoId } });
        affectedTokoIds.add(tokoId);
        results.created++;
      } catch (err: any) {
        results.errors.push(`Item ${i + 1}: ${err.message}`);
      }
    }

    // Invalidate cache for affected toko
    for (const tokoId of affectedTokoIds) {
      searchCacheInvalidateToko(tokoId);
    }

    return json(results, 201);
  },

  "PATCH /api/produk/:id": async (req, path) => {
    const user = requireRole(req, ["admin", "manajer"]);
    if (user instanceof Response) return user;
    const writeBlocked = assertCanWrite(user);
    if (writeBlocked) return writeBlocked;
    const rl = checkWriteRateLimit(clientIp(req));
    if (!rl.allowed) return json({ error: "Terlalu banyak request, coba lagi nanti" }, 429);
    const id = path[2];
    const e = db.query("SELECT * FROM produk WHERE id = ?").get(id) as any;
    if (!e) return json({ error: "Produk tidak ditemukan" }, 404);
    const { data: body, error } = await parseBody(req);
    if (error) return error;
    const v = validateProdukUpdate(body);
    if (!v.ok) return json({ error: v.error }, 400);
    db.run("UPDATE produk SET nama=?, sku=?, merk=?, kategori=?, satuan=?, harga=?, harga_modal=?, stok=?, stock_threshold=? WHERE id=?", [
      v.data.nama ?? e.nama, v.data.sku ?? e.sku, v.data.merk ?? e.merk ?? "", v.data.kategori ?? e.kategori ?? "", v.data.satuan ?? e.satuan ?? "", v.data.harga ?? e.harga, v.data.harga_modal ?? e.harga_modal, v.data.stok ?? e.stok, v.data.stock_threshold ?? e.stock_threshold, id,
    ]);
    logAudit({ user_id: user.id, username: user.username, action: "UPDATE", entity_type: "produk", entity_id: id, details: { nama: v.data.nama || e.nama, stok: v.data.stok ?? e.stok } });
    searchCacheInvalidateToko(e.toko_id);
    const row = db.query("SELECT * FROM produk WHERE id = ?").get(id);
    return json(row);
  },

  "DELETE /api/produk/:id": (req, path) => {
    const user = requireRole(req, ["admin", "manajer"]);
    if (user instanceof Response) return user;
    const writeBlocked = assertCanWrite(user);
    if (writeBlocked) return writeBlocked;
    const rl = checkWriteRateLimit(clientIp(req));
    if (!rl.allowed) return json({ error: "Terlalu banyak request, coba lagi nanti" }, 429);
    const id = path[2];
    const existing = db.query("SELECT nama, toko_id FROM produk WHERE id = ?").get(id) as any;
    if (!existing) return json({ error: "Produk tidak ditemukan" }, 404);
    const r = db.run("DELETE FROM produk WHERE id = ?", [id]);
    if (r.changes === 0) return json({ error: "Produk tidak ditemukan" }, 404);
    searchCacheInvalidateToko(existing.toko_id || "");
    logAudit({ user_id: user.id, username: user.username, action: "DELETE", entity_type: "produk", entity_id: id, details: { nama: existing.nama } });
    return json({ ok: true });
  },
};
