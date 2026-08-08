// ============================================================
// CommandPalette — F2 finder modal for quick navigation
// ============================================================
import {
  createSignal,
  createMemo,
  onMount,
  onCleanup,
  Show,
  For,
} from "solid-js";
import { useNavigate } from "@solidjs/router";

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: string; // emoji or text icon
  action: () => void;
}

interface CommandPaletteProps {
  open: () => boolean;
  onClose: () => void;
  items: () => CommandItem[];
}

export default function CommandPalette(props: CommandPaletteProps) {
  const [query, setQuery] = createSignal("");
  const [selectedIdx, setSelectedIdx] = createSignal(0);
  let inputRef!: HTMLInputElement;
  let containerRef!: HTMLDivElement;

  const filtered = createMemo(() => {
    const q = query().toLowerCase();
    if (!q) return props.items();
    return props
      .items()
      .filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q),
      );
  });

  // Reset on open
  createMemo(() => {
    if (props.open()) {
      setQuery("");
      setSelectedIdx(0);
      setTimeout(() => inputRef?.focus(), 50);
    }
  });

  function handleKeydown(e: KeyboardEvent) {
    const items = filtered();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => (i - 1 + items.length) % items.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = items[selectedIdx()];
      if (item) {
        item.action();
        props.onClose();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      props.onClose();
    }
  }

  // Reset selection when query changes
  createMemo(() => {
    query(); // track
    setSelectedIdx(0);
  });

  return (
    <Show when={props.open()}>
      {/* Backdrop */}
      <div
        class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh]"
        onClick={(e) => {
          if (e.target === e.currentTarget) props.onClose();
        }}
      >
        {/* Modal */}
        <div
          ref={containerRef}
          class="w-full max-w-md bg-kasir-card/95 backdrop-blur-xl border border-kasir-border rounded-2xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search input */}
          <div class="flex items-center gap-3 px-4 py-3 border-b border-kasir-border">
            <span class="text-kasir-muted text-lg">🔍</span>
            <input
              ref={inputRef}
              type="text"
              class="flex-1 bg-transparent text-kasir-muted text-sm placeholder-kasir-muted outline-none"
              placeholder="Ketik menu atau aksi..."
              value={query()}
              onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
              onKeyDown={handleKeydown}
            />
            <kbd class="text-[10px] font-mono text-kasir-muted bg-white/5 px-1.5 py-0.5 rounded border border-kasir-border">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div class="max-h-72 overflow-y-auto p-1.5">
            <Show
              when={filtered().length > 0}
              fallback={
                <div class="px-4 py-6 text-center text-sm text-kasir-muted">
                  Tidak ada hasil untuk "{query()}"
                </div>
              }
            >
              <For each={filtered()}>
                {(item, idx) => (
                  <button
                    class={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                      idx() === selectedIdx()
                        ? "bg-kasir-accent/15 text-kasir-accent"
                        : "text-kasir-fg hover:bg-white/5"
                    }`}
                    onMouseEnter={() => setSelectedIdx(idx())}
                    onClick={() => {
                      item.action();
                      props.onClose();
                    }}
                  >
                    <span class="text-lg w-7 text-center shrink-0">
                      {item.icon}
                    </span>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium truncate">{item.label}</p>
                      <Show when={item.description}>
                        <p class="text-xs text-kasir-muted truncate">
                          {item.description}
                        </p>
                      </Show>
                    </div>
                    <Show when={idx() === selectedIdx()}>
                      <kbd class="text-[10px] font-mono text-kasir-muted bg-white/5 px-1.5 py-0.5 rounded border border-kasir-border">
                        ↵
                      </kbd>
                    </Show>
                  </button>
                )}
              </For>
            </Show>
          </div>

          {/* Footer hint */}
          <div class="px-4 py-2 border-t border-kasir-border flex items-center gap-4 text-[10px] text-kasir-muted">
            <span>↑↓ navigate</span>
            <span>↵ select</span>
            <span>esc close</span>
          </div>
        </div>
      </div>
    </Show>
  );
}
