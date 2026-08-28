import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Note } from "../types/note";
import { copy } from "../lib/i18n";
import { STORAGE_KEY_FOR_TESTING } from "../lib/storage";

const durable = vi.hoisted(() => ({
  available: vi.fn(),
  read: vi.fn(),
  persist: vi.fn(),
}));

vi.mock("../lib/nativeDurableSnapshot", () => ({
  isNativeDurableSnapshotAvailable: durable.available,
  readNativeDurableSnapshot: durable.read,
  persistNativeDurableSnapshot: durable.persist,
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
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { Object.keys(store).forEach((key) => delete store[key]); }),
    get _store() { return store; },
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

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("App native durable snapshot", () => {
  let storage: ReturnType<typeof mockLocalStorage>;
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    durable.available.mockReset();
    durable.read.mockReset();
    durable.persist.mockReset();
    durable.available.mockReturnValue(true);
    durable.read.mockResolvedValue(null);
    durable.persist.mockResolvedValue(true);
    storage = mockLocalStorage();
    Object.defineProperty(window, "localStorage", { value: storage, configurable: true });
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
  }

  it("localStorage primary消失時はnative snapshotを画面に復元候補として表示し自動上書きしない", async () => {
    const recovered = [makeNote({ title: "nativeから救出" })];
    durable.read.mockResolvedValue(recovered);
    renderApp();
    await flushPromises();

    expect(container.textContent).toContain("nativeから救出");
    expect(container.textContent).toContain(copy.storageRecoveryTitle);
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBeUndefined();
    expect(durable.persist).not.toHaveBeenCalled();

    act(() => click(findButton(container, copy.storageRecoverySave)));
    await flushPromises();

    expect(JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[]).toEqual(recovered);
    expect(durable.persist).toHaveBeenCalledWith(recovered);
  });

  it("既存の正常localStorageは初回起動時にnative耐久層へ移行する", async () => {
    const existing = [makeNote()];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(existing);
    renderApp();
    await flushPromises();
    expect(durable.persist).toHaveBeenCalledWith(existing);
  });

  it("通常autosave成功後は最新snapshotをnative側にも保存する", async () => {
    const existing = [makeNote()];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(existing);
    renderApp();
    await flushPromises();
    durable.persist.mockClear();

    act(() => click(findButton(container, "元のメモ")));
    act(() => click(findButton(container, copy.editNote)));
    const textarea = container.querySelector("textarea");
    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("textarea not found");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    act(() => {
      setter?.call(textarea, "nativeにも残す本文");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => vi.advanceTimersByTime(500));
    await flushPromises();

    const latest = JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[];
    expect(latest[0].body).toBe("nativeにも残す本文");
    expect(durable.persist).toHaveBeenCalledWith(latest);
  });

  it("native予備保存失敗を非致命warningとして表示し、retry成功で消す", async () => {
    const existing = [makeNote()];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(existing);
    durable.persist.mockResolvedValueOnce(false).mockResolvedValue(true);
    renderApp();
    await flushPromises();

    expect(container.querySelector('[data-testid="native-backup-failure"]')).not.toBeNull();
    expect(container.textContent).toContain(copy.nativeBackupError);

    act(() => click(findButton(container, copy.nativeBackupRetry)));
    await flushPromises();

    expect(container.querySelector('[data-testid="native-backup-failure"]')).toBeNull();
  });
});
