// Smoke test: local SQLite + RPC handlers (offline desktop core)
// Jalankan: KASIRGO_DATA_DIR=<temp> bun scripts/smoke-local.ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "kasirgo-smoke-"));
process.env.KASIRGO_DATA_DIR = dir;

const { handlers } = await import("../src-electrobun/src/bun/rpc-handlers");
const { localDb, DB_PATH } = await import("../src-electrobun/src/bun/local-db");

let pass = 0;
let fail = 0;
function check(name: string, cond: unknown, extra = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${extra}`); }
}

console.log(`DB: ${DB_PATH}`);

// 1. Toko CRUD
const toko = await handlers["toko.insert"]({ nama: "Toko ABC", alamat: "Jl. Merdeka 1", telepon: "0812" });
check("toko.insert", toko.id && toko.nama === "Toko ABC");
const tokoList = await handlers["toko.list"]();
check("toko.list", tokoList.length === 1);
const tokoUpd = await handlers["toko.update"]({ id: toko.id, nama: "Toko ABC 2" });
check("toko.update", tokoUpd.nama === "Toko ABC 2");

// 2. Produk CRUD + restock
const p1 = await handlers["produk.insert"]({ toko_id: toko.id, nama: "Kertas A4", harga: 50000, harga_modal: 40000, stok: 10, satuan: "Rim" });
const p2 = await handlers["produk.insert"]({ toko_id: toko.id, nama: "Tinta", harga: 25000, stok: 5 });
check("produk.insert", p1.stok === 10 && p2.id);
const p1r = await handlers["produk.restock"]({ id: p1.id, delta: 20 });
check("produk.restock", p1r.stok === 30);

// 3. Transaksi — stok harus berkurang, wallet ter-credit
const trx = await handlers["transaksi.insert"]({
  toko_id: toko.id,
  total: 100000,
  tax_rate: 11,
  discount_rate: 0,
  items: [
    { produk_id: p1.id, nama: "Kertas A4", harga: 50000, qty: 2, diskon: 0 },
    { produk_id: p2.id, nama: "Tinta", harga: 25000, qty: 1, diskon: 0 },
  ],
});
check("transaksi.insert", !!trx.id && trx.total === 100000);
const p1After = await handlers["produk.get"]({ id: p1.id });
const p2After = await handlers["produk.get"]({ id: p2.id });
check("stok berkurang", p1After.stok === 28 && p2After.stok === 4, `p1=${p1After.stok} p2=${p2After.stok}`);
const wallet = await handlers["wallet.get"]({ toko_id: toko.id });
check("wallet ter-credit", wallet.balance === 100000, `balance=${wallet.balance}`);

// 4. Stok tidak cukup → harus error
let stockErr = "";
try {
  await handlers["transaksi.insert"]({
    toko_id: toko.id, total: 1, items: [{ produk_id: p2.id, nama: "Tinta", harga: 1, qty: 999 }],
  });
} catch (e: any) { stockErr = e.message; }
check("stok tidak cukup error", stockErr.includes("tidak cukup"), stockErr);

// 5. Kertas stock (migration)
const ksRows = localDb.query("SELECT stock FROM kertas_stock WHERE id = 1").all();
check("kertas_stock ada", ksRows.length === 1 && Number(ksRows[0].stock) === 0);

// Refill kertas (simulasi POST /api/kertas-stock)
localDb.run("UPDATE kertas_stock SET stock = stock + ?, updated_at = datetime('now') WHERE id = 1", [500]);

// 6. Transaksi fotocopy kurangi kertas
const trx2 = await handlers["transaksi.insert"]({
  toko_id: toko.id, total: 5000, items: [{ produk_id: "jasa-fotocopy", nama: "Fotocopy", harga: 500, qty: 10, diskon: 0 }],
});
const ksAfter = localDb.query("SELECT stock FROM kertas_stock WHERE id = 1").get() as { stock: number };
check("kertas berkurang", Number(ksAfter.stock) === 490, `stock=${ksAfter.stock}`);
check("trx2 dibuat", !!trx2.id);

// 7. Wallet deduct
const w2 = await handlers["wallet.deduct"]({ toko_id: toko.id, amount: 30000, description: "Test" });
check("wallet.deduct", w2.balance === 75000, `balance=${w2.balance}`);

// 8. Transaksi list raw + items_json
const trxRows = localDb.query("SELECT * FROM transaksi ORDER BY created_at DESC").all() as { items_json: string }[];
check("transaksi tersimpan", trxRows.length === 2 && typeof trxRows[0].items_json === "string");

console.log(`\n${pass} pass, ${fail} fail`);
try { localDb.close(); } catch {}
rmSync(dir, { recursive: true, force: true });
process.exit(fail > 0 ? 1 : 0);
