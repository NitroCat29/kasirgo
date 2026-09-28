// ============================================================
// CameraCapture — kamera reusable (foto produk / scan barcode)
// ============================================================
// Keamanan: getUserMedia HANYA dipanggil saat user menekan tombol
// "Aktifkan Kamera" — tidak pernah otomatis saat mount. Browser HP akan
// menampilkan prompt izin kamera sendiri.
//
// Catatan: getUserMedia butuh secure context (https:// atau localhost).
// Kalau dibuka dari HP via http://<ip-lan>, browser memblokir kamera —
// komponen menampilkan peringatan ini.

import { Show, createSignal, onCleanup } from "solid-js";

export interface CameraCaptureProps {
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
  label?: string; // mis. "Ambil Foto Produk" / "Scan Barcode"
  facingMode?: "environment" | "user";
}

export default function CameraCapture(props: CameraCaptureProps) {
  const [stream, setStream] = createSignal<MediaStream | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [requesting, setRequesting] = createSignal(false);
  let videoEl: HTMLVideoElement | undefined;

  const isSecure =
    typeof window !== "undefined" &&
    (window.isSecureContext || location.hostname === "localhost" || location.hostname === "127.0.0.1");

  async function startCamera() {
    setError(null);
    setRequesting(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw Object.assign(new Error("Browser tidak mendukung akses kamera"), { name: "NotSupportedError" });
      }
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: props.facingMode ?? "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      setStream(s);
      if (videoEl) {
        videoEl.srcObject = s;
        await videoEl.play().catch(() => {});
      }
    } catch (e: any) {
      const name = e?.name || "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setError("Izin kamera ditolak. Izinkan akses kamera lewat tombol di address bar browser, lalu coba lagi.");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setError("Kamera tidak ditemukan di perangkat ini.");
      } else if (name === "NotSupportedError") {
        setError("Kamera hanya bisa diakses lewat https:// atau localhost. Buka aplikasi lewat HTTPS agar kamera HP bisa dipakai.");
      } else {
        setError(`Gagal membuka kamera: ${e?.message || e}`);
      }
    } finally {
      setRequesting(false);
    }
  }

  function stopCamera() {
    const s = stream();
    if (s) {
      s.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
    if (videoEl) videoEl.srcObject = null;
  }

  function capture() {
    const v = videoEl;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    // Batasi lebar supaya payload base64 nggak gede-gede amat
    const maxW = 1280;
    const scale = Math.min(1, maxW / v.videoWidth);
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    stopCamera();
    props.onCapture(dataUrl);
  }

  function close() {
    stopCamera();
    props.onClose();
  }

  // Stop stream saat komponen di-unmount (mis. parent nutup modal)
  onCleanup(() => stopCamera());

  return (
    <div class="modal-overlay" style={{ "z-index": 70 }} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div class="modal-box" style={{ "max-width": "560px" }}>
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-bold text-white">{props.label || "Kamera"}</h3>
          <button type="button" class="text-zinc-400 hover:text-white text-xl leading-none" onClick={close} aria-label="Tutup">✕</button>
        </div>

        <Show
          when={stream()}
          fallback={
            <div class="space-y-4">
              {!isSecure && (
                <p class="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg p-3">
                  Perangkat ini dibuka lewat HTTP non-localhost — sebagian browser memblokir kamera.
                  Untuk kamera HP, buka aplikasi lewat <span class="font-mono">https://</span>.
                </p>
              )}
              <Show when={!error()}>
                <p class="text-sm text-zinc-400">
                  Kamera tidak diakses sebelum kamu menekan tombol. Browser akan meminta izin saat tombol ditekan.
                </p>
              </Show>
              <Show when={error()}>
                <p class="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg p-3">{error()}</p>
              </Show>
              <button type="button" class="btn-sm btn-indigo w-full" onClick={startCamera} disabled={requesting()}>
                {requesting() ? "Meminta izin..." : "📷 Aktifkan Kamera"}
              </button>
              <button type="button" class="btn-sm btn-ghost w-full" onClick={close}>Batal</button>
            </div>
          }
        >
          <div class="space-y-3">
            <video
              ref={videoEl}
              playsinline
              autoplay
              muted
              class="w-full rounded-xl bg-black aspect-[4/3] object-cover"
            />
            <div class="flex gap-3">
              <button type="button" class="btn-sm btn-ghost flex-1" onClick={() => { stopCamera(); }}>
                Ulangi
              </button>
              <button type="button" class="btn-sm btn-indigo flex-1" onClick={capture}>
                📸 Ambil
              </button>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
