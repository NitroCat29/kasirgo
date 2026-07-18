import { For } from "solid-js";
import { EmptyState } from "../../../components/ui";
import { formatWIB } from "../../../lib/format";
import type { AuditLog } from "../../../components/dashboard/types";

export interface AuditTabProps {
  daftarAudit: () => AuditLog[];
  auditFilter: () => string;
  setAuditFilter: (v: string) => void;
  loadAudit: (filter?: string) => void;
}

export default function AuditTab(props: AuditTabProps) {
  return (
    <div class="fade-in">
      <div class="flex justify-between items-center mb-4 gap-3 flex-wrap">
        <h2 class="text-lg font-semibold text-white">Audit Logs</h2>
        <div class="flex gap-2 items-center">
          <select
            class="glass-input"
            style="width: auto; padding: 6px 12px; font-size: 13px;"
            value={props.auditFilter()}
            onChange={(e) => {
              props.setAuditFilter(e.currentTarget.value);
              props.loadAudit(e.currentTarget.value);
            }}
          >
            <option value="">Semua entity</option>
            <option value="user">user</option>
            <option value="toko">toko</option>
            <option value="produk">produk</option>
            <option value="transaksi">transaksi</option>
            <option value="auth">auth</option>
          </select>
          <button
            class="btn-sm btn-ghost"
            onClick={() => props.loadAudit(props.auditFilter())}
          >
            Refresh
          </button>
        </div>
      </div>
      <div class="glass overflow-hidden">
        <table class="data-table">
          <thead>
            <tr>
              <th>Waktu</th>
              <th>User</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            <For
              each={props.daftarAudit()}
              fallback={
                <tr>
                  <td colspan="5">
                    <EmptyState
                      type="audit"
                      title="Belum ada log"
                      description="Aktivitas CRUD akan tercatat di sini."
                    />
                  </td>
                </tr>
              }
            >
              {(log) => (
                <tr>
                  <td class="font-mono text-xs whitespace-nowrap">
                    {formatWIB(log.created_at)}
                  </td>
                  <td class="text-xs">{log.username || "—"}</td>
                  <td>
                    <span
                      class={`px-2 py-0.5 rounded-full text-xs ${
                        log.action === "CREATE"
                          ? "bg-green-500/20 text-green-400"
                          : log.action === "UPDATE"
                            ? "bg-blue-500/20 text-blue-400"
                            : log.action === "DELETE"
                              ? "bg-red-500/20 text-red-400"
                              : "bg-zinc-500/20 text-zinc-400"
                      }`}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td class="text-xs">{log.entity_type}</td>
                  <td class="text-xs text-zinc-500 max-w-xs truncate">
                    {log.details || "—"}
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </div>
  );
}
