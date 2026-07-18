/**
 * Format number to Indonesian Rupiah string.
 * Examples: formatRupiah(10000) → "Rp 10.000", formatRupiah(null) → "—"
 */
export function formatRupiah(n: number | undefined | null): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

/**
 * Format ISO/timestamp string ke WIB (UTC+7).
 * Hasil: "18/07/2026 15:04:07 WIB"
 */
export function formatWIB(input?: string | number | Date): string {
  if (input === undefined || input === null || input === "") return "—";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "—";
  // Konversi ke UTC+7
  const wib = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  const pad = (x: number) => String(x).padStart(2, "0");
  const dd = pad(wib.getUTCDate());
  const mo = pad(wib.getUTCMonth() + 1);
  const yy = wib.getUTCFullYear();
  const hh = pad(wib.getUTCHours());
  const mm = pad(wib.getUTCMinutes());
  const ss = pad(wib.getUTCSeconds());
  return `${dd}/${mo}/${yy} ${hh}:${mm}:${ss} WIB`;
}

/**
 * Format WIB date-only (tanpa jam). Untuk kolom tabel sempit.
 * Hasil: "18/07/2026"
 */
export function formatWIBshort(input?: string | number | Date): string {
  if (input === undefined || input === null || input === "") return "—";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "—";
  const wib = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${pad(wib.getUTCDate())}/${pad(wib.getUTCMonth() + 1)}/${wib.getUTCFullYear()}`;
}

/**
 * Relative time WIB: "baru saja", "3 dtk lalu", "2 mnt lalu", "1 jam lalu".
 * > 24 jam → fallback formatWIBshort.
 */
export function relativeTime(input?: string | number | Date): string {
  if (input === undefined || input === null || input === "") return "—";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "—";
  const now = Date.now();
  const target = d.getTime();
  const diff = Math.floor((now - target) / 1000);
  if (diff < 0) return "baru saja";
  if (diff < 5) return "baru saja";
  if (diff < 60) return `${diff} dtk lalu`;
  if (diff < 3600) return `${Math.floor(diff / 60)} mnt lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  return formatWIBshort(input);
}
