import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import {
  BACKUP_KEY_FOR_TESTING,
  CONFLICT_BACKUP_KEY_FOR_TESTING,
  PENDING_SAVE_KEY_FOR_TESTING,
  STORAGE_KEY_FOR_TESTING,
} from "../lib/storage";
import { copy } from "../lib/i18n";
import type { Note } from "../types/note";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "note-1",
    title: "保存前のメモ",
    body: "古い本文",
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

function findButton(container: HTMLElement, text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
    candidate.textContent?.includes(text),
  );
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Button not found: ${text}`);
  return button;
}

function click(element: Element) {
  element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

describe("App interrupted-save recovery", () => {
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
  });

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    container.remove();
  });

  function renderApp() {
    root = createRoot(container);
    act(() => {
      root?.render(
        <StrictMode>
          <App />
        </StrictMode>,
      );
    });
  }

  it("再起動時に中断最新版を表示し、保存済み版との二択を出した上で最新版を明示確定できる", () => {
    const base = [makeNote()];
    const next = [
      makeNote({
        title: "保存途中だった最新版",
        body: "失いたくない本文",
        updatedAt: "2026-08-28T00:05:00.000Z",
      }),
    ];
    const baseRaw = JSON.stringify(base);
    const nextRaw = JSON.stringify(next);
    storage.setItem(STORAGE_KEY_FOR_TESTING, baseRaw);
    storage.setItem(BACKUP_KEY_FOR_TESTING, nextRaw);
    storage.setItem(
      PENDING_SAVE_KEY_FOR_TESTING,
      JSON.stringify({ version: 1, baseRaw, nextRaw }),
    );

    renderApp();

    expect(container.textContent).toContain("保存途中だった最新版");
    expect(container.textContent).not.toContain("保存前のメモ");
    expect(container.textContent).toContain(copy.storageConflictTitle);
    expect(container.textContent).toContain(copy.storageConflictLoad);
    expect(container.textContent).toContain(copy.storageConflictOverwrite);

    act(() => click(findButton(container, copy.storageConflictOverwrite)));

    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBe(nextRaw);
    expect(storage._store[BACKUP_KEY_FOR_TESTING]).toBe(nextRaw);
    expect(storage._store[CONFLICT_BACKUP_KEY_FOR_TESTING]).toBe(baseRaw);
    expect(storage._store[PENDING_SAVE_KEY_FOR_TESTING]).toBeUndefined();
    expect(container.textContent).not.toContain(copy.storageConflictTitle);
  });

  it("中断候補ではなく保存済みprimaryを選ぶと、候補を退避してからprimaryへ戻せる", () => {
    const base = [makeNote()];
    const next = [
      makeNote({
        title: "採用しない中断候補",
        body: "候補としては残す",
        updatedAt: "2026-08-28T00:06:00.000Z",
      }),
    ];
    const baseRaw = JSON.stringify(base);
    const nextRaw = JSON.stringify(next);
    storage.setItem(STORAGE_KEY_FOR_TESTING, baseRaw);
    storage.setItem(BACKUP_KEY_FOR_TESTING, nextRaw);
    storage.setItem(
      PENDING_SAVE_KEY_FOR_TESTING,
      JSON.stringify({ version: 1, baseRaw, nextRaw }),
    );

    renderApp();
    expect(container.textContent).toContain("採用しない中断候補");

    act(() => click(findButton(container, copy.storageConflictLoad)));

    expect(container.textContent).toContain("保存前のメモ");
    expect(container.textContent).not.toContain("採用しない中断候補");
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBe(baseRaw);
    expect(storage._store[BACKUP_KEY_FOR_TESTING]).toBe(baseRaw);
    expect(storage._store[CONFLICT_BACKUP_KEY_FOR_TESTING]).toBe(nextRaw);
    expect(storage._store[PENDING_SAVE_KEY_FOR_TESTING]).toBeUndefined();
    expect(container.textContent).not.toContain(copy.storageConflictTitle);
  });

  it("全削除の保存が中断して next が空配列でも、古いメモを勝手に復活させず二択を出す", () => {
    const baseRaw = JSON.stringify([makeNote({ id: "delete-me" })]);
    const nextRaw = JSON.stringify([]);
    storage.setItem(STORAGE_KEY_FOR_TESTING, baseRaw);
    storage.setItem(BACKUP_KEY_FOR_TESTING, nextRaw);
    storage.setItem(
      PENDING_SAVE_KEY_FOR_TESTING,
      JSON.stringify({ version: 1, baseRaw, nextRaw }),
    );

    renderApp();

    expect(container.textContent).not.toContain("保存前のメモ");
    expect(container.textContent).toContain(copy.storageConflictTitle);
    expect(container.textContent).toContain(copy.storageConflictLoad);
    expect(container.textContent).toContain(copy.storageConflictOverwrite);

    act(() => click(findButton(container, copy.storageConflictOverwrite)));

    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBe(nextRaw);
    expect(storage._store[BACKUP_KEY_FOR_TESTING]).toBe(nextRaw);
    expect(storage._store[CONFLICT_BACKUP_KEY_FOR_TESTING]).toBe(baseRaw);
    expect(storage._store[PENDING_SAVE_KEY_FOR_TESTING]).toBeUndefined();
    expect(container.textContent).not.toContain(copy.storageConflictTitle);
  });
});
