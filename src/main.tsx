import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { LanguageProvider } from "./hooks/useLanguage";
import { PageProvider, type PageData } from "./hooks/usePage";
import { isLanguage } from "./lib/translations";

const serialized = document.getElementById("besik-page-data")?.textContent;
const requestedLanguage = new URLSearchParams(window.location.search).get(
  "lang",
);
const data: PageData = serialized
  ? JSON.parse(serialized)
  : {
      url: window.location.pathname + window.location.search,
      origin: window.location.origin,
      language: isLanguage(requestedLanguage) ? requestedLanguage : "ru",
      kind:
        window.location.pathname.startsWith("/auth") ||
        window.location.pathname.startsWith("/verify-email")
          ? "auth"
          : "catalog",
      catalog: null,
      images: {},
      rendered: false,
    };
const application = (
  <React.StrictMode>
    <PageProvider data={data}>
      <LanguageProvider initialLanguage={data.language}>
        <App />
      </LanguageProvider>
    </PageProvider>
  </React.StrictMode>
);
if (data.rendered)
  ReactDOM.hydrateRoot(document.getElementById("root")!, application);
else ReactDOM.createRoot(document.getElementById("root")!).render(application);
