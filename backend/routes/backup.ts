import { resolve, join } from "node:path";
import { existsSync, mkdirSync, readFileSync, unlinkSync, readdirSync, statSync } from "node:fs";
import {
  config,
  getUser,
  getDeviceFingerprint,
  json,
  parseBody,
  requireRole,
  assertCanWrite,
  logAudit,
  clientIp,
  checkWriteRateLimit,
  checkIdempotency,
  creditWallet,
} from "../helpers";

// ============================================================
// Backup & Restore Routes (admin only)
// ============================================================

const BACKUP_DIR = resolve(import.meta.dir + "/../../backups");

function ensureBackupDir() {
  if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });
}

export const backupRoutes: Record<string, (req: Request, path: string[]) => Response | Promise<Response>> = {
  // GET /api/backup — download SQLite backup
  "GET /api/backup": (req) => {
    const user = requireRole(req, ["admin"]);
    if (user instanceof Response) return user;

    const dbFile = resolve(config.dbPath);
    if (!existsSync(dbFile)) {
      return json({ error: "Database file not found" }, 404);
    }

    // SQLite backup: use VACUUM INTO for consistent snapshot
    ensureBackupDir();
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `kasirgo-backup-${ts}.sqlite`;
    // Security: validate filename — hanya alphanumeric + dash + dot (ts sudah aman, tapi defensif)
    if (!/^[a-zA-Z0-9\-\.]+$/.test(filename)) {
      return json({ error: "Invalid backup filename" }, 500);
    }
    const backupFile = join(BACKUP_DIR, filename);

    try {
      // VACUUM INTO tidak support parameter binding, tapi filename sudah divalidasi di atas
      db.run(`VACUUM INTO '${backupFile.replace(/'/g, "''")}'`);
      const data = readFileSync(backupFile);

      // Cleanup temp file
      unlinkSync(backupFile);

      return new Response(data, {
        headers: {
          "Content-Type": "application/x-sqlite3",
          "Content-Disposition": `attachment; filename="kasirgo-backup-${ts}.sqlite"`,
        },
      });
    } catch (err: any) {
      console.error("Backup error:", err);
      return json({ error: "Gagal membuat backup" }, 500);
    }
  },

  // GET /api/backup/list — list available backups on server
  "GET /api/backup/list": (req) => {
    const user = requireRole(req, ["admin"]);
    if (user instanceof Response) return user;

    ensureBackupDir();
    try {
      const files = readdirSync(BACKUP_DIR)
        .filter((f: string) => f.startsWith("kasirgo-backup-"))
        .map((f: string) => {
          try {
            const stat = statSync(join(BACKUP_DIR, f));
            return { name: f, size: stat.size, created: stat.birthtime.toISOString() };
          } catch {
            return null;
          }
        })
        .filter(Boolean) as Array<{ name: string; size: number; created: string }>;
      return json({ backups: files });
    } catch {
      return json({ backups: [] });
    }
  },
};
