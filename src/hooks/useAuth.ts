import { useEffect, useState } from "react";
import type { SessionUser } from "../types";
import { ApiError, demoMode, getSession, login, logout } from "../lib/api";

export function useAuth() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(!demoMode);
  const [error, setError] = useState("");

  useEffect(() => {
    if (demoMode) return;
    const controller = new AbortController();
    const expired = () => setUser(null);
    window.addEventListener("besik-session-expired", expired);
    getSession(controller.signal)
      .then((session) => {
        if (!controller.signal.aborted) setUser(session);
      })
      .catch((error: unknown) => {
        if (
          !controller.signal.aborted &&
          !(error instanceof ApiError && error.status === 401)
        )
          setError("Не удалось проверить сессию. Попробуйте войти ещё раз.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
      window.removeEventListener("besik-session-expired", expired);
    };
  }, []);

  async function signIn(username: string, password: string) {
    await login(username, password);
    setUser(await getSession());
    setError("");
  }

  async function signOut() {
    await logout();
    setUser(null);
    setError("");
  }

  return { user, loading, error, signIn, signOut };
}
