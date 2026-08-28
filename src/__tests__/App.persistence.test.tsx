import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { STORAGE_KEY_FOR_TESTING } from "../lib/storage";
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

describe("App lifecycle persistence", () => {
  let storage: ReturnType<typeof mockLocalStorage>;
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    storage = mockLocalStorage();
    Object.defineProperty(window, "localStorage", {
      value: storage,
      writable: true,
      configurable: true,
    });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = null;
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    container.remove();
  });

  function renderApp() {
    root = createRoot(container);
    act(() => {
      root?.render(<App />);
    });
  }

  it("開いただけの古いタブは pagehide で外部の新しい内容を上書きしない", () => {
    storage.setItem(STORAGE_KEY_FOR_TESTING, JSON.stringify([makeNote()]));
    renderApp();

    const newerExternal = JSON.stringify([
      makeNote({
        title: "別タブで更新されたメモ",
        updatedAt: "2026-08-28T00:10:00.000Z",
      }),
    ]);
    storage.setItem(STORAGE_KEY_FOR_TESTING, newerExternal);

    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });

    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBe(newerExternal);
  });

  it("破損データの復旧確認中は pagehide でも空配列で上書きしない", () => {
    const corruptRaw = "{ broken primary";
    storage.setItem(STORAGE_KEY_FOR_TESTING, corruptRaw);
    renderApp();

    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });

    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBe(corruptRaw);
  });
});
