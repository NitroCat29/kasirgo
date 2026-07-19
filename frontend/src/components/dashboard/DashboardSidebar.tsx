import { A } from "@solidjs/router";
import { For, Show, type JSX } from "solid-js";
import type { DashboardTab } from "./types";

type SidebarItem = { id: DashboardTab; label: string; icon: JSX.Element };

interface DashboardSidebarProps {
  isOpen: () => boolean;
  activeTab: () => DashboardTab;
  items: () => SidebarItem[];
  lowStockCount: () => number;
  user: () => { nama?: string; role?: string } | null;
  onSelect: (tab: DashboardTab) => void;
  onLogout: () => void;
}

export default function DashboardSidebar(props: DashboardSidebarProps) {
  return (
    <aside
      class={`sidebar-responsive w-64 bg-white/[0.02] border-r border-kasir-border fixed top-0 left-0 h-full z-30 flex flex-col transition-transform duration-300 ${props.isOpen() ? "open" : ""}`}
    >
      <div class="p-5 flex-1 flex flex-col min-h-0">
        <A href="/" class="flex items-center gap-3 no-underline mb-8">
          <img src="/assets/kasirku_logo.svg" alt="KasirGo" class="w-9 h-9 rounded-lg" />
          <span class="text-lg font-bold text-white tracking-tight">
            Kasir<span class="text-indigo-400">Go</span>
          </span>
        </A>

        <nav class="space-y-1 flex-1 overflow-y-auto min-h-0">
          <For each={props.items()}>
            {(item) => (
              <button
                class={`sidebar-link ${props.activeTab() === item.id ? "active" : ""}`}
                onClick={() => props.onSelect(item.id)}
              >
                <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                  {item.icon}
                </svg>
                <span class="truncate">{item.label}</span>
                <Show when={item.id === "produk" && props.lowStockCount() > 0}>
                  <span class="ml-auto flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                    <span class="relative flex h-1.5 w-1.5">
                      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                    </span>
                    {props.lowStockCount()}
                  </span>
                </Show>
              </button>
            )}
          </For>
        </nav>
      </div>

      {/* User card — gradient bottom */}
      <div class="sidebar-user-card">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500/30 to-emerald-500/30 flex items-center justify-center text-indigo-300 text-sm font-bold ring-2 ring-white/10">
            {props.user()?.nama?.charAt(0) || "?"}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-white truncate">{props.user()?.nama}</p>
            <p class="text-xs text-kasir-muted capitalize flex items-center gap-1">
              <span class={`inline-block w-1.5 h-1.5 rounded-full ${props.user()?.role === "admin" ? "bg-amber-400" : "bg-emerald-400"}`} />
              {props.user()?.role}
            </p>
          </div>
          <button onClick={props.onLogout} class="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Logout">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
