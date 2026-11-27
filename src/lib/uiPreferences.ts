import {
  isUiLocale,
  resolveUiLocale,
  webPreferredLanguages,
  type LanguagePreference,
  type UiLocale,
} from "../i18n/locales";
import { BRUSH_STORAGE_KEY } from "./brushPreference";
import { readDisplaySetting, writeDisplaySetting } from "./displayStorage";

export const LANGUAGE_STORAGE_KEY = "zanshin.prefs.ui-language.v1";
export const READING_MODE_STORAGE_KEY = "zanshin.prefs.reading-mode.v1";

export type ReadingMode = "vertical" | "horizontal";

type PreferencesSnapshot = {
  language: LanguagePreference;
  locale: UiLocale;
  readingMode: ReadingMode;
  languageWriteFailed: boolean;
  readingWriteFailed: boolean;
};

const readingModeOf = (value: string | null): ReadingMode =>
  value === "horizontal" ? "horizontal" : "vertical";

export function createUiPreferences(nativeLanguages: readonly string[] | null = null) {
  let systemLanguages = nativeLanguages;
  const storedLanguage = readDisplaySetting(LANGUAGE_STORAGE_KEY);
  const storedReading = readDisplaySetting(READING_MODE_STORAGE_KEY);
  const storedBrush = readDisplaySetting(BRUSH_STORAGE_KEY);
  const canInitializeReading = storedReading.ok && storedReading.value === null;
  const hasNoPreviousSettings = storedLanguage.ok && storedLanguage.value === null
    && storedBrush.ok && storedBrush.value === null;
  const resolve = (value: string | null) => resolveUiLocale(value, systemLanguages ?? webPreferredLanguages());
  const listeners = new Set<() => void>();
  let readingInitialized = !canInitializeReading;
  let composing: Element | null = null;

  let snapshot: PreferencesSnapshot = {
    language: isUiLocale(storedLanguage.value) ? storedLanguage.value : "system",
    locale: resolve(storedLanguage.value),
    readingMode: readingModeOf(storedReading.value),
    languageWriteFailed: false,
    readingWriteFailed: false,
  };

  function publish(patch: Partial<PreferencesSnapshot>) {
    const next = { ...snapshot, ...patch };
    if (next.language === snapshot.language && next.locale === snapshot.locale
      && next.readingMode === snapshot.readingMode && next.languageWriteFailed === snapshot.languageWriteFailed
      && next.readingWriteFailed === snapshot.readingWriteFailed) return;
    snapshot = next;
    listeners.forEach((listener) => listener());
  }

  function localeFor(language: LanguagePreference) {
    return composing?.isConnected ? snapshot.locale : resolve(language);
  }

  function selectLanguage(language: LanguagePreference) {
    // Synchronous writes preserve the order of explicit selections on this device.
    const saved = writeDisplaySetting(LANGUAGE_STORAGE_KEY, language);
    publish({ language, locale: localeFor(language), languageWriteFailed: !saved });
  }

  function selectReadingMode(readingMode: ReadingMode) {
    readingInitialized = true;
    const saved = writeDisplaySetting(READING_MODE_STORAGE_KEY, readingMode);
    publish({ readingMode, readingWriteFailed: !saved });
  }

  function initializeReading(isNewInstallation: boolean) {
    if (readingInitialized) return;
    const setting = readDisplaySetting(READING_MODE_STORAGE_KEY);
    if (!setting.ok || setting.value !== null) {
      readingInitialized = true;
      publish({ readingMode: readingModeOf(setting.value) });
      return;
    }
    const mode = isNewInstallation && hasNoPreviousSettings && snapshot.locale === "en"
      ? "horizontal"
      : "vertical";
    selectReadingMode(mode);
  }

  function listenToEnvironment() {
    let finishedComposition: number | undefined;

    const refreshLocale = () => publish({ locale: localeFor(snapshot.language) });
    const startComposition = (event: Event) => {
      if (!(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) return;
      window.clearTimeout(finishedComposition);
      composing = event.target;
    };
    const endComposition = (event: Event) => {
      if (event.target !== composing) return;
      window.clearTimeout(finishedComposition);
      // Some engines dispatch the final input after compositionend or blur.
      finishedComposition = window.setTimeout(() => {
        composing = null;
        refreshLocale();
      }, 0);
    };
    const onStorage = (event: StorageEvent) => {
      // Read the current value when notified. A queued event can describe an older write.
      if (event.key === LANGUAGE_STORAGE_KEY && !snapshot.languageWriteFailed) {
        const setting = readDisplaySetting(LANGUAGE_STORAGE_KEY);
        if (!setting.ok) return;
        const language = isUiLocale(setting.value) ? setting.value : "system";
        publish({ language, locale: localeFor(language) });
      }
      if (event.key === READING_MODE_STORAGE_KEY && !snapshot.readingWriteFailed) {
        const setting = readDisplaySetting(READING_MODE_STORAGE_KEY);
        if (!setting.ok) return;
        if (setting.value !== null) readingInitialized = true;
        publish({ readingMode: readingModeOf(setting.value) });
      }
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("languagechange", refreshLocale);
    document.addEventListener("compositionstart", startComposition, true);
    document.addEventListener("compositionend", endComposition, true);
    document.addEventListener("focusout", endComposition, true);
    return () => {
      window.clearTimeout(finishedComposition);
      composing = null;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("languagechange", refreshLocale);
      document.removeEventListener("compositionstart", startComposition, true);
      document.removeEventListener("compositionend", endComposition, true);
      document.removeEventListener("focusout", endComposition, true);
    };
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setNativeLanguages(languages: readonly string[] | null) {
      systemLanguages = languages;
      publish({ locale: localeFor(snapshot.language) });
    },
    initializeReading,
    selectLanguage,
    selectReadingMode,
    listenToEnvironment,
  };
}

export type UiPreferences = ReturnType<typeof createUiPreferences>;
