import { createSignal, createResource, Show, onMount } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import { api } from "../lib/api";
import { requireAuth } from "../lib/requireAuth";
import { user } from "../lib/auth";
import { useSessionTimeout } from "../lib/session-timeout";

type Settings = {
  base_url: string;
  model: string;
  enabled: boolean;
  has_key: boolean;
  key_from_env?: boolean;
};

export default function AiIntegration() {
  const nav = useNavigate();
  requireAuth(nav);
  useSessionTimeout({ onTimeout: () => nav("/login"), warningSeconds: 120 });

  const [baseUrl, setBaseUrl] = createSignal("");
  const [apiKey, setApiKey] = createSignal(""); // "" = tidak diubah; "-" = hapus
  const [model, setModel] = createSignal("");
  const [enabled, setEnabled] = createSignal(true);
  const [hasKey, setHasKey] = createSignal(false);
  const [keyFromEnv, setKeyFromEnv] = createSignal(false);

  const [models, setModels] = createSignal<string[]>([]);
  const [loadingModels, setLoadingModels] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [msg, setMsg] = createSignal<{ type: "ok" | "err"; text: string } | null>(null);

  const [settings] = createResource(async () => {
    const s = await api<Settings>("/api/ai/settings");
    setBaseUrl(s.base_url || "");
    setModel(s.model || "");
    setEnabled(s.enabled !== false);
    setHasKey(!!s.has_key);
    setKeyFromEnv(!!s.key_from_env);
    return s;
  });

  async function loadModels() {
    setMsg(null);
    const b = baseUrl().trim();
    if (!b) {
      setMsg({ type: "err", text: "Isi endpoint dulu." });
      return;
    }
    setLoadingModels(true);
    try {
      // Kirim base_url sementara + api_key yang baru diisi (belum disimpan)
      const q = new URLSearchParams({ base_url: b });
      if (apiKey() && apiKey() !== "-") q.set("api_key", apiKey());
      const res = await api<{ models: string[]; error?: string }>(`/api/ai/models?${q}`);
      if (res.error) throw new Error(res.error);
      setModels(res.models || []);
      if ((res.models || []).length === 0) {
        setMsg({ type: "err", text: "Endpoint merespons tapi tidak ada model." });
      } else {
        setMsg({ type: "ok", text: `${res.models!.length} model dimuat.` });
      }
    } catch (e: any) {
      setMsg({ type: "err", text: e?.message || "Gagal memuat model" });
    } finally {
      setLoadingModels(false);
    }
  }

  async function save() {
    setMsg(null);
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        base_url: baseUrl().trim(),
        model: model(),
        enabled: enabled() ? 1 : 0,
      };
      if (apiKey()) body.api_key = apiKey(); // "" tidak dikirim = tidak diubah
      const res = await api<{ ok: boolean; has_key: boolean; error?: string }>("/api/ai/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.error) throw new Error(res.error);
      setHasKey(res.has_key);
      setApiKey(""); // reset field key
      setMsg({ type: "ok", text: "Konfigurasi tersimpan." });
    } catch (e: any) {
      setMsg({ type: "err", text: e?.message || "Gagal menyimpan" });
    } finally {
      setSaving(false);
    }
  }

  async function testRecognize() {
    setMsg(null);
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const image = await fileToDataUrl(file);
      try {
        const res = await api<any>("/api/ai/recognize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image }),
        });
        setMsg({ type: "ok", text: `Test OK → "${res.nama || "-"}" (${res.kategori || "-"} / ${res.merk || "-"})` });
      } catch (e: any) {
        setMsg({ type: "err", text: e?.message || "Test gagal" });
      }
    };
    input.click();
  }

  function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  const examples = [
    "https://api.openai.com/v1",
    "https://openrouter.ai/api/v1",
    "http://localhost:11434/v1 (Ollama)",
    "http://localhost:1234/v1 (LM Studio)",
  ];

  return (
    <div class="min-h-screen bg-kasir-bg text-white">
      <header class="border-b border-white/10 px-4 sm:px-6 py-4 flex items-center justify-between gap-3 sticky top-0 bg-kasir-bg/90 backdrop-blur z-10">
        <A href="/dashboard" class="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors no-underline">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Kembali
        </A>
        <span class="text-sm text-zinc-500 truncate">{user()?.nama || user()?.username}</span>
      </header>

      <main class="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 class="text-2xl font-bold text-white">Integrasi AI</h1>
          <p class="text-sm text-zinc-400 mt-1">
            Sambungkan endpoint vision (standar OpenAI-compatible) untuk auto-input produk dari foto & pembacaan barcode.
          </p>
        </div>

        <Show when={settings()}>
          <form
            class="space-y-5 bg-white/[0.03] border border-white/10 rounded-2xl p-5"
            onSubmit={(e) => { e.preventDefault(); save(); }}
          >
            <div>
              <label class="text-xs font-medium text-zinc-400 mb-1 block">Base URL endpoint</label>
              <input
                class="glass-input font-mono text-sm"
                value={baseUrl()}
                onInput={(e) => setBaseUrl(e.currentTarget.value)}
                placeholder="https://api.openai.com/v1"
                disabled={keyFromEnv()}
              />
              <p class="text-[11px] text-zinc-500 mt-1">
                Contoh: {examples.join(" · ")}
              </p>
            </div>

            <div>
              <label class="text-xs font-medium text-zinc-400 mb-1 block">
                API Key {hasKey() && <span class="text-emerald-400">(tersimpan)</span>}
              </label>
              <input
                type="password"
                class="glass-input font-mono text-sm"
                value={apiKey()}
                onInput={(e) => setApiKey(e.currentTarget.value)}
                placeholder={hasKey() ? "•••••••• (isi untuk ganti, hapus dengan -)" : "sk-..."}
                autocomplete="off"
                disabled={keyFromEnv()}
              />
              <Show when={keyFromEnv()}>
                <p class="text-[11px] text-amber-400 mt-1">Key berasal dari env AI_API_KEY (tidak bisa diedit dari UI).</p>
              </Show>
            </div>

            <div class="flex gap-2 items-start">
              <div class="flex-1">
                <label class="text-xs font-medium text-zinc-400 mb-1 block">Model</label>
                <input
                  class="glass-input font-mono text-sm"
                  value={model()}
                  onInput={(e) => setModel(e.currentTarget.value)}
                  placeholder="gpt-4o-mini / llama3.2-vision / ..."
                  list="ai-model-list"
                  disabled={keyFromEnv()}
                />
                <datalist id="ai-model-list">
                  {models().map((m) => <option value={m} />)}
                </datalist>
              </div>
              <button
                type="button"
                class="btn-sm btn-ghost mt-6 shrink-0"
                onClick={loadModels}
                disabled={loadingModels()}
              >
                {loadingModels() ? "Memuat..." : "Muat Model"}
              </button>
            </div>

            <label class="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer select-none">
              <input type="checkbox" checked={enabled()} onInput={(e) => setEnabled(e.currentTarget.checked)} class="accent-indigo-500 w-4 h-4" />
              Aktifkan fitur AI (foto → auto-input produk)
            </label>

            <Show when={msg()}>
              <p class={`text-sm ${msg()!.type === "ok" ? "text-emerald-400" : "text-red-400"}`}>
                {msg()!.text}
              </p>
            </Show>

            <div class="flex gap-3 pt-1">
              <button type="button" class="btn-sm btn-ghost flex-1" onClick={testRecognize}>
                Uji dengan Foto
              </button>
              <button type="submit" class="btn-sm btn-indigo flex-1" disabled={saving()}>
                {saving() ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </form>
        </Show>

        <div class="text-xs text-zinc-500 space-y-1 border-t border-white/10 pt-4">
          <p>• Endpoint harus mendukung <span class="font-mono text-zinc-400">POST {baseUrl() || "…"}/chat/completions</span> dengan input gambar (vision).</p>
          <p>• API key disimpan di database lokal (SQLite) — aman selama akses ke server & DB dibatasi. Bisa juga di-set lewat env <span class="font-mono text-zinc-400">AI_BASE_URL / AI_API_KEY / AI_MODEL</span>.</p>
        </div>
      </main>
    </div>
  );
}
