import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { messages } from "../../lib/i18n";
import { createUiPreferences, LANGUAGE_STORAGE_KEY, READING_MODE_STORAGE_KEY } from "../../lib/uiPreferences";
import { loadNotes, STORAGE_KEY_FOR_TESTING } from "../../lib/storage";
import { PUBLIC_UI_LOCALES, resolveUiLocale } from "../locales";
import { readNativePreferredLanguages } from "../nativeLanguages";

const native = vi.hoisted(() => ({ preferred: vi.fn(), platform: vi.fn() }));
vi.mock("@capacitor/core", () => ({
  Capacitor: { getPlatform: native.platform },
  registerPlugin: () => ({ getPreferredLocalizations: native.preferred }),
}));

describe("日英の優先順と独立した表示設定", () => {
  beforeEach(() => {
    localStorage.clear();
    native.preferred.mockReset();
    native.platform.mockReturnValue("ios");
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it.each([
    ["ja", ["en-US"], "ja"],
    ["en", ["ja-JP"], "en"],
    ["system", ["fr-CA", "en_GB", "ja-JP", "en-US"], "ja"],
    ["system", ["en-GB", "ja-JP"], "en"],
    ["zh-Hant", ["fr-CA"], "en"],
    [null, [], "en"],
  ] as const)("希望 %s / 候補 %j を解決する", (preference, candidates, expected) => {
    expect(resolveUiLocale(preference, candidates)).toBe(expected);
  });

  it("native の取得成功では、空や未対応でもWeb候補で上書きしない", async () => {
    native.preferred.mockResolvedValue({ languages: ["en-GB"] });
    expect(createUiPreferences(await readNativePreferredLanguages()).getSnapshot().locale).toBe("en");
    native.preferred.mockResolvedValue({ languages: [] });
    expect(createUiPreferences(await readNativePreferredLanguages()).getSnapshot().locale).toBe("en");
  });

  it("native の無応答は打ち切り、後着後も最後の希望を維持する", async () => {
    vi.useFakeTimers();
    let complete!: (result: { languages: string[] }) => void;
    native.preferred.mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
    const started = readNativePreferredLanguages();
    await vi.advanceTimersByTimeAsync(301);
    const preferences = createUiPreferences(await started);
    expect(preferences.getSnapshot().locale).toBe("ja");
    preferences.selectLanguage("en");
    preferences.selectLanguage("ja");
    complete({ languages: ["en-US"] });
    await Promise.resolve();
    expect(preferences.getSnapshot().locale).toBe("ja");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("ja");
  });

  it("未知の希望や読書設定を勝手に消去しない", () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "zh-Hant");
    localStorage.setItem(READING_MODE_STORAGE_KEY, "future-direction");
    const preferences = createUiPreferences(["en-GB"]);
    preferences.initializeReading(true);
    expect(preferences.getSnapshot()).toMatchObject({ language: "system", locale: "en", readingMode: "vertical" });
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("zh-Hant");
    expect(localStorage.getItem(READING_MODE_STORAGE_KEY)).toBe("future-direction");
    preferences.selectLanguage("system");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("system");
  });

  it("設定保存失敗時は今の選択を維持し、遅れて届く他タブの通知で戻らない", () => {
    const preferences = createUiPreferences();
    const stop = preferences.listenToEnvironment();
    try {
      const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
      preferences.selectLanguage("en");
      expect(preferences.getSnapshot()).toMatchObject({ locale: "en", languageWriteFailed: true });
      setItem.mockRestore();
      localStorage.setItem(LANGUAGE_STORAGE_KEY, "ja");
      window.dispatchEvent(new StorageEvent("storage", { key: LANGUAGE_STORAGE_KEY, newValue: "ja" }));
      expect(preferences.getSnapshot().locale).toBe("en");
      preferences.selectLanguage("ja");
      preferences.selectLanguage("en");
      window.dispatchEvent(new StorageEvent("storage", { key: LANGUAGE_STORAGE_KEY, newValue: "ja" }));
      expect(preferences.getSnapshot()).toMatchObject({ locale: "en", languageWriteFailed: false });
      expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("en");
    } finally {
      stop();
    }
  });

  it.each([
    [null, "horizontal"],
    [STORAGE_KEY_FOR_TESTING, "vertical"],
    ["zanshin.notes.pending.v1", "vertical"],
    ["zanshin.notes.recovery.conflict.backup.v1", "vertical"],
    ["zanshin.prefs.brush.v1", "vertical"],
  ] as const)("初期方向を記録し、空の既存版も旧利用と判定する (%s)", (key, direction) => {
    if (key) localStorage.setItem(key, key.includes("brush") ? "fude" : "[]");
    const install = loadNotes({ checkFreshInstall: true });
    const preferences = createUiPreferences(["en-US"]);
    preferences.initializeReading(install.ok && install.freshInstall === true);
    expect(preferences.getSnapshot().readingMode).toBe(direction);
    preferences.selectLanguage("ja");
    expect(preferences.getSnapshot().readingMode).toBe(direction);
    expect(localStorage.getItem(READING_MODE_STORAGE_KEY)).toBe(direction);
  });

  it("読めない設定は縦書きから起動し、読み込みだけでは上書きしない", () => {
    const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("unavailable"); });
    const preferences = createUiPreferences(["en-US"]);
    preferences.initializeReading(true);
    expect(preferences.getSnapshot()).toMatchObject({ locale: "en", readingMode: "vertical" });
    read.mockRestore();
    expect(localStorage.getItem(READING_MODE_STORAGE_KEY)).toBeNull();
  });
});

it("公開辞書の件数・空版・整理・保存失敗が異なる意味を返す", () => {
  for (const locale of PUBLIC_UI_LOCALES) {
    const copy = messages[locale];
    for (const noteCount of [0, 1, 2, 11, 1000]) {
      const rendered = [
        copy.notesCountLabel({ noteCount }),
        copy.searchResultCountLabel({ noteCount }),
        noteCount === 0 ? copy.recoveryReviewEmpty : copy.recoveryReviewCount({ noteCount }),
      ];
      expect(new Set(rendered).size).toBe(3);
      expect(rendered.every((value) => value.trim())).toBe(true);
    }
    const empty = copy.nativeRecoveryAlternativeNotice({ noteCount: 0 });
    expect(empty).toContain(copy.recoveryReviewEmpty);
    expect(empty).not.toMatch(/deleted|削除/iu);
    expect(copy.nativeBackupError).not.toBe(copy.saveError);
  }
  expect(messages.en.recoveryVersionCount({ versionCount: 1 })).toContain("1 version ");
  expect(messages.en.recoveryVersionCount({ versionCount: 1000 })).toContain("1,000 versions");
});
