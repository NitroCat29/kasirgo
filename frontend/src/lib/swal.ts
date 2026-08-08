// ============================================================
// KasirGo — SweetAlert2 helpers (dark glass theme)
// Soft feedback → toast (ToastContainer). Swal = confirm/blocking only.
// ============================================================
import Swal, { type SweetAlertIcon } from "sweetalert2";
import { toast, type ToastType } from "./toast";

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

// Soft toast — thin alias to toast.* (compat; prefer toast.* di call-site baru)
export function swalToast(icon: SweetAlertIcon, title: string, timer = 2500) {
  const map: Record<string, ToastType> = {
    success: "success",
    error: "error",
    warning: "warning",
    info: "info",
    question: "info",
  };
  toast[map[icon] ?? "info"](title, timer);
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
