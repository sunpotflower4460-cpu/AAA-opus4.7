/**
 * R33 / F04: 描画例外で App が破棄されても、最後に受け取った未保存の題名・本文を
 * エラー画面から読み取り・コピーできる。既存の保存版を無条件に上書きしない。
 *
 * 実際の AppErrorBoundary へ、保存待ち・保存失敗中・競合待ちのそれぞれで描画例外を注入する。
 */
import { act, useSyncExternalStore } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { AppErrorBoundary } from "../components/AppErrorBoundary";
import { clearDraftRescueForTesting } from "../lib/draftRescue";
import { BACKUP_KEY_FOR_TESTING, PENDING_SAVE_KEY_FOR_TESTING, STORAGE_KEY_FOR_TESTING } from "../lib/storage";
import { messages } from "../lib/i18n";
import { LANGUAGE_STORAGE_KEY } from "../lib/uiPreferences";
import type { Note } from "../types/note";

const copy = messages.ja;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const bomb = (() => {
  let armed = false;
  const listeners = new Set<() => void>();
  return {
    arm() {
      armed = true;
      listeners.forEach((listener) => listener());
    },
    disarm() {
      armed = false;
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get armed() {
      return armed;
    },
  };
})();

function Bomb() {
  const armed = useSyncExternalStore(bomb.subscribe, () => bomb.armed);
  if (armed) throw new Error("injected render failure");
  return null;
}

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "note-1",
    title: "元のメモ",
    body: "保存済みの本文",
    createdAt: "2026-08-28T00:00:00.000Z",
    updatedAt: "2026-08-28T00:00:00.000Z",
    isFavorite: false,
    locale: "ja",
    ...overrides,
  };
}

function mockLocalStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach((key) => delete store[key]);
    }),
    get _store() {
      return store;
    },
  };
}

function click(element: Element) {
  element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function findButton(container: HTMLElement, text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
    candidate.textContent?.includes(text),
  );
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Button not found: ${text}`);
  return button;
}

function typeBody(container: HTMLElement, value: string) {
  const textarea = container.querySelector<HTMLTextAreaElement>("textarea.writing-textarea");
  if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("textarea not found");
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  act(() => {
    setter?.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("描画例外後の未保存本文の救済（R33 / F04）", () => {
  let storage: ReturnType<typeof mockLocalStorage>;
  let container: HTMLDivElement;
  let root: Root | null = null;
  const writeText = vi.fn();

  const original = [makeNote()];

  beforeEach(() => {
    vi.useFakeTimers();
    bomb.disarm();
    clearDraftRescueForTesting();
    writeText.mockReset();
    writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    storage = mockLocalStorage();
    Object.defineProperty(window, "localStorage", { value: storage, configurable: true });
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(original);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() =>
      root?.render(
        <AppErrorBoundary>
          <App />
          <Bomb />
        </AppErrorBoundary>,
      ),
    );
    act(() => click(findButton(container, "元のメモ")));
    act(() => click(findButton(container, copy.editNote)));
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function explode() {
    act(() => bomb.arm());
  }

  function rescueText(): string {
    const fields = Array.from(container.querySelectorAll("textarea, input"));
    return fields.map((el) => (el as HTMLTextAreaElement).value).join("\n");
  }

  it("入力直後（保存待ち）に描画例外が起きても、最新の本文を読み取り・コピーでき、保存版を上書きしない", async () => {
    typeBody(container, "保存待ちの最新本文");
    explode();

    expect(container.textContent).toContain(copy.renderFailureUnsaved);
    expect(rescueText()).toContain("保存待ちの最新本文");
    // 保存されていない事実を「すべて保存」と言わない。
    expect(container.textContent).not.toContain(copy.renderFailureNoUnsaved);

    // コピー。実際のクリップボードAPIへ原文が渡る。
    await act(async () => {
      click(findButton(container, copy.copyBody));
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledWith("保存待ちの最新本文");
    expect(container.textContent).toContain(copy.copied);

    // 保存層は例外後に書き換わっていない（アンマウント時のforce-saveをしない）。
    act(() => vi.advanceTimersByTime(5_000));
    expect(JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[]).toEqual(original);
  });

  it("保存失敗が続いている最中に描画例外が起きても、失敗した最新本文を取り出せる", () => {
    storage.setItem.mockImplementation((key: string, value: string) => {
      if (key === PENDING_SAVE_KEY_FOR_TESTING) {
        throw new DOMException("quota", "QuotaExceededError");
      }
      storage._store[key] = value;
    });
    typeBody(container, "容量不足で保存できなかった本文");
    act(() => vi.advanceTimersByTime(1_000));
    expect(container.textContent).toContain(copy.saveErrorQuota);

    explode();
    expect(rescueText()).toContain("容量不足で保存できなかった本文");
    expect(container.textContent).toContain(copy.renderFailureUnsaved);
    expect(JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[]).toEqual(original);
  });

  it("競合で保存を止めている最中に描画例外が起きても、この画面の本文を取り出せ、強制保存しない", () => {
    typeBody(container, "競合中にこの画面で書いた本文");
    // 別の版が保存先に現れる（別タブ・復元など）。
    const other = [makeNote({ body: "別の版の本文", updatedAt: "2026-08-28T05:00:00.000Z" })];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(other);
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: STORAGE_KEY_FOR_TESTING,
          newValue: JSON.stringify(other),
        }),
      );
    });
    expect(container.textContent).toContain(copy.storageConflictTitle);

    explode();
    expect(rescueText()).toContain("競合中にこの画面で書いた本文");
    act(() => vi.advanceTimersByTime(5_000));
    expect(JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[]).toEqual(other);
  });

  it("別候補を表示している時も、同じIDを持つ保留中の編集をそれぞれ原文でコピーできる", async () => {
    const screenDraft = "この画面だけの編集\n末尾";
    const localDraft = "別候補に加えた編集\n末尾";
    typeBody(container, screenDraft);
    const stored = JSON.stringify(original);
    const pending = JSON.stringify({
      version: 1,
      baseRaw: stored,
      nextRaw: JSON.stringify([makeNote({ body: "復旧候補の原文" })]),
    });
    storage._store[PENDING_SAVE_KEY_FOR_TESTING] = pending;
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY_FOR_TESTING })));
    act(() => click(findButton(container, copy.dirtyRecoveryShowLocal)));
    typeBody(container, localDraft);

    explode();

    expect(container.textContent).toContain(copy.renderFailureUnsaved);
    expect(rescueText()).toContain(screenDraft);
    expect(rescueText()).toContain(localDraft);
    const copyButtons = Array.from(container.querySelectorAll("button")).filter(
      (button) => button.textContent === copy.copyBody,
    );
    await act(async () => {
      copyButtons.forEach(click);
      await Promise.resolve();
    });
    expect(writeText.mock.calls.map(([value]) => value)).toEqual(expect.arrayContaining([screenDraft, localDraft]));
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBe(stored);
    expect(storage._store[PENDING_SAVE_KEY_FOR_TESTING]).toBe(pending);
  });

  it.each(["ja", "en"] as const)("予備保存の候補しか確認できない時も原文に届く (%s)", (locale) => {
    act(() => root?.unmount());
    clearDraftRescueForTesting();
    delete storage._store[STORAGE_KEY_FOR_TESTING];
    const backup = JSON.stringify([makeNote({ body: "予備保存にある原文" })]);
    storage._store[BACKUP_KEY_FOR_TESTING] = backup;
    storage._store[LANGUAGE_STORAGE_KEY] = locale;
    root = createRoot(container);
    act(() => root?.render(
      <AppErrorBoundary>
        <App />
        <Bomb />
      </AppErrorBoundary>,
    ));

    explode();
    expect(container.textContent).toContain(messages[locale].renderFailureUnknown);
    expect(container.textContent).toContain(messages[locale].unconfirmedNoteLabel);
    expect(rescueText()).toContain("予備保存にある原文");
    expect(storage._store[BACKUP_KEY_FOR_TESTING]).toBe(backup);
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBeUndefined();
  });

  it("クリップボードが使えない時は成功を出さず、手動で選択できる原文を示す", async () => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    typeBody(container, "手動で選ぶ本文");
    explode();

    await act(async () => {
      click(findButton(container, copy.copyBody));
      await Promise.resolve();
    });
    expect(container.textContent).not.toContain(copy.copied);
    expect(container.textContent).toContain(copy.copyFailed);
    expect(rescueText()).toContain("手動で選ぶ本文");
  });

  it("保存済みで未保存の変更がない時は、確認できた範囲だけを伝え、全データの保証をしない", () => {
    explode();
    expect(container.textContent).toContain(copy.renderFailureNoUnsaved);
    expect(container.textContent).not.toContain(copy.renderFailureUnsaved);
  });
});
