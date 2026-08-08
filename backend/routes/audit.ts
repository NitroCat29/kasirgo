import { db } from "../db";
import { json, requireRole } from "../helpers";
import { createHmac, createHash } from "node:crypto";

// ============================================================
// Audit Log Routes — enhanced filtering + export
// ============================================================

function buildFilterQuery(url: URL): { where: string[]; params: any[] } {
  const where: string[] = [];
  const params: any[] = [];

  const entityType = url.searchParams.get("entity_type");
  if (entityType) {
    where.push("entity_type = ?");
    params.push(entityType);
  }

  const userId = url.searchParams.get("user_id");
  if (userId) {
    where.push("user_id = ?");
    params.push(userId);
  }

  const action = url.searchParams.get("action");
  if (action) {
    where.push("action = ?");
    params.push(action);
  }

  const from = url.searchParams.get("from");
  if (from) {
    where.push("created_at >= ?");
    params.push(from);
  }

  const to = url.searchParams.get("to");
  if (to) {
    where.push("created_at <= ?");
    params.push(to);
  }

  return { where, params };
}

export const auditRoutes: Record<string, (req: Request, path: string[]) => Response | Promise<Response>> = {
  "GET /api/audit-logs": (req) => {
    const user = requireRole(req, ["admin"]);
    if (user instanceof Response) return user;
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit")) || 100, 1000);
    const offset = Number(url.searchParams.get("offset")) || 0;

    const { where, params } = buildFilterQuery(url);

    let query = "SELECT * FROM audit_logs";
    if (where.length > 0) {
      query += " WHERE " + where.join(" AND ");
    }
    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const rows = db.query(query).all(...params);

    // Count total (without limit/offset) for pagination info
    let countQuery = "SELECT COUNT(*) as total FROM audit_logs";
    const countParams = [...params];
    countParams.splice(countParams.length - 2, 2); // remove limit/offset
    if (where.length > 0) {
      countQuery += " WHERE " + where.join(" AND ");
    }
    const total = (db.query(countQuery).get(...countParams) as any)?.total || 0;

    return json({ rows, total, limit, offset });
  },

  // Verify integrity: re-check hash chain validity
  "GET /api/audit-logs/verify": (req) => {
    const user = requireRole(req, ["admin"]);
    if (user instanceof Response) return user;

    const rows = db.query("SELECT id, prev_hash, hash, user_id, username, action, entity_type, entity_id, details, old_values, new_values, ip_address, created_at FROM audit_logs ORDER BY rowid ASC").all() as any[];

    const secret = process.env.AUDIT_HMAC_SECRET || "";

    let prevHash: string | null = null;
    let verifiedRows = 0;
    for (const row of rows) {
      // Rows written before the integrity migration have no hash and cannot be verified.
      if (!row.hash) {
        return json({
          valid: true,
          total_rows: rows.length,
          verified_rows: verifiedRows,
          unverifiable_legacy_rows: rows.length - verifiedRows,
        });
      }

      if (row.prev_hash !== prevHash) {
        return json({
          valid: false,
          error: "Hash chain pointer broken",
          row_id: row.id,
          expected_prev_hash: prevHash,
          actual_prev_hash: row.prev_hash,
          created_at: row.created_at,
        });
      }

      const data = JSON.stringify({
        user_id: row.user_id,
        username: row.username,
        action: row.action,
        entity_type: row.entity_type,
        entity_id: row.entity_id,
        details: row.details,
        old_values: row.old_values,
        new_values: row.new_values,
        ip: row.ip_address,
      });
      const payload = `${prevHash || ""}:${row.id}:${data}`;
      const expected = secret
        ? createHmac("sha256", secret).update(payload).digest("hex")
        : createHash("sha256").update(payload).digest("hex");

      if (expected !== row.hash) {
        return json({
          valid: false,
          error: "Hash chain broken",
          row_id: row.id,
          expected_hash: expected,
          actual_hash: row.hash,
          created_at: row.created_at,
        });
      }
      prevHash = row.hash;
      verifiedRows++;
    }
    return json({ valid: true, total_rows: rows.length, verified_rows: verifiedRows, unverifiable_legacy_rows: 0 });
  },

  // Export audit logs (JSON or CSV)
  "GET /api/audit-logs/export": (req) => {
    const user = requireRole(req, ["admin"]);
    if (user instanceof Response) return user;
    const url = new URL(req.url);
    const format = url.searchParams.get("format") || "json";

    const { where, params } = buildFilterQuery(url);

    let query = "SELECT * FROM audit_logs";
    if (where.length > 0) {
      query += " WHERE " + where.join(" AND ");
    }
    query += " ORDER BY created_at ASC";

    const rows = db.query(query).all(...params) as any[];

    if (format === "csv") {
      if (rows.length === 0) {
        return new Response("No data\n", {
          headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=audit_logs.csv" },
        });
      }
      const headers = Object.keys(rows[0]);
      const csvRows = [
        headers.join(","),
        ...rows.map((r: any) => headers.map((h: string) => {
          let val = String(r[h] ?? "");
          // Prevent CSV formula injection: prefix dangerous starts with single quote
          if (/^[=+\-@\t\r]/.test(val)) {
            val = "'" + val;
          }
          if (val.includes(",") || val.includes('"') || val.includes("\n")) {
            val = '"' + val.replace(/"/g, '""') + '"';
          }
          return val;
        }).join(",")),
      ];
      return new Response(csvRows.join("\n"), {
        headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=audit_logs.csv" },
      });
    }

    // JSON export
    return new Response(JSON.stringify(rows, null, 2), {
      headers: { "Content-Type": "application/json", "Content-Disposition": "attachment; filename=audit_logs.json" },
    });
  },
};
