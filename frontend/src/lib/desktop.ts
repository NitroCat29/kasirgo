// ============================================================
// KasirGo — Desktop (Tauri) API Layer
// ============================================================
// Runtime detection + SQLite bridge via tauri-plugin-sql.
// Dipakai frontend saat jalan di Tauri webview (offline mode).
// Browser mode tetap pakai lib/api.ts (fetch ke Bun backend).

import type { Database } from "@tauri-apps/plugin-sql";

/** True kalau jalan di Tauri webview. */
export const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

let db: Database | null = null;

/** Load SQLite database (singleton). Kalau sudah loaded, return cached. */
export async function getDb(): Promise<Database> {
  if (db) return db;
  const Database = (await import("@tauri-apps/plugin-sql")).Database;
  db = await Database.load("sqlite:kasirgo.db");
  return db;
}

/** Execute write query (INSERT/UPDATE/DELETE). Return rows affected. */
export async function dbExecute(sql: string, bindValues?: unknown[]): Promise<number> {
  const d = await getDb();
  const r = await d.execute(sql, bindValues);
  return r.rowsAffected;
}

/** Select query → array of rows. */
export async function dbSelect<T = Record<string, unknown>>(
  sql: string,
  bindValues?: unknown[]
): Promise<T[]> {
  const d = await getDb();
  return (await d.select(sql, bindValues)) as T[];
}
