import { createSignal, createEffect, onMount, Show, For } from "solid-js";
import { useNavigate, A } from "@solidjs/router";
import { user, logout, fetchMe } from "../lib/auth";
import { api } from "../lib/api";
import { swalConfirm, swalSuccess, swalApiError, swalToast, swalWarning, swalInfo } from "../lib/swal";
import { calculateTotal, loadWasm } from "../lib/wasm";
import { useSessionTimeout } from "../lib/session-timeout";
import { SessionTimeoutModal, SkeletonStatCard, EmptyState } from "../components/ui";
import RevenueChart from "../components/RevenueChart";
import WalletCard from "../components/WalletCard";

/* ============================================
   TYPES
   ============================================ */
interface Stats {
  toko: number;
  produk: number;
  transaksi: number;
  total_pendapatan: number;
  transaksi_hari_ini: number;
  pendapatan_hari_ini: number;
}

interface Toko {
  id: string;
  nama: string;
  alamat?: string;
  telepon?: string;
}

interface Produk {
  id: string;
  nama: string;
  harga: number;
  stok: number;
  toko_id: string;
  stock_threshold?: number;
}

interface Transaksi {
  id: string;
  toko_id: string;
  total: number;
  items_json: string;
  created_at: string;
}

interface UserRow {
  id: string;
  username: string;
  nama: string;
  role: string;
  created_at: string;
}

interface AuditLog {
  id: string;
  user_id: string | null;
  username: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

interface LowStockItem {
  id: string;
  nama: string;
  harga: number;
  stok: number;
  stock_threshold: number;
  toko_id: string;
  toko_nama: string;
}

interface TrxItem {
  nama: string;
  harga: number;
  qty: number;
}

/* ============================================
   ROLE HELPERS — admin > manajer > kasir
   canEdit: admin & manajer (CRUD toko/produk/transaksi)
   canManageUsers: admin only
   canViewAudit: admin only
   ============================================ */
const ROLE_LEVEL: Record<string, number> = { kasir: 1, manajer: 2, admin: 3 };
function hasMinRole(min: "manajer" | "admin"): boolean {
  const u = user();
  if (!u) return false;
  return (ROLE_LEVEL[u.role] || 0) >= ROLE_LEVEL[min];
}
const canEdit = () => hasMinRole("manajer");
const canManageUsers = () => hasMinRole("admin");
const canViewAudit = () => hasMinRole("admin");

/* ============================================
   MAIN COMPONENT
   ============================================ */
export default function Dashboard() {
  const nav = useNavigate();
  const [stats, setStats] = createSignal<Stats | null>(null);
  const [tab, setTab] = createSignal<"overview" | "toko" | "produk" | "transaksi" | "users" | "audit">("overview");
  const [sidebarOpen, setSidebarOpen] = createSignal(false);

  // Data
  const [daftarToko, setDaftarToko] = createSignal<Toko[]>([]);
  const [daftarProduk, setDaftarProduk] = createSignal<Produk[]>([]);
  const [daftarTransaksi, setDaftarTransaksi] = createSignal<Transaksi[]>([]);
  const [lowStockCount, setLowStockCount] = createSignal(0);
  const [lowStockItems, setLowStockItems] = createSignal<LowStockItem[]>([]);
  const [showLowStockModal, setShowLowStockModal] = createSignal(false);
  const [daftarUsers, setDaftarUsers] = createSignal<UserRow[]>([]);
  const [daftarAudit, setDaftarAudit] = createSignal<AuditLog[]>([]);
  const [auditFilter, setAuditFilter] = createSignal<string>("");

  // Daily revenue (chart)
  interface DailyRevenue { day: string; revenue: number; count: number }
  const [dailyRevenue, setDailyRevenue] = createSignal<DailyRevenue[]>([]);
  const [chartLoading, setChartLoading] = createSignal(true);

  // Theme
  const [theme, setTheme] = createSignal<"dark" | "light">(
    (localStorage.getItem("kasir-theme") as "dark" | "light") || "dark"
  );
  function toggleTheme() {
    const next = theme() === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("kasir-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  // Modal states
  const [showTokoModal, setShowTokoModal] = createSignal(false);
  const [showProdukModal, setShowProdukModal] = createSignal(false);
  const [showUserModal, setShowUserModal] = createSignal(false);
  const [showTrxModal, setShowTrxModal] = createSignal(false);
  const [modalToko, setModalToko] = createSignal<Partial<Toko>>({});
  const [modalProduk, setModalProduk] = createSignal<Partial<Produk> & { harga?: string; stok?: string }>({});
  const [modalUser, setModalUser] = createSignal<Partial<UserRow> & { password?: string; role?: string }>({});
  const [trxForm, setTrxForm] = createSignal<{ toko_id: string; items: TrxItem[] }>({ toko_id: "", items: [] });
  const [trxItemForm, setTrxItemForm] = createSignal<{ nama: string; harga: string; qty: string }>({ nama: "", harga: "", qty: "1" });

  /* ============================================
     INIT
     ============================================ */
  createEffect(async () => {
    if (!user()) {
      const me = await fetchMe();
      if (!me) {
        nav("/login");
        return;
      }
    }
    await Promise.all([loadStats(), loadAlerts(), loadToko()]);
  });

  // Load WASM in background for transaksi total calculation
  onMount(() => {
    loadWasm();
    // Apply saved theme
    document.documentElement.setAttribute("data-theme", theme());
    // Fetch daily revenue for chart
    api<{ days: number; data: DailyRevenue[] }>("/api/stats/daily-revenue?days=30")
      .then((d) => { setDailyRevenue(d.data); setChartLoading(false); })
      .catch(() => setChartLoading(false));
  });

  /* ============================================
     DATA LOADERS
     ============================================ */
  async function loadStats() {
    try {
      const s = await api<Stats>("/api/stats");
      setStats(s);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  }

  async function loadAlerts() {
    try {
      const data = await api<{ low_stock: number }>("/api/alerts/summary");
      setLowStockCount(data.low_stock || 0);
    } catch {}
  }

  async function loadToko() {
    try {
      const data = await api<Toko[]>("/api/toko");
      setDaftarToko(data);
    } catch {}
  }

  async function loadProduk() {
    await loadToko();
    try {
      const data = await api<Produk[]>("/api/produk");
      setDaftarProduk(data);
    } catch {}
  }

  async function loadTransaksi() {
    await loadToko();
    try {
      const data = await api<Transaksi[]>("/api/transaksi");
      setDaftarTransaksi(data);
    } catch {}
  }

  async function loadUsers() {
    try {
      const data = await api<UserRow[]>("/api/users");
      setDaftarUsers(data);
    } catch (err: any) {
      swalApiError(err);
    }
  }

  async function loadAudit(filter = "") {
    try {
      const url = filter ? `/api/audit-logs?entity_type=${encodeURIComponent(filter)}&limit=100` : "/api/audit-logs?limit=100";
      const data = await api<AuditLog[]>(url);
      setDaftarAudit(data);
    } catch (err: any) {
      swalApiError(err);
    }
  }

  async function loadLowStockItems() {
    try {
      const data = await api<LowStockItem[]>("/api/alerts/low-stock");
      setLowStockItems(data);
      setShowLowStockModal(true);
    } catch (err: any) {
      swalApiError(err);
    }
  }

  /* ============================================
     HELPERS
     ============================================ */
  function formatRupiah(n: number | undefined | null): string {
    if (!n && n !== 0) return "—";
    return Number(n).toLocaleString("id-ID");
  }

  function getTokoNama(id: string | undefined): string {
    if (!id) return "—";
    const t = daftarToko().find((x) => x.id === id);
    return t ? t.nama : id.slice(0, 8) + "...";
  }

  function csrfHeaders(): Record<string, string> {
    const m = document.cookie.match(/csrf_token=([^;]+)/);
    return { "content-type": "application/json", "x-csrf-token": m ? m[1] : "" };
  }

  /* ============================================
     CRUD: TOKO
     ============================================ */
  function editToko(t: Toko) {
    setModalToko({ ...t });
    setShowTokoModal(true);
  }

  async function saveToko(e: Event) {
    e.preventDefault();
    const m = modalToko();
    if (!m.nama || !m.nama.trim()) {
      swalWarning("Nama wajib diisi");
      return;
    }
    const method = m.id ? "PATCH" : "POST";
    const url = m.id ? `/api/toko/${m.id}` : "/api/toko";
    try {
      const res = await fetch(url, {
        method,
        headers: csrfHeaders(),
        credentials: "include",
        body: JSON.stringify({ nama: m.nama, alamat: m.alamat, telepon: m.telepon }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `HTTP ${res.status}`);
      }
      setShowTokoModal(false);
      swalToast("success", m.id ? "Toko diperbarui" : "Toko ditambahkan");
      await Promise.all([loadToko(), loadStats()]);
    } catch (err: any) {
      swalApiError(err);
    }
  }

  async function hapusToko(id: string, nama: string) {
    const ok = await swalConfirm("Hapus toko?", `Toko "${nama}" akan dihapus beserta produk & transaksi terkait.`);
    if (!ok) return;
    try {
      const res = await fetch(`/api/toko/${id}`, { method: "DELETE", headers: csrfHeaders(), credentials: "include" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `HTTP ${res.status}`);
      }
      swalToast("success", "Toko dihapus");
      await Promise.all([loadToko(), loadStats()]);
    } catch (err: any) {
      swalApiError(err);
    }
  }

  /* ============================================
     CRUD: PRODUK
     ============================================ */
  function editProduk(p: Produk) {
    setModalProduk({ ...p, harga: String(p.harga), stok: String(p.stok) });
    setShowProdukModal(true);
  }

  async function saveProduk(e: Event) {
    e.preventDefault();
    const m = modalProduk();
    if (!m.nama || !m.nama.trim()) { swalWarning("Nama wajib diisi"); return; }
    if (!m.toko_id) { swalWarning("Toko wajib dipilih"); return; }
    const method = m.id ? "PATCH" : "POST";
    const url = m.id ? `/api/produk/${m.id}` : "/api/produk";
    try {
      const res = await fetch(url, {
        method,
        headers: csrfHeaders(),
        credentials: "include",
        body: JSON.stringify({ nama: m.nama, harga: Number(m.harga), stok: Number(m.stok), toko_id: m.toko_id }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `HTTP ${res.status}`);
      }
      setShowProdukModal(false);
      swalToast("success", m.id ? "Produk diperbarui" : "Produk ditambahkan");
      await Promise.all([loadProduk(), loadStats(), loadAlerts()]);
    } catch (err: any) {
      swalApiError(err);
    }
  }

  async function hapusProduk(id: string, nama: string) {
    const ok = await swalConfirm("Hapus produk?", `Produk "${nama}" akan dihapus permanen.`);
    if (!ok) return;
    try {
      const res = await fetch(`/api/produk/${id}`, { method: "DELETE", headers: csrfHeaders(), credentials: "include" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `HTTP ${res.status}`);
      }
      swalToast("success", "Produk dihapus");
      await Promise.all([loadProduk(), loadStats(), loadAlerts()]);
    } catch (err: any) {
      swalApiError(err);
    }
  }

  /* ============================================
     CRUD: TRANSAKSI
     ============================================ */
  function openTrxModal() {
    setTrxForm({ toko_id: "", items: [] });
    setTrxItemForm({ nama: "", harga: "", qty: "1" });
    setShowTrxModal(true);
  }

  function addTrxItem(e: Event) {
    e.preventDefault();
    const f = trxItemForm();
    if (!f.nama || !f.harga) { swalWarning("Item tidak lengkap"); return; }
    setTrxForm((prev) => ({ ...prev, items: [...prev.items, { nama: f.nama, harga: Number(f.harga), qty: Number(f.qty) || 1 }] }));
    setTrxItemForm({ nama: "", harga: "", qty: "1" });
  }

  function removeTrxItem(idx: number) {
    setTrxForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  }

  function trxSubtotal(): number {
    return trxForm().items.reduce((s, i) => s + i.harga * i.qty, 0);
  }

  function trxTotal(): number {
    return calculateTotal(trxSubtotal(), 11, 0);
  }

  async function saveTrx(e: Event) {
    e.preventDefault();
    const f = trxForm();
    if (!f.toko_id) { swalWarning("Pilih toko dulu"); return; }
    if (f.items.length === 0) { swalWarning("Tambahkan minimal 1 item"); return; }
    try {
      const res = await fetch("/api/transaksi", {
        method: "POST",
        headers: csrfHeaders(),
        credentials: "include",
        body: JSON.stringify({ toko_id: f.toko_id, total: trxTotal(), tax_rate: 11, discount_rate: 0, items: f.items }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `HTTP ${res.status}`);
      }
      setShowTrxModal(false);
      swalToast("success", `Transaksi ${formatRupiah(trxTotal())} dicatat`);
      await Promise.all([loadTransaksi(), loadStats()]);
    } catch (err: any) {
      swalApiError(err);
    }
  }

  async function hapusTransaksi(id: string) {
    const ok = await swalConfirm("Hapus transaksi?", "Transaksi ini akan dihapus permanen.");
    if (!ok) return;
    try {
      const res = await fetch(`/api/transaksi/${id}`, { method: "DELETE", headers: csrfHeaders(), credentials: "include" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `HTTP ${res.status}`);
      }
      swalToast("success", "Transaksi dihapus");
      await Promise.all([loadTransaksi(), loadStats()]);
    } catch (err: any) {
      swalApiError(err);
    }
  }

  /* ============================================
     CRUD: USER (admin)
     ============================================ */
  function editUser(u: UserRow) {
    setModalUser({ ...u, password: "", role: u.role });
    setShowUserModal(true);
  }

  async function saveUser(e: Event) {
    e.preventDefault();
    const m = modalUser();
    if (!m.username || !m.nama) { swalWarning("Username & nama wajib diisi"); return; }
    if (!m.id && !m.password) { swalWarning("Password wajib diisi untuk user baru"); return; }
    const method = m.id ? "PATCH" : "POST";
    const url = m.id ? `/api/users/${m.id}` : "/api/users";

    // SHA-256 hash password di client (konsisten dengan auth flow)
    let hashedPassword: string | undefined;
    if (m.password) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(m.password));
      hashedPassword = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    }

    try {
      const res = await fetch(url, {
        method,
        headers: csrfHeaders(),
        credentials: "include",
        body: JSON.stringify({
          username: m.username,
          nama: m.nama,
          role: m.role || "kasir",
          ...(hashedPassword ? { password: hashedPassword } : {}),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `HTTP ${res.status}`);
      }
      setShowUserModal(false);
      swalToast("success", m.id ? "User diperbarui" : "User ditambahkan");
      await loadUsers();
    } catch (err: any) {
      swalApiError(err);
    }
  }

  async function hapusUser(id: string, username: string) {
    if (user()?.id === id) {
      swalWarning("Tidak bisa hapus diri sendiri", "Gunakan akun admin lain untuk hapus akun ini.");
      return;
    }
    const ok = await swalConfirm("Hapus user?", `User "${username}" akan dihapus permanen.`);
    if (!ok) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE", headers: csrfHeaders(), credentials: "include" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `HTTP ${res.status}`);
      }
      swalToast("success", "User dihapus");
      await loadUsers();
    } catch (err: any) {
      swalApiError(err);
    }
  }

  /* ============================================
     LOGOUT
     ============================================ */
  async function handleLogout() {
    await logout();
    nav("/login");
  }

  /* ============================================
     PAGE META
     ============================================ */
  const pageTitles: Record<string, string> = {
    overview: "Dashboard",
    toko: "Kelola Toko",
    produk: "Kelola Produk",
    transaksi: "Riwayat Transaksi",
    users: "Manajemen User",
    audit: "Audit Logs",
  };
  const pageSubtitles: Record<string, string> = {
    overview: "Ringkasan aktivitas hari ini",
    toko: "Tambah, edit, dan hapus toko",
    produk: "Kelola inventaris produk",
    transaksi: "Semua transaksi tercatat",
    users: "Kelola akun & role pengguna",
    audit: "Jejak aksi semua user",
  };

  /* ============================================
     SIDEBAR ITEMS (role-filtered)
     ============================================ */
  const sidebarItems = () => {
    const items: { id: typeof tab extends () => infer T ? T : never; label: string; icon: any }[] = [
      { id: "overview", label: "Overview", icon: <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /> },
      { id: "toko", label: "Toko", icon: <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" /> },
      { id: "produk", label: "Produk", icon: <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /> },
      { id: "transaksi", label: "Transaksi", icon: <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /> },
    ];
    if (canManageUsers()) {
      items.push({ id: "users", label: "Users", icon: <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.885-2.001-1.938-2.001-.18 0-.358.025-.532.073m-3.593.65a9.337 9.337 0 00-4.121.952 4.125 4.125 0 007.533 2.493M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M9.038 17.595a4.125 4.125 0 00-7.533-2.493M9.038 17.595a9.337 9.337 0 00-4.121.952 4.125 4.125 0 007.533 2.493M9.038 17.595a9.337 9.337 0 00-4.121-.952 4.125 4.125 0 017.533 2.493M15 19.128v-.003c0-1.113-.885-2.001-1.938-2.001-.18 0-.358.025-.532.073m-3.593.65a9.337 9.337 0 00-4.121.952 4.125 4.125 0 007.533 2.493M9.038 17.595a4.125 4.125 0 00-7.533-2.493" /> } as any);
      items.push({ id: "audit", label: "Audit Logs", icon: <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.68.227-.815.503M14.25 6v.75m0 0v.027a48.462 48.462 0 00-1.5.113M12.75 6.75v.027a48.462 48.462 0 011.5.113M12.75 6.75l-.815.503M12.75 6.75l.815.503M9.435 18.75a48.462 48.462 0 011.5-.113m0 0v-.027a48.462 48.462 0 011.5.113m-1.5-.113L12 18.75m-1.5-.113L9 18.75" /> } as any);
    }
    return items;
  };

  function handleTabClick(id: any) {
    setTab(id);
    setSidebarOpen(false);
    if (id === "toko") loadToko();
    if (id === "produk") loadProduk();
    if (id === "transaksi") loadTransaksi();
    if (id === "users") loadUsers();
    if (id === "audit") loadAudit(auditFilter());
  }

  /* ============================================
     SESSION TIMEOUT — warning 2 menit sebelum idle-timeout
     ============================================ */
  const sessionTimeout = useSessionTimeout({
    onTimeout: () => {
      swalInfo("Sesi Berakhir", "Anda telah logout karena tidak ada aktivitas.");
      nav("/login");
    },
    warningSeconds: 120,
  });

  /* ============================================
     RENDER
     ============================================ */
  return (
    <>
    <div class="flex min-h-screen bg-kasir-bg">
      {/* ==================== SIDEBAR ==================== */}
      <aside class={`sidebar-responsive w-64 bg-white/[0.02] border-r border-kasir-border fixed top-0 left-0 h-full z-30 flex flex-col transition-transform duration-300 ${sidebarOpen() ? "open" : ""}`}>
        <div class="p-5">
          <A href="/" class="flex items-center gap-3 no-underline mb-8">
            <img src="/assets/kasirku_logo.svg" alt="KasirGo" class="w-9 h-9 rounded-lg" />
            <span class="text-lg font-bold text-white tracking-tight">Kasir<span class="text-indigo-400">Go</span></span>
          </A>

          <nav class="space-y-1">
            <For each={sidebarItems()}>
              {(item) => (
                <button
                  class={`sidebar-link ${tab() === item.id ? "active" : ""}`}
                  onClick={() => handleTabClick(item.id)}
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">{item.icon}</svg>
                  {item.label}
                  <Show when={item.id === "produk" && lowStockCount() > 0}>
                    <span class="ml-auto px-2 py-0.5 text-xs font-bold rounded-full bg-red-500/20 text-red-400 border border-red-500/30">{lowStockCount()}</span>
                  </Show>
                </button>
              )}
            </For>
          </nav>

          {/* Theme toggle */}
          <button onClick={toggleTheme} class="sidebar-link mt-4 w-full">
            <Show when={theme() === "dark"} fallback={
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.72 9.72 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /></svg>
            }>
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>
            </Show>
            <span>{theme() === "dark" ? "Light Mode" : "Dark Mode"}</span>
          </button>
        </div>

        {/* User info */}
        <div class="absolute bottom-0 left-0 right-0 p-5 border-t border-white/[0.06]">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-300 text-sm font-bold">{user()?.nama?.charAt(0) || "?"}</div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-zinc-300 truncate">{user()?.nama}</p>
              <p class="text-xs text-zinc-500 capitalize">{user()?.role}</p>
            </div>
            <button onClick={handleLogout} class="text-zinc-500 hover:text-red-400 transition-colors" title="Logout">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ==================== MAIN CONTENT ==================== */}
      <main class="main-content lg:ml-64 p-6 lg:p-8 flex-1">
        {/* Top bar */}
        <div class="flex items-center justify-between mb-8">
          <div>
            <button onClick={() => setSidebarOpen(!sidebarOpen())} class="lg:hidden mr-3 text-zinc-400">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
            </button>
            <h1 class="text-2xl font-bold text-white">{pageTitles[tab()]}</h1>
            <p class="text-sm text-zinc-500 mt-1">{pageSubtitles[tab()]}</p>
          </div>
          <div class="text-sm text-zinc-500 font-mono hidden sm:block">
            {new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </div>
        </div>

        {/* ========== OVERVIEW (Bento Box Layout) ========== */}
        <Show when={tab() === "overview"}>
          <div class="fade-in">
            {/* Row 1: Stat cards — 4 small bento boxes */}
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <For each={[
                { label: "Toko", value: stats()?.toko, icon: "🏪" },
                { label: "Produk", value: stats()?.produk, icon: "📦" },
                { label: "Trx Hari Ini", value: stats()?.transaksi_hari_ini, icon: "🧾" },
                { label: "Pendapatan Hari Ini", value: stats()?.pendapatan_hari_ini, icon: "💰", isRupiah: true },
              ]}>
                {(card) => (
                  <Show when={stats()} fallback={<SkeletonStatCard />}>
                    <div class="glass rounded-2xl p-4 border border-kasir-border hover:border-kasir-border-strong transition-colors">
                      <span class="text-2xl">{card.icon}</span>
                      <p class="text-2xl font-bold text-kasir-fg mt-2">
                        {card.isRupiah ? formatRupiah(card.value) : (card.value ?? 0).toLocaleString("id-ID")}
                      </p>
                      <p class="text-xs text-kasir-muted mt-1">{card.label}</p>
                    </div>
                  </Show>
                )}
              </For>
            </div>

            {/* Row 2: Revenue Chart (2/3) + Wallet (1/3) */}
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
              <div class="lg:col-span-2 glass rounded-2xl p-5 border border-kasir-border">
                <div class="flex items-center justify-between mb-3">
                  <h3 class="text-sm font-semibold text-kasir-fg">Pendapatan Harian</h3>
                  <span class="text-xs text-kasir-muted">30 hari terakhir</span>
                </div>
                <RevenueChart data={dailyRevenue()} loading={chartLoading()} />
              </div>
              <div class="glass rounded-2xl p-5 border border-kasir-border">
                <WalletCard />
              </div>
            </div>

            {/* Row 3: Total stats (2 boxes) */}
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div class="glass rounded-2xl p-5 border border-kasir-border">
                <p class="text-kasir-muted text-xs uppercase tracking-wider font-medium mb-1">Total Transaksi</p>
                <p class="text-xl font-bold text-kasir-fg">{(stats()?.transaksi ?? 0).toLocaleString("id-ID")}</p>
                <p class="text-xs text-kasir-muted mt-1">semua waktu</p>
              </div>
              <div class="glass rounded-2xl p-5 border border-kasir-border">
                <p class="text-kasir-muted text-xs uppercase tracking-wider font-medium mb-1">Total Pendapatan</p>
                <p class="text-xl font-bold text-kasir-accent">{formatRupiah(stats()?.total_pendapatan)}</p>
                <p class="text-xs text-kasir-muted mt-1">semua waktu</p>
              </div>
            </div>

            {/* Row 4: Quick actions */}
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <For each={[
                { label: "Kelola Toko", desc: "Tambah & edit toko", color: "text-indigo-400", tab: "toko" as const, icon: <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /> },
                { label: "Kelola Produk", desc: "Tambah & edit produk", color: "text-emerald-400", tab: "produk" as const, icon: <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /> },
                { label: "Riwayat Transaksi", desc: "Lihat semua transaksi", color: "text-amber-400", tab: "transaksi" as const, icon: <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /> },
              ]}>
                {(action) => (
                  <button onClick={() => handleTabClick(action.tab)} class="glass p-4 text-left hover:bg-white/[0.04] transition-colors cursor-pointer rounded-xl border border-transparent hover:border-white/[0.08]">
                    <div class={`${action.color} mb-2`}><svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">{action.icon}</svg></div>
                    <p class="text-sm font-semibold text-kasir-fg">{action.label}</p>
                    <p class="text-xs text-kasir-muted mt-0.5">{action.desc}</p>
                  </button>
                )}
              </For>
            </div>
          </div>
        </Show>

        {/* ========== TOKO ========== */}
        <Show when={tab() === "toko"}>
          <div class="fade-in">
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-lg font-semibold text-white">Daftar Toko</h2>
              <Show when={canEdit()}>
                <button class="btn-sm btn-indigo" onClick={() => { setModalToko({}); setShowTokoModal(true); }}>+ Tambah Toko</button>
              </Show>
            </div>
            <div class="glass overflow-hidden">
              <table class="data-table">
                <thead><tr><th>Nama</th><th>Alamat</th><th>Telepon</th><th>Aksi</th></tr></thead>
                <tbody>
                  <For each={daftarToko()} fallback={<tr><td colspan="4"><EmptyState type="toko" title="Belum ada toko" description="Tambahkan toko pertama kamu untuk mulai mencatat transaksi." action={canEdit() ? { label: "+ Tambah Toko", onClick: () => { setModalToko({}); setShowTokoModal(true); } } : undefined} /></td></tr>}>
                    {(t) => (
                      <tr>
                        <td class="text-white font-medium">{t.nama}</td>
                        <td>{t.alamat || "—"}</td>
                        <td class="font-mono text-xs">{t.telepon || "—"}</td>
                        <td>
                          <Show when={canEdit()} fallback={<span class="text-xs text-zinc-600">—</span>}>
                            <div class="flex gap-2">
                              <button class="btn-sm btn-ghost" onClick={() => editToko(t)}>Edit</button>
                              <button class="btn-sm btn-red" onClick={() => hapusToko(t.id, t.nama)}>Hapus</button>
                            </div>
                          </Show>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </div>
        </Show>

        {/* ========== PRODUK ========== */}
        <Show when={tab() === "produk"}>
          <div class="fade-in">
            {/* Low stock alert banner */}
            <Show when={lowStockCount() > 0}>
              <div class="glass p-4 mb-4 border border-amber-500/30 flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-lg bg-amber-500/15 flex items-center justify-center">
                    <svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.008v.008H12v-.008z" /></svg>
                  </div>
                  <div>
                    <p class="text-sm font-semibold text-amber-300">{lowStockCount()} produk stok menipis</p>
                    <p class="text-xs text-zinc-500">Stok ≤ threshold, perlu restock segera</p>
                  </div>
                </div>
                <button class="btn-sm btn-ghost" onClick={loadLowStockItems}>Lihat Detail</button>
              </div>
            </Show>

            <div class="flex justify-between items-center mb-4">
              <h2 class="text-lg font-semibold text-white">Daftar Produk</h2>
              <Show when={canEdit()}>
                <button class="btn-sm btn-indigo" onClick={() => { setModalProduk({}); setShowProdukModal(true); }}>+ Tambah Produk</button>
              </Show>
            </div>
            <div class="glass overflow-hidden">
              <table class="data-table">
                <thead><tr><th>Nama</th><th>Harga</th><th>Stok</th><th>Toko</th><th>Aksi</th></tr></thead>
                <tbody>
                  <For each={daftarProduk()} fallback={<tr><td colspan="5"><EmptyState type="produk" title="Belum ada produk" description="Tambahkan produk ke toko kamu untuk mulai transaksi." action={canEdit() ? { label: "+ Tambah Produk", onClick: () => { setModalProduk({}); setShowProdukModal(true); } } : undefined} /></td></tr>}>
                    {(p) => (
                      <tr>
                        <td class="text-white font-medium">{p.nama}</td>
                        <td class="rupiah">Rp {formatRupiah(p.harga)}</td>
                        <td>
                          <span class={p.stok <= (p.stock_threshold ?? 5) ? "text-amber-400 font-semibold" : "text-zinc-300"}>{p.stok}</span>
                          <Show when={p.stok <= (p.stock_threshold ?? 5)}>
                            <span class="ml-1 text-xs text-amber-500">⚠</span>
                          </Show>
                        </td>
                        <td class="text-xs text-zinc-500">{getTokoNama(p.toko_id)}</td>
                        <td>
                          <Show when={canEdit()} fallback={<span class="text-xs text-zinc-600">—</span>}>
                            <div class="flex gap-2">
                              <button class="btn-sm btn-ghost" onClick={() => editProduk(p)}>Edit</button>
                              <button class="btn-sm btn-red" onClick={() => hapusProduk(p.id, p.nama)}>Hapus</button>
                            </div>
                          </Show>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </div>
        </Show>

        {/* ========== TRANSAKSI ========== */}
        <Show when={tab() === "transaksi"}>
          <div class="fade-in">
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-lg font-semibold text-white">Riwayat Transaksi</h2>
              <button class="btn-sm btn-indigo" onClick={openTrxModal}>+ Tambah Transaksi</button>
            </div>
            <div class="glass overflow-hidden">
              <table class="data-table">
                <thead><tr><th>Tanggal</th><th>Toko</th><th>Total</th><th>Items</th><th>Aksi</th></tr></thead>
                <tbody>
                  <For each={daftarTransaksi()} fallback={<tr><td colspan="5"><EmptyState type="transaksi" title="Belum ada transaksi" description="Transaksi yang kamu buat akan muncul di sini." /></td></tr>}>
                    {(trx) => (
                      <tr>
                        <td class="font-mono text-xs">{new Date(trx.created_at).toLocaleString("id-ID")}</td>
                        <td class="text-xs">{getTokoNama(trx.toko_id)}</td>
                        <td class="text-white font-medium rupiah">Rp {formatRupiah(trx.total)}</td>
                        <td class="text-xs">{(() => { try { return JSON.parse(trx.items_json || "[]").length + " item"; } catch { return "0 item"; } })()}</td>
                        <td>
                          <Show when={canEdit()} fallback={<span class="text-xs text-zinc-600">—</span>}>
                            <button class="btn-sm btn-red" onClick={() => hapusTransaksi(trx.id)}>Hapus</button>
                          </Show>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </div>
        </Show>

        {/* ========== USERS (admin only) ========== */}
        <Show when={tab() === "users" && canManageUsers()}>
          <div class="fade-in">
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-lg font-semibold text-white">Daftar User</h2>
              <button class="btn-sm btn-indigo" onClick={() => { setModalUser({ role: "kasir" }); setShowUserModal(true); }}>+ Tambah User</button>
            </div>
            <div class="glass overflow-hidden">
              <table class="data-table">
                <thead><tr><th>Username</th><th>Nama</th><th>Role</th><th>Dibuat</th><th>Aksi</th></tr></thead>
                <tbody>
                  <For each={daftarUsers()} fallback={<tr><td colspan="5"><EmptyState type="users" title="Belum ada user" description="Tambahkan user (kasir/manajer) untuk mengelola akses dashboard." action={canEdit() ? { label: "+ Tambah User", onClick: () => { setModalUser({}); setShowUserModal(true); } } : undefined} /></td></tr>}>
                    {(u) => (
                      <tr>
                        <td class="text-white font-medium font-mono">{u.username}</td>
                        <td>{u.nama}</td>
                        <td>
                          <span class={`badge ${u.role === "admin" ? "badge-indigo" : u.role === "manajer" ? "badge-emerald" : "badge-amber"}`}>{u.role}</span>
                        </td>
                        <td class="text-xs text-zinc-500 font-mono">{new Date(u.created_at).toLocaleDateString("id-ID")}</td>
                        <td>
                          <div class="flex gap-2">
                            <button class="btn-sm btn-ghost" onClick={() => editUser(u)}>Edit</button>
                            <button class="btn-sm btn-red" onClick={() => hapusUser(u.id, u.username)} disabled={u.id === user()?.id}>Hapus</button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </div>
        </Show>

        {/* ========== AUDIT LOGS (admin only) ========== */}
        <Show when={tab() === "audit" && canViewAudit()}>
          <div class="fade-in">
            <div class="flex justify-between items-center mb-4 gap-3 flex-wrap">
              <h2 class="text-lg font-semibold text-white">Audit Logs</h2>
              <div class="flex gap-2 items-center">
                <select
                  class="glass-input"
                  style="width: auto; padding: 6px 12px; font-size: 13px;"
                  value={auditFilter()}
                  onChange={(e) => { setAuditFilter(e.currentTarget.value); loadAudit(e.currentTarget.value); }}
                >
                  <option value="">Semua entity</option>
                  <option value="user">user</option>
                  <option value="toko">toko</option>
                  <option value="produk">produk</option>
                  <option value="transaksi">transaksi</option>
                  <option value="auth">auth</option>
                </select>
                <button class="btn-sm btn-ghost" onClick={() => loadAudit(auditFilter())}>Refresh</button>
              </div>
            </div>
            <div class="glass overflow-hidden">
              <table class="data-table">
                <thead><tr><th>Waktu</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
                <tbody>
                  <For each={daftarAudit()} fallback={<tr><td colspan="5"><EmptyState type="audit" title="Belum ada log audit" description="Aktivitas user (login, CRUD, dll) akan tercatat di sini." /></td></tr>}>
                    {(log) => (
                      <tr>
                        <td class="font-mono text-xs">{new Date(log.created_at).toLocaleString("id-ID")}</td>
                        <td class="text-xs">{log.username || "—"}</td>
                        <td>
                          <span class={`badge ${log.action === "DELETE" ? "badge-amber" : log.action === "CREATE" ? "badge-emerald" : "badge-indigo"}`}>{log.action}</span>
                        </td>
                        <td class="text-xs">{log.entity_type}{log.entity_id ? ` / ${log.entity_id.slice(0, 8)}...` : ""}</td>
                        <td class="text-xs text-zinc-500 font-mono max-w-xs truncate">{log.details || "—"}</td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </div>
        </Show>
      </main>

      {/* ========== MODAL TOKO ========== */}
      <Show when={showTokoModal()}>
        <div class="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowTokoModal(false); }}>
          <div class="modal-box">
            <h3 class="text-lg font-bold text-white mb-5">{modalToko()?.id ? "Edit Toko" : "Tambah Toko"}</h3>
            <form onSubmit={saveToko} class="space-y-4">
              <div>
                <label class="text-xs font-medium text-zinc-400 mb-1 block">Nama Toko</label>
                <input class="glass-input" value={modalToko()?.nama || ""} onInput={(e) => setModalToko((prev) => ({ ...prev, nama: e.currentTarget.value }))} placeholder="Nama toko" required />
              </div>
              <div>
                <label class="text-xs font-medium text-zinc-400 mb-1 block">Alamat</label>
                <input class="glass-input" value={modalToko()?.alamat || ""} onInput={(e) => setModalToko((prev) => ({ ...prev, alamat: e.currentTarget.value }))} placeholder="Alamat toko" />
              </div>
              <div>
                <label class="text-xs font-medium text-zinc-400 mb-1 block">Telepon</label>
                <input class="glass-input" value={modalToko()?.telepon || ""} onInput={(e) => setModalToko((prev) => ({ ...prev, telepon: e.currentTarget.value }))} placeholder="08xx-xxxx-xxxx" />
              </div>
              <div class="flex gap-3 pt-2">
                <button type="button" class="btn-sm btn-ghost flex-1" onClick={() => setShowTokoModal(false)}>Batal</button>
                <button type="submit" class="btn-sm btn-indigo flex-1">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* ========== MODAL PRODUK ========== */}
      <Show when={showProdukModal()}>
        <div class="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowProdukModal(false); }}>
          <div class="modal-box">
            <h3 class="text-lg font-bold text-white mb-5">{modalProduk()?.id ? "Edit Produk" : "Tambah Produk"}</h3>
            <form onSubmit={saveProduk} class="space-y-4">
              <div>
                <label class="text-xs font-medium text-zinc-400 mb-1 block">Nama Produk</label>
                <input class="glass-input" value={modalProduk()?.nama || ""} onInput={(e) => setModalProduk((prev) => ({ ...prev, nama: e.currentTarget.value }))} placeholder="Nama produk" required />
              </div>
              <div>
                <label class="text-xs font-medium text-zinc-400 mb-1 block">Harga (Rp)</label>
                <input class="glass-input" type="number" value={modalProduk()?.harga || ""} onInput={(e) => setModalProduk((prev) => ({ ...prev, harga: e.currentTarget.value }))} placeholder="15000" required />
              </div>
              <div>
                <label class="text-xs font-medium text-zinc-400 mb-1 block">Stok</label>
                <input class="glass-input" type="number" value={modalProduk()?.stok || ""} onInput={(e) => setModalProduk((prev) => ({ ...prev, stok: e.currentTarget.value }))} placeholder="10" required />
              </div>
              <div>
                <label class="text-xs font-medium text-zinc-400 mb-1 block">Toko</label>
                <select class="glass-input" value={modalProduk()?.toko_id || ""} onChange={(e) => setModalProduk((prev) => ({ ...prev, toko_id: e.currentTarget.value }))} required>
                  <option value="" disabled>Pilih toko</option>
                  <For each={daftarToko()}>
                    {(t) => <option value={t.id}>{t.nama}</option>}
                  </For>
                </select>
              </div>
              <div class="flex gap-3 pt-2">
                <button type="button" class="btn-sm btn-ghost flex-1" onClick={() => setShowProdukModal(false)}>Batal</button>
                <button type="submit" class="btn-sm btn-indigo flex-1">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* ========== MODAL USER (admin) ========== */}
      <Show when={showUserModal()}>
        <div class="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowUserModal(false); }}>
          <div class="modal-box">
            <h3 class="text-lg font-bold text-white mb-5">{modalUser()?.id ? "Edit User" : "Tambah User"}</h3>
            <form onSubmit={saveUser} class="space-y-4">
              <div>
                <label class="text-xs font-medium text-zinc-400 mb-1 block">Username</label>
                <input class="glass-input" value={modalUser()?.username || ""} onInput={(e) => setModalUser((prev) => ({ ...prev, username: e.currentTarget.value }))} placeholder="username" required disabled={!!modalUser()?.id} />
                <Show when={modalUser()?.id}>
                  <p class="text-xs text-zinc-600 mt-1">Username tidak bisa diubah</p>
                </Show>
              </div>
              <div>
                <label class="text-xs font-medium text-zinc-400 mb-1 block">Nama Lengkap</label>
                <input class="glass-input" value={modalUser()?.nama || ""} onInput={(e) => setModalUser((prev) => ({ ...prev, nama: e.currentTarget.value }))} placeholder="Nama lengkap" required />
              </div>
              <div>
                <label class="text-xs font-medium text-zinc-400 mb-1 block">Role</label>
                <select class="glass-input" value={modalUser()?.role || "kasir"} onChange={(e) => setModalUser((prev) => ({ ...prev, role: e.currentTarget.value }))} required>
                  <option value="kasir">kasir</option>
                  <option value="manajer">manajer</option>
                  <option value="admin">admin</option>
                </select>
              </div>
              <div>
                <label class="text-xs font-medium text-zinc-400 mb-1 block">
                  Password {modalUser()?.id ? "(kosongkan jika tidak ganti)" : ""}
                </label>
                <input class="glass-input" type="password" value={modalUser()?.password || ""} onInput={(e) => setModalUser((prev) => ({ ...prev, password: e.currentTarget.value }))} placeholder={modalUser()?.id ? "•••••• (opsional)" : "Minimal 6 karakter"} required={!modalUser()?.id} />
              </div>
              <div class="flex gap-3 pt-2">
                <button type="button" class="btn-sm btn-ghost flex-1" onClick={() => setShowUserModal(false)}>Batal</button>
                <button type="submit" class="btn-sm btn-indigo flex-1">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* ========== MODAL TAMBAH TRANSAKSI ========== */}
      <Show when={showTrxModal()}>
        <div class="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowTrxModal(false); }}>
          <div class="modal-box" style="max-width: 560px;">
            <h3 class="text-lg font-bold text-white mb-5">Tambah Transaksi</h3>
            <form onSubmit={saveTrx} class="space-y-4">
              <div>
                <label class="text-xs font-medium text-zinc-400 mb-1 block">Toko</label>
                <select class="glass-input" value={trxForm().toko_id} onChange={(e) => setTrxForm((prev) => ({ ...prev, toko_id: e.currentTarget.value }))} required>
                  <option value="" disabled>Pilih toko</option>
                  <For each={daftarToko()}>
                    {(t) => <option value={t.id}>{t.nama}</option>}
                  </For>
                </select>
              </div>

              {/* Items list */}
              <div>
                <label class="text-xs font-medium text-zinc-400 mb-2 block">Items ({trxForm().items.length})</label>
                <div class="space-y-2 mb-3">
                  <For each={trxForm().items} fallback={<p class="text-xs text-zinc-600 italic">Belum ada item</p>}>
                    {(item, idx) => (
                      <div class="flex items-center justify-between bg-white/[0.03] rounded-lg px-3 py-2">
                        <div class="text-sm">
                          <span class="text-white">{item.nama}</span>
                          <span class="text-xs text-zinc-500 ml-2">Rp {formatRupiah(item.harga)} × {item.qty}</span>
                        </div>
                        <div class="flex items-center gap-3">
                          <span class="text-sm font-mono text-emerald-400">Rp {formatRupiah(item.harga * item.qty)}</span>
                          <button type="button" class="text-zinc-500 hover:text-red-400" onClick={() => removeTrxItem(idx())}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </For>
                </div>

                {/* Add item form */}
                <div class="grid grid-cols-12 gap-2">
                  <input class="glass-input col-span-5" placeholder="Nama item" value={trxItemForm().nama} onInput={(e) => setTrxItemForm((prev) => ({ ...prev, nama: e.currentTarget.value }))} />
                  <input class="glass-input col-span-4" type="number" placeholder="Harga" value={trxItemForm().harga} onInput={(e) => setTrxItemForm((prev) => ({ ...prev, harga: e.currentTarget.value }))} />
                  <input class="glass-input col-span-2" type="number" placeholder="Qty" value={trxItemForm().qty} onInput={(e) => setTrxItemForm((prev) => ({ ...prev, qty: e.currentTarget.value }))} />
                  <button type="button" class="btn-sm btn-indigo col-span-1" onClick={addTrxItem}>+</button>
                </div>
              </div>

              {/* Total */}
              <div class="border-t border-white/10 pt-3 space-y-1.5">
                <div class="flex justify-between text-xs text-zinc-400">
                  <span>Subtotal</span><span class="font-mono">Rp {formatRupiah(trxSubtotal())}</span>
                </div>
                <div class="flex justify-between text-xs text-zinc-400">
                  <span>Pajak (11%)</span><span class="font-mono">Rp {formatRupiah(trxSubtotal() * 0.11)}</span>
                </div>
                <div class="flex justify-between text-base font-bold pt-1">
                  <span>Total</span><span class="font-mono text-emerald-400">Rp {formatRupiah(trxTotal())}</span>
                </div>
              </div>

              <div class="flex gap-3 pt-2">
                <button type="button" class="btn-sm btn-ghost flex-1" onClick={() => setShowTrxModal(false)}>Batal</button>
                <button type="submit" class="btn-sm btn-indigo flex-1">Simpan Transaksi</button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* ========== MODAL LOW STOCK DETAIL ========== */}
      <Show when={showLowStockModal()}>
        <div class="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowLowStockModal(false); }}>
          <div class="modal-box" style="max-width: 600px;">
            <h3 class="text-lg font-bold text-white mb-1">Produk Stok Menipis</h3>
            <p class="text-xs text-zinc-500 mb-4">{lowStockItems().length} produk perlu restock</p>
            <div class="space-y-2 max-h-[400px] overflow-y-auto">
              <For each={lowStockItems()} fallback={<p class="text-sm text-zinc-600 text-center py-6">Tidak ada produk stok menipis</p>}>
                {(item) => (
                  <div class="flex items-center justify-between bg-white/[0.03] rounded-lg px-3 py-2.5 border border-amber-500/15">
                    <div>
                      <p class="text-sm font-medium text-white">{item.nama}</p>
                      <p class="text-xs text-zinc-500">{item.toko_nama}</p>
                    </div>
                    <div class="text-right">
                      <p class="text-sm font-semibold text-amber-400">{item.stok} <span class="text-xs text-zinc-500 font-normal">/ threshold {item.stock_threshold}</span></p>
                      <p class="text-xs text-zinc-500 font-mono">Rp {formatRupiah(item.harga)}</p>
                    </div>
                  </div>
                )}
              </For>
            </div>
            <div class="flex gap-3 pt-4">
              <button type="button" class="btn-sm btn-indigo w-full" onClick={() => setShowLowStockModal(false)}>Tutup</button>
            </div>
          </div>
        </div>
      </Show>
    </div>

    {/* Session timeout warning modal */}
    <SessionTimeoutModal
      show={sessionTimeout.showWarning()}
      secondsLeft={sessionTimeout.secondsLeft()}
      onExtend={sessionTimeout.extend}
      onLogout={sessionTimeout.logoutNow}
    />
    </>
  );
}
