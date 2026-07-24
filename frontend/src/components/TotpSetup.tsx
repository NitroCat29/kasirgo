// ============================================================
// TotpSetup — Admin-only TOTP 2FA setup/verify/disable
// ============================================================
import { createSignal, onMount, Show } from "solid-js";
import { api } from "../lib/api";
import { user } from "../lib/auth";
import { swalSuccess, swalApiError } from "../lib/swal";

interface TotpStatus {
  enabled: boolean;
  hasSecret: boolean;
}

interface TotpSetupResponse {
  secret: string;
  qrDataUrl: string;
}

export default function TotpSetup() {
  const [status, setStatus] = createSignal<TotpStatus | null>(null);
  const [qrDataUrl, setQrDataUrl] = createSignal("");
  const [secret, setSecret] = createSignal("");
  const [code, setCode] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [step, setStep] = createSignal<"idle" | "scan" | "verify">("idle");

  async function fetchStatus() {
    try {
      const s = await api<TotpStatus>("/api/v1/auth/totp/status");
      setStatus(s);
      // Jangan auto ke step "scan" tanpa QR — secret di DB encrypted,
      // FE gak punya qrDataUrl. User harus klik "Aktifkan 2FA" ulang.
      if (s.enabled) {
        setStep("idle");
      } else {
        setStep("idle");
        setQrDataUrl("");
        setSecret("");
      }
    } catch {
      setStatus({ enabled: false, hasSecret: false });
      setStep("idle");
    }
  }

  async function handleSetup() {
    setLoading(true);
    try {
      const res = await api<TotpSetupResponse>("/api/v1/auth/totp/setup", {
        method: "POST",
      });
      setQrDataUrl(res.qrDataUrl);
      setSecret(res.secret);
      setStep("scan");
    } catch (e: any) {
      swalApiError(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    const c = code().trim();
    if (c.length !== 6 || !/^\d{6}$/.test(c)) {
      return;
    }
    setLoading(true);
    try {
      await api("/api/v1/auth/totp/verify", {
        method: "POST",
        body: JSON.stringify({ code: c }),
      });
      swalSuccess("2FA berhasil diaktifkan!");
      setStep("idle");
      setCode("");
      await fetchStatus();
    } catch (e: any) {
      swalApiError(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable() {
    const c = code().trim();
    if (c.length !== 6 || !/^\d{6}$/.test(c)) {
      return;
    }
    setLoading(true);
    try {
      await api("/api/v1/auth/totp/disable", {
        method: "POST",
        body: JSON.stringify({ code: c }),
      });
      swalSuccess("2FA berhasil dinonaktifkan!");
      setCode("");
      setStep("idle");
      await fetchStatus();
    } catch (e: any) {
      swalApiError(e);
    } finally {
      setLoading(false);
    }
  }

  onMount(() => {
    fetchStatus();
  });

  const isAdmin = () => user()?.role === "admin";

  return (
    <Show when={isAdmin()}>
      <div class="bg-kasir-card border border-kasir-border rounded-xl p-6 max-w-lg">
        <h3 class="text-lg font-bold text-white mb-1">🔐 Autentikasi Dua Faktor (2FA)</h3>
        <p class="text-sm text-kasir-muted mb-4">
          Aktifkan TOTP 2FA untuk keamanan tambahan pada top-up saldo.
        </p>

        {/* Status: Aktif */}
        <Show when={status()?.enabled}>
          <div class="flex items-center gap-3 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 mb-4">
            <span class="text-2xl">✅</span>
            <div>
              <p class="text-sm font-semibold text-emerald-400">2FA Aktif</p>
              <p class="text-xs text-kasir-muted">Kode verifikasi diperlukan setiap kali top-up.</p>
            </div>
          </div>

          {/* Disable section */}
          <Show when={step() === "idle"}>
            <button
              class="btn-sm bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
              onClick={() => setStep("verify")}
            >
              Nonaktifkan 2FA
            </button>
          </Show>

          <Show when={step() === "verify"}>
            <div class="mt-4 space-y-3">
              <p class="text-sm text-red-400 font-medium">
                Masukkan kode 6 digit dari aplikasi authenticator untuk menonaktifkan:
              </p>
              <input
                type="text"
                inputMode="numeric"
                maxlength={6}
                placeholder="000000"
                class="input-field w-full text-center text-xl tracking-[0.5em] font-mono"
                value={code()}
                onInput={(e) => setCode(e.currentTarget.value.replace(/\D/g, "").slice(0, 6))}
              />
              <div class="flex gap-2">
                <button
                  class="btn-sm btn-indigo flex-1"
                  disabled={loading() || code().length !== 6}
                  onClick={handleDisable}
                >
                  {loading() ? "Memproses..." : "Nonaktifkan"}
                </button>
                <button
                  class="btn-sm btn-ghost"
                  onClick={() => { setStep("idle"); setCode(""); }}
                >
                  Batal
                </button>
              </div>
            </div>
          </Show>
        </Show>

        {/* Status: Belum aktif */}
        <Show when={!status()?.enabled}>
          <Show when={step() === "idle"}>
            <button
              class="btn-sm btn-indigo"
              disabled={loading()}
              onClick={handleSetup}
            >
              {loading() ? "Memuat..." : "Aktifkan 2FA"}
            </button>
          </Show>

          {/* Scan QR */}
          <Show when={step() === "scan" && !!qrDataUrl()}>
            <div class="space-y-4">
              <div class="bg-white rounded-lg p-3 inline-block">
                <img src={qrDataUrl()} alt="QR Code TOTP" class="w-48 h-48" />
              </div>

              <div>
                <p class="text-xs text-kasir-muted mb-1">Atau masukkan manual key:</p>
                <code class="block bg-black/30 text-indigo-300 text-sm px-3 py-2 rounded-lg font-mono break-all select-all">
                  {secret()}
                </code>
              </div>

              <div class="space-y-2">
                <p class="text-sm text-kasir-muted">
                  Scan QR dengan Google Authenticator / Authy, lalu masukkan kode 6 digit:
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  maxlength={6}
                  placeholder="000000"
                  class="input-field w-full text-center text-xl tracking-[0.5em] font-mono"
                  value={code()}
                  onInput={(e) => setCode(e.currentTarget.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyDown={(e) => { if (e.key === "Enter" && code().length === 6) handleVerify(); }}
                />
                <div class="flex gap-2">
                  <button
                    class="btn-sm btn-indigo flex-1"
                    disabled={loading() || code().length !== 6}
                    onClick={handleVerify}
                  >
                    {loading() ? "Memproses..." : "Verifikasi & Aktifkan"}
                  </button>
                  <button
                    class="btn-sm btn-ghost"
                    onClick={() => { setStep("idle"); setCode(""); setQrDataUrl(""); setSecret(""); }}
                  >
                    Batal
                  </button>
                </div>
              </div>
            </div>
          </Show>
        </Show>
      </div>
    </Show>
  );
}
