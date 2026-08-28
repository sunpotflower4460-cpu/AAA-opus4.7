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
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Button not found: ${text}`);
  }
  return button;
}

function hasButton(container: HTMLElement, text: string): boolean {
  return Array.from(container.querySelectorAll("button")).some((candidate) =>
    candidate.textContent?.includes(text),
  );
}

function openExistingNoteEditor(container: HTMLElement) {
  act(() => click(findButton(container, "元のメモ")));
  act(() => click(findButton(container, copy.editNote)));
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

describe("App save retry", () => {
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

  const retryableFailures = [
    {
      name: "quota",
      error: () => new DOMException("quota", "QuotaExceededError"),
      message: copy.saveErrorQuota,
    },
    {
      name: "unavailable",
      error: () => new DOMException("blocked", "SecurityError"),
      message: copy.saveErrorUnavailable,
    },
    {
      name: "unknown",
      error: () => new Error("unexpected storage failure"),
      message: copy.saveError,
    },
  ] as const;

  it.each(retryableFailures)(
    "$name 保存失敗は内容を変えずに明示Retryできる",
    ({ error, message }) => {
      failPendingWrites(error);
      act(() => changeTextarea(container, "Retryで確定する本文"));
      act(() => vi.advanceTimersByTime(500));

      expect(container.textContent).toContain(message);
      expect(hasButton(container, copy.retrySave)).toBe(true);
      const beforeRetry = JSON.parse(
        storage._store[STORAGE_KEY_FOR_TESTING],
      ) as Note[];
      expect(beforeRetry[0].body).toBe("本文");

      restoreWrites();
      act(() => click(findButton(container, copy.retrySave)));

      const saved = JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[];
      expect(saved[0].body).toBe("Retryで確定する本文");
      expect(container.textContent).toContain(copy.saved);
      expect(hasButton(container, copy.retrySave)).toBe(false);
    },
  );

  it("Retryが再度失敗しても未保存状態とRetry導線を維持する", () => {
    failPendingWrites(() => new DOMException("quota", "QuotaExceededError"));
    act(() => changeTextarea(container, "まだ保存できない本文"));
    act(() => vi.advanceTimersByTime(500));
    act(() => click(findButton(container, copy.retrySave)));

    const primary = JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[];
    expect(primary[0].body).toBe("本文");
    expect(container.textContent).toContain(copy.saveErrorQuota);
    expect(hasButton(container, copy.retrySave)).toBe(true);
  });

  it("Retry直前に別タブ更新があれば通常Retryで上書きせず競合UIへ昇格する", () => {
    failPendingWrites(() => new DOMException("quota", "QuotaExceededError"));
    act(() => changeTextarea(container, "ローカル未保存本文"));
    act(() => vi.advanceTimersByTime(500));
    expect(hasButton(container, copy.retrySave)).toBe(true);

    restoreWrites();
    const remote = [
      makeNote({
        title: "別タブ最新版",
        body: "remote本文",
        updatedAt: "2026-08-28T00:20:00.000Z",
      }),
    ];
    const remoteRaw = JSON.stringify(remote);
    storage.setItem(STORAGE_KEY_FOR_TESTING, remoteRaw);

    act(() => click(findButton(container, copy.retrySave)));

    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBe(remoteRaw);
    expect(container.textContent).toContain(copy.storageConflictTitle);
    expect(container.textContent).toContain(copy.saveConflict);
    expect(hasButton(container, copy.retrySave)).toBe(false);
  });
});
