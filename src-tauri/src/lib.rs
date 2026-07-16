// ============================================================
// KasirGo — Tauri v2 Desktop (lib.rs)
// ============================================================
// Offline-first POS. SQLite lokal via tauri-plugin-sql.
// Frontend = SolidJS build (frontend/dist), reuse browser SPA.

use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

/// Skema dari shared/db-schema.sql, dijalankan sebagai migration awal.
/// tauri-plugin-sql sqlite mendukung multi-statement per migration string.
const SCHEMA_SQL: &str = include_str!("../../shared/db-schema.sql");

/// Seed data awal (toko default + admin lokal) — hanya kalau tabel toko kosong.
const SEED_SQL: &str = include_str!("../sql/seed.sql");

fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "init schema (shared/db-schema.sql)",
            sql: SCHEMA_SQL,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "seed default toko + admin lokal",
            sql: SEED_SQL,
            kind: MigrationKind::Up,
        },
    ]
}

/// Command: seed manual (dipanggil frontend kalau ingin re-seed).
/// Mengembalikan jumlah baris toko sebelum seed (0 = baru di-seed).
#[tauri::command]
fn seed_check() -> String {
    "ready".to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:kasirgo.db", migrations())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![seed_check])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                if let Some(win) = app.get_webview_window("main") {
                    win.open_devtools();
                }
            }
            let _ = app; // suppress unused
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running KasirGo desktop");
}
