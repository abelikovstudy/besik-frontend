import { useEffect, useState, type FormEvent } from "react";
import type { SessionUser } from "../types";
import { getAuthOptions } from "../lib/api";
import { useLanguage } from "../hooks/useLanguage";
import { Dialog } from "./Dialog";

export function AuthDialog({
  user,
  signIn,
  signOut,
  onClose,
}: {
  user: SessionUser | null;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [registrationUnavailable, setRegistrationUnavailable] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    getAuthOptions(controller.signal)
      .then((options) =>
        setRegistrationUnavailable(
          !options.emailEnabled && !options.googleEnabled,
        ),
      )
      .catch(() => {});
    return () => controller.abort();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setError("");
    try {
      await signIn(
        String(values.get("username") || "").trim(),
        String(values.get("password") || ""),
      );
      form.reset();
      onClose();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Не удалось войти. Проверьте логин и пароль.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      title={t(user ? "Аккаунт" : "Вход в магазин")}
      onClose={onClose}
      busy={busy}
    >
      {error && (
        <p className="form-error" role="alert">
          {t(error)}
        </p>
      )}
      {user ? (
        <div className="auth-form">
          <p>{t("Вы вошли как {username}", { username: user.username })}</p>
          <button
            className="button primary full"
            disabled={busy}
            onClick={async () => {
              if (busy) return;
              setBusy(true);
              setError("");
              try {
                await signOut();
                onClose();
              } catch {
                setError("Не удалось выйти. Попробуйте ещё раз.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {t(busy ? "Подождите…" : "Выйти")}
          </button>
        </div>
      ) : (
        <form className="auth-form" onSubmit={submit}>
          <p>{t("Войдите, чтобы оформить заказ. Каталог и корзина доступны без регистрации.")}</p>
          <label>
            {t("Логин")}
            <input
              name="username"
              autoComplete="username"
              required
              maxLength={100}
              disabled={busy}
            />
          </label>
          <label>
            {t("Пароль")}
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
              disabled={busy}
            />
          </label>
          <button className="button primary full" disabled={busy}>
            {t(busy ? "Подождите…" : "Войти")}
          </button>
          {registrationUnavailable && (
            <p>
              {t(
                "Регистрация пока недоступна. Используйте существующий аккаунт.",
              )}
            </p>
          )}
        </form>
      )}
    </Dialog>
  );
}
