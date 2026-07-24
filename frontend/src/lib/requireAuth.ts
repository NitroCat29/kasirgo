// ============================================================
// KasirGo — Shared auth guard for protected routes
// ============================================================
import { fetchMe, user, type User } from "./auth";

/**
 * Ensure session is present.
 * - If `user()` already set → return it
 * - Else `fetchMe()`; on null → navigate to /login and return null
 */
export async function requireAuth(
  navigate: (path: string) => void,
): Promise<User | null> {
  const current = user();
  if (current) return current;
  const me = await fetchMe();
  if (!me) {
    navigate("/login");
    return null;
  }
  return me;
}
