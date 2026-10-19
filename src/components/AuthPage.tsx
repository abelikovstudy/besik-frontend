import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, Mail } from "lucide-react";
import type { useAuth } from "../hooks/useAuth";
import { useLanguage } from "../hooks/useLanguage";
import {
  demoMode,
  getAuthOptions,
  register,
  resendVerification,
  startGoogleSignIn,
  verifyEmail,
} from "../lib/api";
import { safeReturnTo } from "../lib/auth";
import { isLanguage } from "../lib/translations";

type Mode = "login" | "register" | "resend" | "verify";
const returnKey = "besik-auth-return";
const googleKey = "besik-google-pending";
const authErrors: Record<string, string> = {
  EMAIL_NOT_VERIFIED: "Подтвердите email по ссылке из письма, затем войдите.",
  "Invalid or expired verification link":
    "Ссылка подтверждения недействительна или устарела. Запросите новое письмо.",
  "Username unavailable": "Этот логин уже занят.",
  "Username, email or customer is already in use":
    "Этот логин или email уже используется.",
  "Unable to send verification email; please try resending":
    "Не удалось отправить письмо. Запросите его повторно.",
  "Too many authentication requests; try later":
    "Слишком много попыток. Попробуйте позже.",
};

export function AuthPage({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const { t, language, setLanguage } = useLanguage();
  const [token, setToken] = useState(() =>
    new URLSearchParams(window.location.search).get("token"),
  );
  const [mode, setMode] = useState<Mode>(() =>
    window.location.pathname.startsWith("/verify-email") || token !== null
      ? "verify"
      : new URLSearchParams(window.location.search).get("mode") === "register"
        ? "register"
        : "login",
  );
  const [returnTo] = useState(() => {
    const target = new URLSearchParams(window.location.search).get("returnTo");
    try {
      return safeReturnTo(target ?? sessionStorage.getItem(returnKey));
    } catch {
      return safeReturnTo(target);
    }
  });
  const [options, setOptions] = useState<{
    googleEnabled: boolean;
    emailEnabled: boolean;
  } | null>(null);
  const [optionsError, setOptionsError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(() =>
    new URLSearchParams(window.location.search).get(
      "emailVerificationRequired",
    ) === "true"
      ? "Подтвердите email по ссылке из письма, затем войдите."
      : "",
  );
  const [email, setEmail] = useState("");

  useEffect(() => {
    // Keep only the return address across the Google redirect, never credentials.
    try {
      sessionStorage.setItem(returnKey, returnTo);
    } catch {
      /* Storage is optional. */
    }
    const url = new URL(window.location.href);
    if (url.searchParams.has("token")) {
      url.searchParams.delete("token");
      window.history.replaceState(
        null,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }
  }, [returnTo]);

  useEffect(() => {
    if (demoMode) return;
    const controller = new AbortController();
    setOptionsError(false);
    getAuthOptions(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setOptions(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) setOptionsError(true);
      });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    if (auth.loading) return;
    try {
      if (sessionStorage.getItem(googleKey)) {
        sessionStorage.removeItem(googleKey);
        if (auth.user) window.location.replace(returnTo);
      }
    } catch {
      /* The account view still provides a return link. */
    }
  }, [auth.loading, auth.user, returnTo]);

  function changeMode(next: Mode) {
    setMode(next);
    setError("");
    setMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || demoMode || auth.loading) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "verify") {
        if (!token || !/^[a-f0-9]{64}$/.test(token))
          throw new Error("Invalid or expired verification link");
        await verifyEmail(token);
        setToken(null);
        setMode("login");
        setMessage("Email подтверждён. Теперь вы можете войти.");
      } else if (mode === "resend") {
        await resendVerification(email.trim());
        setMessage(
          "Если email ожидает подтверждения, мы отправим письмо. Проверьте также папку «Спам».",
        );
      } else {
        const username = String(values.get("username") || "").trim();
        const password = String(values.get("password") || "");
        if (mode === "register") {
          await register(username, email.trim(), password);
          form.reset();
          setMode("login");
          setMessage("Подтвердите email по ссылке из письма, затем войдите.");
        } else {
          await auth.signIn(username, password);
          window.location.assign(returnTo);
        }
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Не удалось выполнить запрос. Попробуйте ещё раз.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function googleSignIn() {
    if (busy || demoMode || auth.loading) return;
    setBusy(true);
    setError("");
    try {
      const { authorizationUrl } = await startGoogleSignIn();
      const url = new URL(authorizationUrl);
      if (url.origin !== "https://accounts.google.com")
        throw new Error(
          "Не удалось начать вход через Google. Попробуйте ещё раз.",
        );
      try {
        sessionStorage.setItem(googleKey, "1");
      } catch {
        /* Storage is optional. */
      }
      window.location.assign(url.href);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Не удалось начать вход через Google. Попробуйте ещё раз.",
      );
      setBusy(false);
    }
  }

  const showAccount = mode !== "verify" ? auth.user : null;
  const title = showAccount
    ? "Аккаунт"
    : mode === "register"
      ? "Создать аккаунт"
      : mode === "resend"
        ? "Подтвердить email"
        : mode === "verify"
          ? "Подтвердить email"
          : "С возвращением";
  const disabled = busy || auth.loading || demoMode;

  return (
    <div className="auth-page">
      <header className="auth-header">
        <a className="logo" href={returnTo}>
          Shop<span>®</span>
        </a>
        <label className="language-switch">
          <span className="sr-only">{t("Язык")}</span>
          <select
            value={language}
            onChange={(event) => {
              if (isLanguage(event.target.value))
                setLanguage(event.target.value);
            }}
          >
            <option value="en" lang="en">
              EN
            </option>
            <option value="ka" lang="ka">
              KA
            </option>
            <option value="ru" lang="ru">
              RU
            </option>
          </select>
        </label>
      </header>
      <main className="auth-layout">
        <section
          className="auth-panel"
          aria-labelledby="auth-title"
          aria-busy={busy}
        >
          <a className="auth-back text-button" href={returnTo}>
            <ArrowLeft size={16} />
            {t("Вернуться в каталог")}
          </a>
          <span className="eyebrow">{t("Ваше пространство")}</span>
          <h1 id="auth-title">{t(title)}</h1>
          {!auth.user && !["verify", "resend"].includes(mode) && (
            <div className="auth-tabs" aria-label={t("Вход и регистрация")}>
              <button
                type="button"
                aria-pressed={mode === "login"}
                disabled={busy}
                onClick={() => changeMode("login")}
              >
                {t("Войти")}
              </button>
              <button
                type="button"
                aria-pressed={mode === "register"}
                disabled={busy}
                onClick={() => changeMode("register")}
              >
                {t("Регистрация")}
              </button>
            </div>
          )}
          {(error || auth.error) && (
            <p className="form-error" role="alert">
              {t(authErrors[error] || error || auth.error)}
            </p>
          )}
          {message && (
            <p className="auth-message" role="status">
              <Check size={18} />
              {t(message)}
            </p>
          )}
          {demoMode && (
            <p className="form-error">
              {t("В деморежиме вход и регистрация отключены.")}
            </p>
          )}
          {auth.loading && (
            <p className="muted" role="status">
              {t("Проверяем сессию…")}
            </p>
          )}
          {showAccount ? (
            <div className="auth-form">
              <p>
                {t("Вы вошли как {username}", {
                  username: showAccount.username,
                })}
              </p>
              <a className="button primary full" href={returnTo}>
                {t("Продолжить покупки")}
                <ArrowRight size={17} />
              </a>
              <button
                className="button secondary full"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await auth.signOut();
                    window.location.assign(returnTo);
                  } catch {
                    setError("Не удалось выйти. Попробуйте ещё раз.");
                    setBusy(false);
                  }
                }}
              >
                {t(busy ? "Подождите…" : "Выйти")}
              </button>
            </div>
          ) : (
            <>
              {optionsError && (
                <p className="form-error" role="alert">
                  {t("Не удалось загрузить способы регистрации.")}{" "}
                  <button
                    className="text-button"
                    onClick={() => setAttempt((value) => value + 1)}
                  >
                    {t("Попробовать снова")}
                  </button>
                </p>
              )}
              {!options && !optionsError && !demoMode && (
                <p className="muted" role="status">
                  {t("Загружаем способы входа…")}
                </p>
              )}
              {options?.googleEnabled &&
                ["login", "register"].includes(mode) && (
                  <>
                    <button
                      className="button secondary full auth-google"
                      disabled={disabled}
                      onClick={googleSignIn}
                    >
                      <span className="google-mark" aria-hidden="true">
                        G
                      </span>
                      {t(busy ? "Подождите…" : "Продолжить с Google")}
                    </button>
                    {(mode === "login" || options.emailEnabled) && (
                      <div className="auth-divider">
                        {t("или по логину и паролю")}
                      </div>
                    )}
                  </>
                )}
              {mode === "login" ||
              mode === "verify" ||
              options?.emailEnabled ? (
                <form key={mode} className="auth-form" onSubmit={submit}>
                  {mode === "verify" ? (
                    <>
                      <Mail size={28} strokeWidth={1.4} aria-hidden="true" />
                      <p>
                        {t("Подтвердите адрес, чтобы завершить регистрацию.")}
                      </p>
                    </>
                  ) : (
                    <>
                      {["register", "resend"].includes(mode) && (
                        <label>
                          {t("Email")}
                          <input
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            maxLength={320}
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            disabled={disabled}
                          />
                        </label>
                      )}
                      {mode !== "resend" && (
                        <>
                          <label>
                            {t("Логин")}
                            <input
                              name="username"
                              autoComplete="username"
                              required
                              minLength={3}
                              maxLength={100}
                              pattern={"[a-zA-Z0-9_.@\\-]{3,100}"}
                              title={t(
                                "От 3 до 100 символов: латинские буквы, цифры, _, ., @ и -.",
                              )}
                              disabled={disabled}
                            />
                          </label>
                          <label>
                            {t("Пароль")}
                            <input
                              name="password"
                              type="password"
                              autoComplete={
                                mode === "register"
                                  ? "new-password"
                                  : "current-password"
                              }
                              required
                              minLength={12}
                              maxLength={128}
                              aria-describedby={
                                mode === "register"
                                  ? "password-hint"
                                  : undefined
                              }
                              disabled={disabled}
                            />
                            {mode === "register" && (
                              <span className="muted" id="password-hint">
                                {t("От 12 до 128 символов")}
                              </span>
                            )}
                          </label>
                        </>
                      )}
                    </>
                  )}
                  <button className="button primary full" disabled={disabled}>
                    {t(
                      busy
                        ? "Подождите…"
                        : mode === "register"
                          ? "Зарегистрироваться"
                          : mode === "login"
                            ? "Войти"
                            : mode === "verify"
                              ? "Подтвердить email"
                              : "Отправить письмо повторно",
                    )}
                    {!busy && <ArrowRight size={17} />}
                  </button>
                </form>
              ) : (
                options && (
                  <p className="muted">
                    {t(
                      options.googleEnabled
                        ? "Регистрация по email пока недоступна. Продолжите с Google."
                        : "Регистрация сейчас отключена. Можно войти в существующий аккаунт.",
                    )}
                  </p>
                )
              )}
              {mode === "register" &&
                options &&
                !options.emailEnabled &&
                !options.googleEnabled && (
                  <button
                    className="button primary full"
                    onClick={() => changeMode("login")}
                  >
                    {t("Перейти ко входу")}
                    <ArrowRight size={17} />
                  </button>
                )}
              {options?.emailEnabled && mode !== "resend" && (
                <button
                  className="text-button auth-resend"
                  disabled={busy}
                  onClick={() => changeMode("resend")}
                >
                  {t("Не пришло письмо подтверждения?")}
                </button>
              )}
              {["resend", "verify"].includes(mode) && (
                <button
                  className="text-button auth-resend"
                  disabled={busy}
                  onClick={() => changeMode("login")}
                >
                  {t("Перейти ко входу")}
                </button>
              )}
              <p className="auth-footnote">
                {t(
                  "Войдите, чтобы оформить заказ. Каталог и корзина доступны без регистрации.",
                )}
              </p>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
