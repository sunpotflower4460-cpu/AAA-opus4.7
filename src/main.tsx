import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { readNativePreferredLanguages } from "./i18n/nativeLanguages";
import { isUiLocale, rememberUiLocale } from "./i18n/locales";
import { createUiPreferences, LANGUAGE_STORAGE_KEY } from "./lib/uiPreferences";
import { readDisplaySetting } from "./lib/displayStorage";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import "@fontsource/yuji-syuku/japanese-400.css";
import "@fontsource/yuji-syuku/latin-400.css";
import "@fontsource/yuji-boku/japanese-400.css";
import "@fontsource/yuji-boku/latin-400.css";
import "@fontsource/klee-one/japanese-400.css";
import "@fontsource/klee-one/latin-400.css";
import { initBrush } from "./lib/brushPreference";
import "./index.css";
import "./phase19.css";
import "./phase21.css";
import "./phase22.css";
import "./phase23.css";
import "./phase24.css";
import "./phase25.css";
import "./phase27.css";
import "./phase28.css";
import "./phase29.css";
import "./phase30.css";
import "./release.css";

// 描画前に筆あとを反映し、字体の切り替わりでちらつかないようにする。
initBrush();

const root = document.getElementById("root");

if (!root) {
  throw new Error('Root element #root not found in index.html. Ensure the HTML template includes <div id="root"></div>.');
}

async function start(container: HTMLElement) {
  const explicit = isUiLocale(readDisplaySetting(LANGUAGE_STORAGE_KEY).value);
  const nativeLanguages = readNativePreferredLanguages();
  const preferences = createUiPreferences(explicit ? null : await nativeLanguages);
  if (explicit) void nativeLanguages.then(preferences.setNativeLanguages);
  rememberUiLocale(preferences.getSnapshot().locale);

  ReactDOM.createRoot(container).render(
    <React.StrictMode>
      <AppErrorBoundary>
        <App preferences={preferences} />
      </AppErrorBoundary>
    </React.StrictMode>,
  );
}

void start(root);
