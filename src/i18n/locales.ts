export const PUBLIC_UI_LOCALES = ["ja", "en"] as const;
export type UiLocale = (typeof PUBLIC_UI_LOCALES)[number];
export type LanguagePreference = "system" | UiLocale;
export const DEFAULT_UI_LOCALE: UiLocale = "en";

export function isUiLocale(value: string | null): value is UiLocale {
  return PUBLIC_UI_LOCALES.some((locale) => value === locale);
}

export function resolveUiLocale(
  preference: string | null,
  preferredLanguages: readonly string[],
): UiLocale {
  if (isUiLocale(preference)) return preference;

  for (const tag of preferredLanguages) {
    try {
      const [canonical] = Intl.getCanonicalLocales(tag);
      if (!canonical) continue;
      const language = canonical.split("-")[0];
      if (isUiLocale(language)) return language;
    } catch {
      // One malformed tag does not invalidate the rest of the preference list.
    }
  }
  return DEFAULT_UI_LOCALE;
}

export function webPreferredLanguages(): readonly string[] {
  if (typeof navigator === "undefined") return [];
  return navigator.languages?.length ? navigator.languages : [navigator.language];
}

let lastUiLocale: UiLocale = DEFAULT_UI_LOCALE;

export function rememberUiLocale(locale: UiLocale) {
  lastUiLocale = locale;
  document.documentElement.lang = locale;
}

export function getLastUiLocale(): UiLocale {
  return lastUiLocale;
}
