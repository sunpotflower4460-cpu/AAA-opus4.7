import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import {
  PENDING_SAVE_KEY_FOR_TESTING,
  STORAGE_KEY_FOR_TESTING,
} from "../lib/storage";
import { copy } from "../lib/i18n";
import type { Note } from "../types/note";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "note-1",
    title: "元のメモ",
    body: "本文",
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

function findButtonByAriaLabel(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.getAttribute("aria-label") === label,
  );
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Button with aria-label not found: ${label}`);
  }
  return button;
}

function retryButtonCount(container: HTMLElement): number {
  return Array.from(container.querySelectorAll("button")).filter((candidate) =>
    candidate.textContent?.includes(copy.retrySave),
  ).length;
}

function openExistingNoteEditor(container: HTMLElement) {
  act(() => click(findButton(container, "元のメモ")));
  act(() => click(findButton(container, copy.editNote)));
}

function deleteCurrentNote(container: HTMLElement) {
  act(() => click(findButtonByAriaLabel(container, copy.deleteNote)));
  act(() => click(findButton(container, copy.confirmDelete)));
}

function changeTextarea(container: HTMLElement, value: string) {
  const textarea = container.querySelector("textarea");
  if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("textarea not found");
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  valueSetter?.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("App global save failure", () => {
  let storage: ReturnType<typeof mockLocalStorage>;
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    storage = mockLocalStorage();
    Object.defineProperty(window, "localStorage", {
      value: storage,
      writable: true,
      configurable: true,
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    storage.setItem(STORAGE_KEY_FOR_TESTING, JSON.stringify([makeNote()]));
    root = createRoot(container);
    act(() => {
      root?.render(
        <StrictMode>
          <App />
        </StrictMode>,
      );
    });
    openExistingNoteEditor(container);
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container.remove();
    vi.useRealTimers();
  });

  function failPendingWrites(errorFactory: () => unknown) {
    storage.setItem.mockImplementation((key: string, value: string) => {
      if (key === PENDING_SAVE_KEY_FOR_TESTING) throw errorFactory();
      storage._store[key] = value;
    });
  }

  function restoreWrites() {
    storage.setItem.mockImplementation((key: string, value: string) => {
      storage._store[key] = value;
    });
  }

  it("削除後に一覧へ戻って保存失敗してもエラーとRetryを見失わない", () => {
    failPendingWrites(() => new DOMException("quota", "QuotaExceededError"));
    deleteCurrentNote(container);
    act(() => vi.advanceTimersByTime(500));

    expect(container.querySelector('[data-testid="global-save-failure"]')).not.toBeNull();
    expect(container.textContent).toContain(copy.saveErrorQuota);
    expect(retryButtonCount(container)).toBe(1);
    expect(JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING])).toHaveLength(1);

    restoreWrites();
    act(() => click(findButton(container, copy.retrySave)));

    expect(JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING])).toEqual([]);
    expect(container.querySelector('[data-testid="global-save-failure"]')).toBeNull();
  });

  it("一覧のRetry直前にremoteが変わったら削除状態で上書きせず競合へ移行する", () => {
    failPendingWrites(() => new DOMException("quota", "QuotaExceededError"));
    deleteCurrentNote(container);
    act(() => vi.advanceTimersByTime(500));
    restoreWrites();

    const remoteRaw = JSON.stringify([
      makeNote({
        title: "別タブ最新版",
        body: "remote本文",
        updatedAt: "2026-08-28T00:30:00.000Z",
      }),
    ]);
    storage.setItem(STORAGE_KEY_FOR_TESTING, remoteRaw);

    act(() => click(findButton(container, copy.retrySave)));

    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBe(remoteRaw);
    expect(container.textContent).toContain(copy.storageConflictTitle);
    expect(container.querySelector('[data-testid="global-save-failure"]')).toBeNull();
    expect(retryButtonCount(container)).toBe(0);
  });

  it("Editor内の保存失敗は既存Retryだけを表示しグローバル表示を重複させない", () => {
    failPendingWrites(() => new DOMException("quota", "QuotaExceededError"));
    act(() => changeTextarea(container, "未保存本文"));
    act(() => vi.advanceTimersByTime(500));

    expect(container.querySelector('[data-testid="global-save-failure"]')).toBeNull();
    expect(retryButtonCount(container)).toBe(1);
  });

  it("Editorで失敗した後に戻っても同じ未保存エラーを一覧で継続表示する", () => {
    failPendingWrites(() => new DOMException("quota", "QuotaExceededError"));
    act(() => changeTextarea(container, "未保存のまま戻る本文"));
    act(() => vi.advanceTimersByTime(500));
    expect(retryButtonCount(container)).toBe(1);

    act(() => click(findButton(container, copy.back)));

    expect(container.querySelector('[data-testid="global-save-failure"]')).not.toBeNull();
    expect(container.textContent).toContain(copy.saveErrorQuota);
    expect(retryButtonCount(container)).toBe(1);
  });
});
