import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Note } from "../types/note";
import { copy } from "../lib/i18n";
import { STORAGE_KEY_FOR_TESTING } from "../lib/storage";

const lifecycle = vi.hoisted(() => ({
  handler: null as ((state: { isActive: boolean }) => void) | null,
  unsubscribe: vi.fn(),
}));

vi.mock("../lib/nativeAppLifecycle", () => ({
  subscribeToNativeAppState: vi.fn((handler: (state: { isActive: boolean }) => void) => {
    lifecycle.handler = handler;
    return lifecycle.unsubscribe;
  }),
}));

import App from "../App";

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

function openEditor(container: HTMLElement) {
  act(() => click(findButton(container, "元のメモ")));
  act(() => click(findButton(container, copy.editNote)));
}

function changeTextarea(container: HTMLElement, value: string) {
  const textarea = container.querySelector("textarea");
  if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("textarea not found");
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  act(() => {
    setter?.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("App Capacitor native lifecycle", () => {
  let storage: ReturnType<typeof mockLocalStorage>;
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    lifecycle.handler = null;
    lifecycle.unsubscribe.mockReset();
    storage = mockLocalStorage();
    Object.defineProperty(window, "localStorage", {
      value: storage,
      writable: true,
      configurable: true,
    });
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container.remove();
    vi.useRealTimers();
  });

  function renderApp() {
    root = createRoot(container);
    act(() => root?.render(<App />));
    if (!lifecycle.handler) throw new Error("native lifecycle listener was not registered");
  }

  it("native inactiveで500ms debounceを待たずdirtyメモをflushする", () => {
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify([makeNote()]);
    renderApp();
    openEditor(container);
    changeTextarea(container, "native background直前の本文");

    const before = JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[];
    expect(before[0].body).toBe("本文");

    act(() => lifecycle.handler?.({ isActive: false }));

    const saved = JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[];
    expect(saved[0].body).toBe("native background直前の本文");
  });

  it("native active復帰時、ローカルがcleanなら取りこぼした保存先変更を再読込する", () => {
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify([makeNote()]);
    renderApp();

    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify([
      makeNote({ title: "復帰時の外部最新版", updatedAt: "2026-08-28T00:01:00.000Z" }),
    ]);

    act(() => lifecycle.handler?.({ isActive: true }));

    expect(container.textContent).toContain("復帰時の外部最新版");
    expect(container.textContent).not.toContain("元のメモ");
  });

  it("native active時にdirtyなら外部版を勝手に採用せず、次のinactive保存で競合保護する", () => {
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify([makeNote()]);
    renderApp();
    openEditor(container);
    changeTextarea(container, "端末内の未保存編集");

    const remote = [
      makeNote({
        title: "別画面の最新版",
        body: "remote",
        updatedAt: "2026-08-28T00:02:00.000Z",
      }),
    ];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(remote);

    act(() => lifecycle.handler?.({ isActive: true }));
    const textarea = container.querySelector("textarea");
    expect(textarea?.value).toBe("端末内の未保存編集");

    act(() => lifecycle.handler?.({ isActive: false }));

    expect(JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[]).toEqual(remote);
    expect(container.textContent).toContain(copy.storageConflictTitle);
  });

  it("unmount時にnative listenerを解除する", () => {
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify([makeNote()]);
    renderApp();

    act(() => root?.unmount());
    root = null;

    expect(lifecycle.unsubscribe).toHaveBeenCalledTimes(1);
  });
});
