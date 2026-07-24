import { createSignal } from "solid-js";
import { api } from "../../../lib/api";
import {
  swalConfirm,
  swalApiError,
  swalToast,
  swalWarning,
} from "../../../lib/swal";
import type { UserRow } from "../../../components/dashboard/types";
import type { ToastLoadError } from "./loadError";

export interface UsersDataDeps {
  toastLoadError: ToastLoadError;
  setSubmitting: (v: boolean | ((p: boolean) => boolean)) => void;
}

export function useUsersData(deps: UsersDataDeps) {
  const [daftarUsers, setDaftarUsers] = createSignal<UserRow[]>([]);
  const [showUserModal, setShowUserModal] = createSignal(false);
  const [modalUser, setModalUser] = createSignal<
    Partial<UserRow & { password?: string }>
  >({});

  async function loadUsers() {
    try {
      const data = await api<UserRow[]>("/api/users");
      setDaftarUsers(data);
    } catch (err) {
      deps.toastLoadError("users", err);
    }
  }

  function editUser(u: UserRow) {
    setModalUser({ ...u, password: "" });
    setShowUserModal(true);
  }

  async function saveUser(e: Event) {
    e.preventDefault();
    const m = modalUser();
    if (!m.username || !m.nama) {
      swalWarning("Username & nama wajib diisi");
      return;
    }
    if (!m.id && !m.password) {
      swalWarning("Password wajib diisi untuk user baru");
      return;
    }
    deps.setSubmitting(true);
    const method = m.id ? "PATCH" : "POST";
    const url = m.id ? `/api/users/${m.id}` : "/api/users";

    let hashedPassword: string | undefined;
    if (m.password) {
      const buf = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(m.password),
      );
      hashedPassword = Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }

    try {
      await api<unknown>(url, {
        method,
        body: JSON.stringify({
          username: m.username,
          nama: m.nama,
          role: m.role || "kasir",
          ...(hashedPassword ? { password: hashedPassword } : {}),
        }),
      });
      setShowUserModal(false);
      swalToast("success", m.id ? "User diperbarui" : "User ditambahkan");
      await loadUsers();
    } catch (err: any) {
      swalApiError(err);
    } finally {
      deps.setSubmitting(false);
    }
  }

  async function hapusUser(id: string, nama: string) {
    const ok = await swalConfirm(
      "Hapus user?",
      `User "${nama}" akan dihapus permanen.`,
    );
    if (!ok) return;
    try {
      await api<unknown>(`/api/users/${id}`, { method: "DELETE" });
      swalToast("success", "User dihapus");
      await loadUsers();
    } catch (err: any) {
      swalApiError(err);
    }
  }

  return {
    daftarUsers,
    showUserModal,
    setShowUserModal,
    modalUser,
    setModalUser,
    loadUsers,
    editUser,
    saveUser,
    hapusUser,
  };
}
