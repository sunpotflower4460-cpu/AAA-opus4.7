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

function hasButton(container: HTMLElement, text: string): boolean {
  return Array.from(container.querySelectorAll("button")).some((candidate) =>
    candidate.textContent?.includes(text),
  );
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
    durable.read.mockResolvedValue({ status: "missing" });
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
    durable.read.mockResolvedValue({ status: "available", notes: recovered });
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

  it("native復旧読込が遅くても確認完了前の新規編集とautosaveを開始しない", async () => {
    const recovered = [makeNote({ title: "遅れて見つかったnative" })];
    let resolveRead!: (value: { status: "available"; notes: Note[] }) => void;
    durable.read.mockReturnValue(
      new Promise((resolve) => {
        resolveRead = resolve;
      }),
    );

    renderApp();
    expect(container.textContent).toContain(copy.nativeRecoveryChecking);

    act(() => click(findButton(container, copy.emptyAction)));
    act(() => vi.advanceTimersByTime(1_000));
    await flushPromises();

    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBeUndefined();
    expect(container.querySelector("textarea")).toBeNull();
    expect(durable.persist).not.toHaveBeenCalled();

    await act(async () => {
      resolveRead({ status: "available", notes: recovered });
      await Promise.resolve();
    });
    await flushPromises();

    expect(container.textContent).toContain("遅れて見つかったnative");
    expect(container.textContent).toContain(copy.storageRecoveryTitle);
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBeUndefined();
  });

  it("native読込障害はfresh install扱いせず編集を止め、retryでmissing確認後に解放する", async () => {
    durable.read
      .mockResolvedValueOnce({ status: "error" })
      .mockResolvedValue({ status: "missing" });

    renderApp();
    await flushPromises();

    expect(container.textContent).toContain(copy.nativeRecoveryReadError);
    expect(hasButton(container, copy.nativeRecoveryRetry)).toBe(true);
    act(() => click(findButton(container, copy.emptyAction)));
    act(() => vi.advanceTimersByTime(1_000));
    await flushPromises();
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBeUndefined();
    expect(container.querySelector("textarea")).toBeNull();

    act(() => click(findButton(container, copy.nativeRecoveryRetry)));
    await flushPromises();
    expect(container.textContent).not.toContain(copy.nativeRecoveryReadError);

    act(() => click(findButton(container, copy.emptyAction)));
    expect(container.querySelector("textarea")).not.toBeNull();
    act(() => vi.advanceTimersByTime(500));
    await flushPromises();
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBeDefined();
  });

  it("native側の空配列も意図的な全削除状態として明示復旧候補にする", async () => {
    durable.read.mockResolvedValue({ status: "available", notes: [] });
    renderApp();
    await flushPromises();

    expect(container.textContent).toContain(copy.storageRecoveryTitle);
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBeUndefined();
    act(() => click(findButton(container, copy.storageRecoverySave)));
    await flushPromises();
    expect(JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[]).toEqual([]);
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

  it("clean状態で正常な外部保存版へ追従したらnative耐久層も同じ正本へ更新する", async () => {
    const existing = [makeNote()];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(existing);
    renderApp();
    await flushPromises();
    durable.persist.mockClear();

    const remote = [makeNote({ title: "外部の正本", updatedAt: "2026-08-28T00:01:00.000Z" })];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(remote);
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: STORAGE_KEY_FOR_TESTING, newValue: JSON.stringify(remote) }),
      );
    });
    await flushPromises();

    expect(container.textContent).toContain("外部の正本");
    expect(durable.persist).toHaveBeenCalledWith(remote);
  });

  it("競合で保存済み版を明示採用したら捨てたlocal版をnative復元候補に残さない", async () => {
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
      setter?.call(textarea, "捨てる未保存編集");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const remote = [makeNote({ title: "採用する保存済み版", updatedAt: "2026-08-28T00:02:00.000Z" })];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(remote);
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: STORAGE_KEY_FOR_TESTING, newValue: JSON.stringify(remote) }),
      );
    });
    expect(container.textContent).toContain(copy.storageConflictTitle);
    expect(durable.persist).not.toHaveBeenCalled();

    act(() => click(findButton(container, copy.storageConflictLoad)));
    await flushPromises();

    expect(JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[]).toEqual(remote);
    expect(container.textContent).not.toContain(copy.storageConflictTitle);
    expect(durable.persist).toHaveBeenCalledWith(remote);
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

  it("native予備保存Retryは編集開始時に即座に無効化しinert buttonを残さない", async () => {
    const existing = [makeNote()];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(existing);
    durable.persist.mockResolvedValueOnce(false).mockResolvedValue(true);
    renderApp();
    await flushPromises();
    expect(hasButton(container, copy.nativeBackupRetry)).toBe(true);

    act(() => click(findButton(container, "元のメモ")));
    act(() => click(findButton(container, copy.editNote)));
    const textarea = container.querySelector("textarea");
    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("textarea not found");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    act(() => {
      setter?.call(textarea, "dirtyにする");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="native-backup-failure"]')).not.toBeNull();
    expect(hasButton(container, copy.nativeBackupRetry)).toBe(false);
  });

  it("localStorage API自体が一時利用不能ならnative確認を必須化し、回復確認まで編集しない", async () => {
    storage.getItem.mockImplementation((key: string) => {
      if (key === STORAGE_KEY_FOR_TESTING) {
        throw new DOMException("storage unavailable", "SecurityError");
      }
      return storage._store[key] ?? null;
    });
    durable.read.mockResolvedValue({ status: "missing" });

    renderApp();
    await flushPromises();

    expect(container.textContent).toContain(copy.nativeRecoveryReadError);
    expect(container.textContent).not.toContain(
      "データの読み込みに問題がありました。メモが復元できない可能性があります。",
    );
    expect(container.querySelector('[data-testid="native-recovery-error"]')).not.toBeNull();
    act(() => click(findButton(container, copy.emptyAction)));
    act(() => vi.advanceTimersByTime(1_000));
    await flushPromises();
    expect(container.querySelector("textarea")).toBeNull();
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBeUndefined();

    storage.getItem.mockImplementation((key: string) => storage._store[key] ?? null);
    act(() => click(findButton(container, copy.nativeRecoveryRetry)));
    await flushPromises();

    expect(container.textContent).not.toContain(copy.nativeRecoveryReadError);
    act(() => click(findButton(container, copy.emptyAction)));
    expect(container.querySelector("textarea")).not.toBeNull();
  });

  it("local primary破損かつnative不存在でもfresh install扱いせず明示復旧を要求する", async () => {
    storage._store[STORAGE_KEY_FOR_TESTING] = "{broken";
    durable.read.mockResolvedValue({ status: "missing" });

    renderApp();
    await flushPromises();

    expect(container.textContent).toContain(copy.storageRecoveryTitle);
    expect(hasButton(container, copy.storageRecoverySave)).toBe(true);

    act(() => click(findButton(container, copy.emptyAction)));
    act(() => vi.advanceTimersByTime(1_000));
    await flushPromises();

    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBe("{broken");
  });

});
