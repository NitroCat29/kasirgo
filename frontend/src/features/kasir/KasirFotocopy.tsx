import { Show, createSignal } from "solid-js";
import { formatRupiah } from "../../lib/format";

/* ============================================
   PROPS
   ============================================ */

export interface KasirFotocopyProps {
  unitPrice: number;
  qty: () => number;
  doubleSided: () => boolean;
  effLembar: () => number;
  setQty: (n: number) => void;
  addQty: (n: number) => void;
  toggleDoubleSided: () => void;
  setDoubleSided: (v: boolean) => void;
  reset: () => void;
}

/* ============================================
   COMPONENT — 1 box besar jasa fotocopy
   ============================================ */

export default function KasirFotocopy(props: KasirFotocopyProps) {
  const [input, setInput] = createSignal<string>("");

  function onInput(e: Event) {
    const raw = (e.currentTarget as HTMLInputElement).value.replace(/\D/g, "");
    setInput(raw);
    props.setQty(Number(raw || "0"));
  }

  function applyInput() {
    const n = Number(input() || "0");
    props.setQty(n);
    setInput(String(n > 0 ? n : ""));
  }

  function reset() {
    setInput("");
    props.reset();
  }

  const subtotal = () => props.effLembar() * props.unitPrice;

  return (
    <div class="mb-4">
      <div class="flex items-center gap-2 mb-2 flex-wrap">
        <span class="text-base font-bold text-kasir-accent">📄 Fotocopy</span>
        <span class="text-xs text-kasir-muted">
          {formatRupiah(props.unitPrice)}/lembar · input manual · +5/+10/+25 · ✕ reset · toggle 1/2 sisi (2 sisi = qty×2)
        </span>
      </div>

      <div
        class={`flex flex-col rounded-xl border-2 p-4 transition-colors ${
          props.qty() > 0
            ? "border-emerald-500 bg-emerald-500/10"
            : "border-kasir-border bg-kasir-card"
        }`}
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-xs font-semibold uppercase tracking-wide text-kasir-muted">
              Jasa Fotocopy
            </div>
            <div class="text-2xl font-extrabold text-white mt-0.5 leading-none">
              {formatRupiah(props.unitPrice)}
              <span class="text-sm font-normal text-kasir-muted">/lembar</span>
            </div>
          </div>
          <Show when={props.qty() > 0}>
            <span class="w-9 h-9 rounded-full bg-emerald-500 text-white text-lg font-bold flex items-center justify-center shadow-lg">
              {props.effLembar()}
            </span>
          </Show>
        </div>

        {/* Toggle 1 sisi / 2 sisi */}
        <div class="mt-3 flex items-center gap-1">
          <button
            type="button"
            class={`flex-1 text-sm py-1.5 rounded-md font-semibold ${
              !props.doubleSided()
                ? "bg-kasir-accent text-white"
                : "bg-kasir-card border border-kasir-border text-kasir-muted"
            }`}
            onClick={() => props.setDoubleSided(false)}
          >
            1 sisi
          </button>
          <button
            type="button"
            class={`flex-1 text-sm py-1.5 rounded-md font-semibold ${
              props.doubleSided()
                ? "bg-kasir-accent text-white"
                : "bg-kasir-card border border-kasir-border text-kasir-muted"
            }`}
            onClick={() => props.setDoubleSided(true)}
          >
            2 sisi
          </button>
        </div>

        {/* Input jumlah manual + reset */}
        <div class="mt-3 flex items-center gap-2">
          <input
            type="text"
            inputmode="numeric"
            class="kasir-input flex-1 text-center text-lg px-2 py-2"
            placeholder="jumlah lembar"
            value={input()}
            onInput={onInput}
            onBlur={applyInput}
          />
          <button
            type="button"
            class="w-9 h-9 rounded-md bg-red-500/20 text-red-400 text-lg font-bold hover:bg-red-500/30 flex items-center justify-center"
            title="Reset jumlah"
            onClick={reset}
          >
            ✕
          </button>
        </div>

        {/* Preset +5 / +10 / +25 (akumulasi) */}
        <div class="mt-2 grid grid-cols-3 gap-2">
          {[5, 10, 25].map((n) => (
            <button
              type="button"
              class="text-sm py-1.5 rounded-md bg-kasir-accent/15 text-kasir-accent font-semibold hover:bg-kasir-accent/25"
              onClick={() => props.addQty(n)}
            >
              +{n}
            </button>
          ))}
        </div>

        <Show when={props.qty() > 0}>
          <div class="mt-3 text-sm text-kasir-muted">
            Total: <span class="text-white font-bold">{props.effLembar()} lembar</span>
            {" · "}
            <span class="text-kasir-accent font-bold">{formatRupiah(subtotal())}</span>
          </div>
        </Show>
      </div>
    </div>
  );
}
