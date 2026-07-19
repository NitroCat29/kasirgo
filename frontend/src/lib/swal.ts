// ============================================================
// KasirGo — SweetAlert2 helpers (dark glass theme)
// ============================================================
import Swal, { type SweetAlertIcon } from "sweetalert2";

// Shared theme config cocok KasirGo dark glass
const baseConfig = {
  background: "rgba(19, 24, 38, 0.95)",
  color: "#e8edf5",
  confirmButtonColor: "#00d9a3",
  cancelButtonColor: "#3a4258",
  customClass: {
    popup: "kasir-swal-popup",
    title: "kasir-swal-title",
    htmlContainer: "kasir-swal-html",
    confirmButton: "kasir-swal-btn",
    cancelButton: "kasir-swal-btn-cancel",
  },
};

// Toast (top-end, auto-close) — untuk success/error/info ringan
export function swalToast(icon: SweetAlertIcon, title: string, timer = 2500) {
  return Swal.fire({
    ...baseConfig,
    icon,
    title,
    toast: true,
    position: "top-end",
    showConfirmButton: false,
    timer,
    timerProgressBar: true,
  });
}

export function swalSuccess(title: string, text?: string) {
  return Swal.fire({ ...baseConfig, backdrop: "rgba(10, 14, 26, 0.7)", icon: "success", title, text });
}

export function swalError(title: string, text?: string) {
  return Swal.fire({ ...baseConfig, backdrop: "rgba(10, 14, 26, 0.7)", icon: "error", title, text });
}

export function swalWarning(title: string, text?: string) {
  return Swal.fire({ ...baseConfig, backdrop: "rgba(10, 14, 26, 0.7)", icon: "warning", title, text });
}

export function swalInfo(title: string, text?: string) {
  return Swal.fire({ ...baseConfig, backdrop: "rgba(10, 14, 26, 0.7)", icon: "info", title, text });
}

// Konfirmasi delete — return Promise<boolean> (true = confirm)
export async function swalConfirm(
  title: string,
  text: string,
  confirmText = "Ya, hapus",
  cancelText = "Batal"
): Promise<boolean> {
  const result = await Swal.fire({
    ...baseConfig,
    backdrop: "rgba(10, 14, 26, 0.7)",
    icon: "warning",
    title,
    text,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    reverseButtons: true,
    focusCancel: true,
  });
  return result.isConfirmed;
}

// Handler error dari api() throw — auto-detect 403 role message
export function swalApiError(err: any) {
  const msg = err?.message || "Terjadi kesalahan";
  if (/role tidak memadai|akses ditolak/i.test(msg)) {
    return swalWarning("Akses Ditolak", msg);
  }
  if (/belum login/i.test(msg)) {
    return swalWarning("Sesi Berakhir", "Silakan login ulang.");
  }
  return swalError("Gagal", msg);
}
