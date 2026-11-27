import { Capacitor, registerPlugin } from "@capacitor/core";

type AppLanguagePlugin = {
  getPreferredLocalizations(): Promise<{ languages: string[] }>;
};

const NATIVE_LANGUAGE_TIMEOUT_MS = 300;

export async function readNativePreferredLanguages(): Promise<readonly string[] | null> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    if (Capacitor.getPlatform() !== "ios") return null;
    const plugin = registerPlugin<AppLanguagePlugin>("ZanshinAppLanguage");
    const pending = plugin.getPreferredLocalizations().then(({ languages }) =>
      Array.isArray(languages) ? languages.filter((tag) => typeof tag === "string") : null,
    );
    const deadline = new Promise<null>((resolve) => {
      timeout = setTimeout(() => resolve(null), NATIVE_LANGUAGE_TIMEOUT_MS);
    });
    // A late result is ignored, even if the user switches back to System later.
    return await Promise.race([pending, deadline]);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
