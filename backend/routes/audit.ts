import { db } from "../db";
import { json, requireRole } from "../helpers";

// ============================================================
// Audit Log Routes
// ============================================================
export const auditRoutes: Record<string, (req: Request, path: string[]) => Response | Promise<Response>> = {
  "GET /api/audit-logs": requireRole("admin")(async (req) => {
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit")) || 100;
    const offset = Number(url.searchParams.get("offset")) || 0;
    const entityType = url.searchParams.get("entity_type");

    let query = "SELECT * FROM audit_logs";
    const params: any[] = [];

    if (entityType) {
      query += " WHERE entity_type = ?";
      params.push(entityType);
    }

    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const rows = db.query(query).all(...params);
    return json(rows);
  }),
};
