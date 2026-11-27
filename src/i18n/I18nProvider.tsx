import { useLayoutEffect, useSyncExternalStore, type ReactNode } from "react";
import type { UiPreferences } from "../lib/uiPreferences";
import { rememberUiLocale } from "./locales";
import { UiPreferencesContext } from "./useI18n";

export function I18nProvider({ preferences, children }: { preferences: UiPreferences; children: ReactNode }) {
  const { locale } = useSyncExternalStore(preferences.subscribe, preferences.getSnapshot);

  useLayoutEffect(() => rememberUiLocale(locale), [locale]);
  useLayoutEffect(() => preferences.listenToEnvironment(), [preferences]);

  return <UiPreferencesContext.Provider value={preferences}>{children}</UiPreferencesContext.Provider>;
}
