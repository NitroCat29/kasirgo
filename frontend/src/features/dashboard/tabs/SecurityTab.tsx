// ============================================================
// SecurityTab — admin-only tab: TOTP 2FA setup
// ============================================================
import TotpSetup from "../../../components/TotpSetup";

export default function SecurityTab() {
  return (
    <div class="space-y-6">
      <div>
        <h2 class="text-xl font-bold text-white">Keamanan</h2>
        <p class="text-sm text-kasir-muted">Pengaturan keamanan akun dan autentikasi.</p>
      </div>
      <TotpSetup />
    </div>
  );
}
