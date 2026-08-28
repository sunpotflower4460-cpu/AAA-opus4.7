import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import {
  BACKUP_KEY_FOR_TESTING,
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

function dispatchStorageChange(key: string | null = STORAGE_KEY_FOR_TESTING) {
  const event = new Event("storage") as StorageEvent;
  Object.defineProperty(event, "key", { value: key });
  window.dispatchEvent(event);
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

function openExistingNoteEditor(container: HTMLElement) {
  act(() => click(findButton(container, "元のメモ")));
  act(() => click(findButton(container, copy.editNote)));
}

function changeTextarea(container: HTMLElement, value: string) {
  const textarea = container.querySelector("textarea");
  if (!(textarea instanceof HTMLTextAreaElement)) {
    throw new Error("textarea not found");
  }

  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  valueSetter?.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
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
      root?.render(
        <StrictMode>
          <App />
        </StrictMode>,
      );
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

  it("未編集の画面は storage event で別タブの最新内容へ追従する", () => {
    storage.setItem(STORAGE_KEY_FOR_TESTING, JSON.stringify([makeNote()]));
    renderApp();

    const remote = [
      makeNote({
        title: "別タブの最新内容",
        updatedAt: "2026-08-28T00:15:00.000Z",
      }),
    ];
    storage.setItem(STORAGE_KEY_FOR_TESTING, JSON.stringify(remote));

    act(() => dispatchStorageChange());

    expect(container.textContent).toContain("別タブの最新内容");
    expect(container.textContent).not.toContain("元のメモ");
  });

  it("storage event が間に合わなくても保存直前比較で別タブ更新を上書きしない", () => {
    const baseline = [makeNote()];
    storage.setItem(STORAGE_KEY_FOR_TESTING, JSON.stringify(baseline));
    renderApp();
    openExistingNoteEditor(container);

    act(() => changeTextarea(container, "この画面だけの未保存編集"));

    const remote = [
      makeNote({
        title: "別タブで先に更新",
        body: "別タブ本文",
        updatedAt: "2026-08-28T00:20:00.000Z",
      }),
    ];
    const remoteRaw = JSON.stringify(remote);
    storage.setItem(STORAGE_KEY_FOR_TESTING, remoteRaw);

    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });

    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBe(remoteRaw);
    expect(container.textContent).toContain(copy.storageConflictTitle);
    expect(container.textContent).toContain(copy.saveConflict);
  });

  it("競合中に明示的な上書きを選ぶと、別タブ版をbackupへ残してローカル編集を保存する", () => {
    const baseline = [makeNote()];
    storage.setItem(STORAGE_KEY_FOR_TESTING, JSON.stringify(baseline));
    renderApp();
    openExistingNoteEditor(container);

    act(() => changeTextarea(container, "この画面で残したい本文"));

    const remote = [
      makeNote({
        title: "別タブ版",
        body: "別タブ本文",
        updatedAt: "2026-08-28T00:20:00.000Z",
      }),
    ];
    storage.setItem(STORAGE_KEY_FOR_TESTING, JSON.stringify(remote));

    act(() => dispatchStorageChange());
    expect(container.textContent).toContain(copy.storageConflictTitle);

    act(() => click(findButton(container, copy.storageConflictOverwrite)));

    const saved = JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[];
    const backup = JSON.parse(storage._store[BACKUP_KEY_FOR_TESTING]) as Note[];
    expect(saved[0].body).toBe("この画面で残したい本文");
    expect(backup).toEqual(remote);
    expect(container.textContent).not.toContain(copy.storageConflictTitle);
  });

  it("競合中に保存先の内容を選ぶと、未保存ローカル編集を破棄して最新内容を読み込む", () => {
    storage.setItem(STORAGE_KEY_FOR_TESTING, JSON.stringify([makeNote()]));
    renderApp();
    openExistingNoteEditor(container);

    act(() => changeTextarea(container, "破棄されるローカル編集"));

    const remote = [
      makeNote({
        title: "採用する別タブ版",
        body: "採用する本文",
        updatedAt: "2026-08-28T00:25:00.000Z",
      }),
    ];
    storage.setItem(STORAGE_KEY_FOR_TESTING, JSON.stringify(remote));

    act(() => dispatchStorageChange());
    act(() => click(findButton(container, copy.storageConflictLoad)));

    const textarea = container.querySelector("textarea");
    expect(textarea).toBeInstanceOf(HTMLTextAreaElement);
    expect((textarea as HTMLTextAreaElement).value).toBe("採用する本文");
    expect(container.textContent).not.toContain(copy.storageConflictTitle);
    expect(container.textContent).not.toContain(copy.saveConflict);
  });
});
