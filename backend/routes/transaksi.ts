import { randomUUID } from "node:crypto";
import { db } from "../db";
import { json, parseBody, requireRole, assertCanWrite, logAudit, clientIp, checkWriteRateLimit, checkIdempotency } from "../helpers";
import { validateTransaksiCreate, validateTransaksiUpdate } from "../../shared/validation";

// ============================================================
// Transaksi Routes
// ============================================================
export const transaksiRoutes: Record<string, (req: Request, path: string[]) => Response | Promise<Response>> = {
  "GET /api/transaksi": (req) => {
    const user = requireRole(req, ["admin", "manajer", "kasir"]);
    if (user instanceof Response) return user;
    const url = new URL(req.url);
    const tokoId = url.searchParams.get("toko_id");
    const rows = tokoId
      ? db.query("SELECT * FROM transaksi WHERE toko_id = ? ORDER BY created_at DESC LIMIT 50").all(tokoId)
      : db.query("SELECT * FROM transaksi ORDER BY created_at DESC LIMIT 50").all();
    return json(rows);
  },

  "GET /api/transaksi/:id": (req, path) => {
    const user = requireRole(req, ["admin", "manajer", "kasir"]);
    if (user instanceof Response) return user;
    const row = db.query("SELECT * FROM transaksi WHERE id = ?").get(path[2]);
    if (!row) return json({ error: "Transaksi tidak ditemukan" }, 404);
    return json(row);
  },

  "POST /api/transaksi": async (req) => {
    const user = requireRole(req, ["admin", "manajer", "kasir"]);
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
    const v = validateTransaksiCreate(body);
    if (!v.ok) return json({ error: v.error }, 400);
    const toko = db.query("SELECT id FROM toko WHERE id = ?").get(v.data.toko_id);
    if (!toko) return json({ error: "Toko tidak ditemukan" }, 400);

    // Validate & prepare items — each item: { produk_id?, nama, harga, qty, diskon }
    const items = v.data.items as any[];
    if (items.length === 0) return json({ error: "Minimal 1 item diperlukan" }, 400);

    // Stock check: if items have produk_id, validate stock
    const stockErrors: string[] = [];
    for (const item of items) {
      if (!item.nama || !item.harga || !item.qty) {
        return json({ error: "Setiap item wajib punya nama, harga, qty" }, 400);
      }
      if (item.diskon !== undefined && (typeof item.diskon !== "number" || item.diskon < 0 || item.diskon > 100)) {
        return json({ error: `Diskon item '${item.nama}' harus 0-100` }, 400);
      }
      // Normalize diskon default
      item.diskon = item.diskon ?? 0;
      if (item.produk_id) {
        const produk = db.query("SELECT id, nama, stok FROM produk WHERE id = ? AND toko_id = ?").get(item.produk_id, v.data.toko_id) as any;
        if (!produk) {
          stockErrors.push(`Produk '${item.nama}' tidak ditemukan di toko ini`);
        } else if (produk.stok < item.qty) {
          stockErrors.push(`Stok '${produk.nama}' tidak cukup (tersisa: ${produk.stok}, diminta: ${item.qty})`);
        }
      }
    }
    if (stockErrors.length > 0) return json({ error: stockErrors.join("; ") }, 400);

    // Deduct stock for items with produk_id (atomic via transaction)
    db.run("BEGIN");
    try {
      for (const item of items) {
        if (item.produk_id) {
          db.run("UPDATE produk SET stok = stok - ? WHERE id = ?", [item.qty, item.produk_id]);
        }
      }
      const id = randomUUID();
      db.run(
        "INSERT INTO transaksi (id, toko_id, total, tax_rate, discount_rate, items_json) VALUES (?, ?, ?, ?, ?, ?)",
        [id, v.data.toko_id, v.data.total, v.data.tax_rate ?? 11, v.data.discount_rate ?? 0, JSON.stringify(items)]
      );
      db.run("COMMIT");
      logAudit({ user_id: user.id, username: user.username, action: "CREATE", entity_type: "transaksi", entity_id: id, details: { total: v.data.total, toko_id: v.data.toko_id, item_count: items.length } });
      const row = db.query("SELECT * FROM transaksi WHERE id = ?").get(id);
      return json(row, 201);
    } catch (err: any) {
      db.run("ROLLBACK");
      console.error("Transaksi error:", err);
      return json({ error: "Gagal menyimpan transaksi" }, 500);
    }
  },

  "PATCH /api/transaksi/:id": async (req, path) => {
    const user = requireRole(req, ["admin", "manajer"]);
    if (user instanceof Response) return user;
    const writeBlocked = assertCanWrite(user);
    if (writeBlocked) return writeBlocked;
    const id = path[2];
    const e = db.query("SELECT * FROM transaksi WHERE id = ?").get(id) as any;
    if (!e) return json({ error: "Transaksi tidak ditemukan" }, 404);
    const { data: body, error } = await parseBody(req);
    if (error) return error;
    const v = validateTransaksiUpdate(body);
    if (!v.ok) return json({ error: v.error }, 400);
    db.run("UPDATE transaksi SET total=?, tax_rate=?, discount_rate=?, items_json=? WHERE id=?", [
      v.data.total ?? e.total,
      v.data.tax_rate ?? e.tax_rate,
      v.data.discount_rate ?? e.discount_rate,
      v.data.items ? JSON.stringify(v.data.items) : e.items_json,
      id,
    ]);
    logAudit({ user_id: user.id, username: user.username, action: "UPDATE", entity_type: "transaksi", entity_id: id, details: { total: v.data.total ?? e.total } });
    const row = db.query("SELECT * FROM transaksi WHERE id = ?").get(id);
    return json(row);
  },

  "DELETE /api/transaksi/:id": (req, path) => {
    const user = requireRole(req, ["admin", "manajer"]);
    if (user instanceof Response) return user;
    const writeBlocked = assertCanWrite(user);
    if (writeBlocked) return writeBlocked;
    const rl = checkWriteRateLimit(clientIp(req));
    if (!rl.allowed) return json({ error: "Terlalu banyak request, coba lagi nanti" }, 429);
    const id = path[2];
    const existing = db.query("SELECT total FROM transaksi WHERE id = ?").get(id) as any;
    if (!existing) return json({ error: "Transaksi tidak ditemukan" }, 404);
    const r = db.run("DELETE FROM transaksi WHERE id = ?", [id]);
    if (r.changes === 0) return json({ error: "Transaksi tidak ditemukan" }, 404);
    logAudit({ user_id: user.id, username: user.username, action: "DELETE", entity_type: "transaksi", entity_id: id, details: { total: existing.total } });
    return json({ ok: true });
  },
};
