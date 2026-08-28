import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import {
  BACKUP_KEY_FOR_TESTING,
  PENDING_SAVE_KEY_FOR_TESTING,
  STORAGE_KEY_FOR_TESTING,
} from "../lib/storage";
import { copy } from "../lib/i18n";
import type { Note } from "../types/note";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeNote(): Note {
  return {
    id: "note-1",
    title: "元のメモ",
    body: "本文",
    createdAt: "2026-08-28T00:00:00.000Z",
    updatedAt: "2026-08-28T00:00:00.000Z",
    isFavorite: false,
    locale: "ja",
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
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Button not found: ${label}`);
  return button;
}

describe("App undo after interrupted delete", () => {
  let storage: ReturnType<typeof mockLocalStorage>;
  let container: HTMLDivElement;
  let root: Root | null = null;
  let originalRaw: string;

  beforeEach(() => {
    vi.useFakeTimers();
    storage = mockLocalStorage();
    Object.defineProperty(window, "localStorage", {
      value: storage,
      writable: true,
      configurable: true,
    });
    originalRaw = JSON.stringify([makeNote()]);
    storage._store[STORAGE_KEY_FOR_TESTING] = originalRaw;
    storage._store[BACKUP_KEY_FOR_TESTING] = originalRaw;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root?.render(
        <StrictMode>
          <App />
        </StrictMode>,
      );
    });
    act(() => click(findButton(container, "元のメモ")));
    act(() => click(findButton(container, copy.editNote)));
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container.remove();
    vi.useRealTimers();
  });

  function deleteCurrentNote() {
    act(() => click(findButtonByAriaLabel(container, copy.deleteNote)));
    act(() => click(findButton(container, copy.confirmDelete)));
  }

  it("primary書き込みで中断した削除をUndoすると古いpendingを消して保存済み状態へ戻る", () => {
    storage.setItem.mockImplementation((key: string, value: string) => {
      if (key === STORAGE_KEY_FOR_TESTING) {
        throw new DOMException("blocked", "SecurityError");
      }
      storage._store[key] = value;
    });

    deleteCurrentNote();
    act(() => vi.advanceTimersByTime(500));

    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBe(originalRaw);
    expect(storage._store[BACKUP_KEY_FOR_TESTING]).toBe("[]");
    expect(storage._store[PENDING_SAVE_KEY_FOR_TESTING]).toBeDefined();
    expect(container.querySelector('[data-testid="global-save-failure"]')).not.toBeNull();

    act(() => click(findButton(container, copy.undoDelete)));
    act(() => vi.advanceTimersByTime(500));

    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBe(originalRaw);
    expect(storage._store[BACKUP_KEY_FOR_TESTING]).toBe(originalRaw);
    expect(storage._store[PENDING_SAVE_KEY_FOR_TESTING]).toBeUndefined();
    expect(container.querySelector('[data-testid="global-save-failure"]')).toBeNull();
  });

  it("journal作成前にquota失敗した削除をUndoした場合は書き込み不能のままでもno-op成功する", () => {
    storage.setItem.mockImplementation((key: string, value: string) => {
      if (key === PENDING_SAVE_KEY_FOR_TESTING) {
        throw new DOMException("quota", "QuotaExceededError");
      }
      storage._store[key] = value;
    });

    deleteCurrentNote();
    act(() => vi.advanceTimersByTime(500));

    expect(storage._store[PENDING_SAVE_KEY_FOR_TESTING]).toBeUndefined();
    expect(container.textContent).toContain(copy.saveErrorQuota);

    act(() => click(findButton(container, copy.undoDelete)));
    act(() => vi.advanceTimersByTime(500));

    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBe(originalRaw);
    expect(storage._store[PENDING_SAVE_KEY_FOR_TESTING]).toBeUndefined();
    expect(container.querySelector('[data-testid="global-save-failure"]')).toBeNull();
  });
});
