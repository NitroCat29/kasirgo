import { Show, For, createSignal } from "solid-js";
import gsap from "gsap";

/* ============================================
   TYPES
   ============================================ */

export interface TokoDropdownProps {
  daftarToko: () => { id: string; nama: string }[];
  selectedTokoId: () => string;
  onSelect: (id: string) => void;
}

/* ============================================
   COMPONENT
   ============================================ */

export default function TokoDropdown(props: TokoDropdownProps) {
  const [isOpen, setIsOpen] = createSignal(false);
  let triggerRef: HTMLButtonElement | undefined;
  let panelRef: HTMLDivElement | undefined;

  function toggle() {
    const open = !isOpen();
    setIsOpen(open);
    if (triggerRef) triggerRef.classList.toggle("open", open);
    if (panelRef) {
      if (open) {
        gsap.fromTo(
          panelRef,
          { opacity: 0, y: -8 },
          { opacity: 1, y: 0, duration: 0.2, ease: "power2.out" },
        );
      } else {
        gsap.to(panelRef, {
          opacity: 0,
          y: -8,
          duration: 0.15,
          ease: "power2.in",
          onComplete: () => setIsOpen(false),
        });
      }
    }
  }

  function handleSelect(id: string) {
    props.onSelect(id);
    toggle(); // close
  }

  return (
    <div class="kasir-dropdown-wrap">
      <button
        ref={triggerRef}
        class="kasir-dropdown-trigger"
        onClick={toggle}
        onBlur={() =>
          setTimeout(() => {
            if (isOpen()) toggle();
          }, 180)
        }
      >
        <span class="truncate">
          {props.daftarToko().find((t) => t.id === props.selectedTokoId())
            ?.nama || "Pilih toko"}
        </span>
        <svg
          class="caret"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <Show when={isOpen()}>
        <div ref={panelRef} class="kasir-dropdown-panel">
          <For each={props.daftarToko()}>
            {(t) => (
              <div
                class={`kasir-dropdown-option ${t.id === props.selectedTokoId() ? "selected" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(t.id);
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <path d="M9 22V12h6v10" />
                </svg>
                <span class="truncate">{t.nama}</span>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
