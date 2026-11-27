import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixtures from "../../docs/multilingual/fixtures/round-2.json";
import App from "../App";
import { AppErrorBoundary } from "../components/AppErrorBoundary";
import { messages } from "../lib/i18n";
import {
  BACKUP_KEY_FOR_TESTING as backup,
  PENDING_SAVE_KEY_FOR_TESTING as journal,
  STORAGE_KEY_FOR_TESTING as primary,
} from "../lib/storage";
import { LANGUAGE_STORAGE_KEY, READING_MODE_STORAGE_KEY } from "../lib/uiPreferences";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const preciseText = fixtures.text_cases.find(({ id }) => id === "MLT23")!;
const longText = fixtures.text_cases.find(({ id }) => id === "MLT24")!;
const existing = {
  id: "existing",
  title: preciseText.title,
  body: preciseText.body,
  createdAt: "2026-11-26T14:50:00.000Z",
  updatedAt: "2026-11-26T14:50:00.000Z",
  isFavorite: true,
  locale: "ja",
  future: { value: "\u200d" },
};
const notesBefore = JSON.stringify([existing]);
const { ja, en } = messages;

function input(el: HTMLTextAreaElement | HTMLInputElement, value: string) {
  const prototype = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("日英の編集版・復旧・設定の連続性", () => {
  let root: Root;
  let host: HTMLDivElement;

  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    window.localStorage.clear();
    Reflect.deleteProperty(navigator, "clipboard");
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function mount() {
    act(() => root.render(<AppErrorBoundary><App /></AppErrorBoundary>));
  }

  function button(text: string) {
    const el = [...host.querySelectorAll("button")].find((node) =>
      node.textContent?.includes(text) || node.getAttribute("aria-label") === text,
    );
    if (!el) throw new Error(`Button missing: ${text}`);
    return el;
  }

  function click(text: string) {
    act(() => button(text).click());
  }

  function externalLanguage(value: "ja" | "en" | "system") {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, value);
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: LANGUAGE_STORAGE_KEY, newValue: value })));
  }

  function editExisting() {
    act(() => host.querySelector<HTMLButtonElement>("[data-note-id]")?.click());
    click(ja.editNote);
    return host.querySelector<HTMLTextAreaElement>(".writing-textarea")!;
  }

  it.each([false, true])("同一編集での保存回数と対象版を維持する（切替=%s）", (switchLanguage) => {
    localStorage.setItem(primary, notesBefore);
    mount();
    const field = editExisting();
    const writes = vi.spyOn(Storage.prototype, "setItem");
    const reads = vi.spyOn(Storage.prototype, "getItem");
    input(field, longText.body);
    field.focus();
    field.setSelectionRange(2, 9, "backward");
    field.scrollTop = 72;

    if (switchLanguage) {
      externalLanguage("en");
      expect(document.documentElement.lang).toBe("en");
      expect(host.querySelector(".writing-textarea")).toBe(field);
      expect(document.activeElement).toBe(field);
      expect([field.selectionStart, field.selectionEnd, field.selectionDirection, field.scrollTop]).toEqual([2, 9, "backward", 72]);
      expect(host.textContent).toContain(en.backToRead);
      expect(reads.mock.calls.some(([key]) => key.startsWith("zanshin.notes"))).toBe(false);
    }

    act(() => vi.advanceTimersByTime(600));
    expect(writes.mock.calls.filter(([key]) => key.startsWith("zanshin.notes")).map(([key]) => key))
      .toEqual([journal, backup, primary]);
    expect(JSON.parse(localStorage.getItem(primary)!)).toEqual([
      { ...existing, body: longText.body, updatedAt: new Date(Date.now() - 600).toISOString() },
    ]);
    if (switchLanguage) {
      expect(host.textContent).toContain(en.saved);
      externalLanguage("system");
      expect(host.textContent).toContain(ja.saved);
      expect(writes.mock.calls.filter(([key]) => key === primary)).toHaveLength(1);
    }
  });

  it("IMEの確定まで外部言語を保留し、確定文だけが最終保存版に入る", () => {
    localStorage.setItem(primary, notesBefore);
    mount();
    const field = editExisting();
    field.focus();
    act(() => field.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true })));
    input(field, "かな");
    externalLanguage("en");
    expect(document.documentElement.lang).toBe("ja");
    expect(host.querySelector(".writing-textarea")).toBe(field);

    act(() => field.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true })));
    input(field, "仮名 🌙");
    act(() => vi.advanceTimersByTime(600));
    expect(document.documentElement.lang).toBe("en");
    expect(host.querySelector(".writing-textarea")).toBe(field);
    expect(JSON.parse(localStorage.getItem(primary)!)[0].body).toBe("仮名 🌙");
  });

  it("言語変更だけで CRLF、属性、未知フィールド、保護 raw、検索の位置を変えない", () => {
    localStorage.setItem(primary, notesBefore);
    const protectedRaw = ` \n${notesBefore}\t`;
    const protectedKey = "zanshin.notes.recovery.conflict.backup.v1";
    localStorage.setItem(protectedKey, protectedRaw);
    localStorage.setItem("zanshin.prefs.brush.v1", "boku");
    mount();
    const search = host.querySelector<HTMLInputElement>('input[type="search"]')!;
    const query = existing.title.split("\r")[0];
    input(search, query);
    act(() => button(ja.aboutOpen).click());
    const select = host.querySelector("select")!;
    select.focus();
    act(() => {
      select.value = "en";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(document.activeElement).toBe(select);
    expect(document.documentElement.lang).toBe("en");
    click(en.close);
    expect(host.querySelector('input[type="search"]')).toBe(search);
    expect(search.value).toBe(query);
    expect(localStorage.getItem(primary)).toBe(notesBefore);
    expect(localStorage.getItem(protectedKey)).toBe(protectedRaw);
    expect(localStorage.getItem("zanshin.prefs.brush.v1")).toBe("boku");
    expect(localStorage.getItem(READING_MODE_STORAGE_KEY)).toBe("vertical");
  });

  it("題名の200を超えても全文を保存し、不可視本文を未操作扱いしない", () => {
    mount();
    click(ja.newNote);
    const title = host.querySelector<HTMLTextAreaElement>(".note-title-input")!;
    const field = host.querySelector<HTMLTextAreaElement>(".writing-textarea")!;
    const family = "👨‍👩‍👧‍👦".repeat(201);
    expect(title.hasAttribute("maxlength")).toBe(false);
    input(title, family);
    expect(host.textContent).toContain(ja.titleLengthGuide({ graphemeCount: 201, recommendedCount: 200 }));
    input(title, "");
    input(field, "\u200b\u200d\u2060");
    click(ja.back);
    act(() => vi.advanceTimersByTime(600));
    expect(host.querySelector("[data-note-id]")?.textContent).toContain(ja.untitled);
    const [saved] = JSON.parse(localStorage.getItem(primary)!);
    expect(saved.body).toBe(field.value);
    expect(saved).not.toHaveProperty("locale");
  });

  it("保存失敗の切替後も題名・本文の全文をコピーでき、再試行でのみ確定する", async () => {
    localStorage.setItem(primary, notesBefore);
    mount();
    const field = editExisting();
    const realWrite = Storage.prototype.setItem;
    const failure = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === journal) throw new DOMException("full", "QuotaExceededError");
      realWrite.call(this, key, value);
    });
    const clipboard = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText: clipboard }, configurable: true });
    input(field, longText.body);
    act(() => vi.advanceTimersByTime(600));
    expect(host.textContent).toContain(ja.saveErrorQuota);
    externalLanguage("en");
    expect(host.textContent).toContain(en.saveErrorQuota);
    await act(async () => button(en.copyTitle).click());
    expect(clipboard).toHaveBeenCalledWith(existing.title);
    await act(async () => button(en.copyBody).click());
    expect(clipboard).toHaveBeenCalledWith(longText.body);
    expect(localStorage.getItem(primary)).toBe(notesBefore);
    expect(host.textContent).toContain(en.copied);
    failure.mockRestore();
    click(en.retrySave);
    expect(JSON.parse(localStorage.getItem(primary)!)[0]).toMatchObject({ title: existing.title, body: longText.body });
  });

  it("現在の描画を失敗させた編集も、英語の最小救済から全文を取り出せる", async () => {
    localStorage.setItem(primary, notesBefore);
    mount();
    const field = editExisting();
    externalLanguage("en");
    const clipboard = vi.fn().mockRejectedValue(new Error("unavailable"));
    Object.defineProperty(navigator, "clipboard", { value: { writeText: clipboard }, configurable: true });
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(function () { throw new Error("formatter unavailable"); });
    input(field, longText.body);
    expect(host.textContent).toContain(en.renderFailureUnsaved);
    expect(host.querySelector('[lang="en"] [role="alert"]')).not.toBeNull();
    await act(async () => button(en.copyBody).click());
    expect(clipboard).toHaveBeenCalledWith(longText.body);
    expect(host.textContent).toContain(en.copyFailed);
    const fields = [...host.querySelectorAll("textarea")];
    expect(fields.filter((element) => element.value === longText.body)).toHaveLength(2);
    expect(localStorage.getItem(primary)).toBe(notesBefore);
  });

  it("空の候補を選んで言語を切り替えても、候補・原文・比較中の状態だけを保つ", () => {
    localStorage.setItem(primary, notesBefore);
    localStorage.setItem(journal, JSON.stringify({ version: 1, baseRaw: notesBefore, nextRaw: "[]" }));
    mount();
    const storedJournal = localStorage.getItem(journal);
    click(ja.recoveryReviewOpen);
    const dialog = host.querySelector('[role="dialog"]')!;
    const selected = dialog.querySelector('[role="radio"][aria-checked="true"]')!;
    expect(selected.textContent).toContain(ja.recoveryReviewEmpty);
    externalLanguage("en");
    expect(dialog.querySelector('[role="radio"][aria-checked="true"]')).toBe(selected);
    expect(selected.textContent).toContain(en.recoveryReviewEmpty);
    expect(selected.textContent).toContain(en.recoveryReviewNoDate);
    expect(dialog.textContent).toContain(en.recoveryVersionCount({ versionCount: 2 }));
    expect(localStorage.getItem(primary)).toBe(notesBefore);
    expect(localStorage.getItem(journal)).toBe(storedJournal);
  });

  it("Undo を押しても遅延したタイマーが期限を延ばさない", () => {
    localStorage.setItem(primary, notesBefore);
    mount();
    editExisting();
    click(ja.deleteNote);
    click(ja.confirmDelete);
    act(() => vi.advanceTimersByTime(600));
    vi.setSystemTime(Date.now() + 10_000);
    externalLanguage("en");
    click(en.undoDelete);
    expect(JSON.parse(localStorage.getItem(primary)!)).toEqual([]);
    expect(host.textContent).not.toContain(en.undoDeleteMessage);
  });

  it("削除確認とUndoの期限は言語切替で作り直さない", () => {
    localStorage.setItem(primary, notesBefore);
    mount();
    editExisting();
    click(ja.deleteNote);
    const dialog = host.querySelector('[role="dialog"]')!;
    externalLanguage("en");
    expect(host.querySelector('[role="dialog"]')).toBe(dialog);
    expect(dialog.textContent).toContain(en.deleteConfirmTitle);
    click(en.confirmDelete);
    act(() => vi.advanceTimersByTime(9_500));
    externalLanguage("ja");
    expect(host.textContent).toContain(ja.undoDelete);
    act(() => vi.advanceTimersByTime(501));
    expect(host.textContent).not.toContain(ja.undoDeleteMessage);
    expect(host.textContent).not.toContain(ja.undoDelete);
    expect(JSON.parse(localStorage.getItem(primary)!)).toEqual([]);
  });
});
