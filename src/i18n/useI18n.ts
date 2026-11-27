import { createContext, useContext, useSyncExternalStore } from "react";
import type { UiPreferences } from "../lib/uiPreferences";
import { messages } from "../lib/i18n";

export const UiPreferencesContext = createContext<UiPreferences | null>(null);

export function useI18n() {
  const preferences = useContext(UiPreferencesContext);
  if (!preferences) throw new Error("UI preferences provider is missing");
  const snapshot = useSyncExternalStore(preferences.subscribe, preferences.getSnapshot);
  return { ...snapshot, copy: messages[snapshot.locale], preferences };
}
