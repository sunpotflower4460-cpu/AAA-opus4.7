/**
 * R35: 保存状態は「いま表示している版」に対する事実として決まる。
 * 旧版のnative失敗、新版の本体保存失敗、本体成功、native成功が混在しても、
 * 旧い結果が最新版の説明に見えない。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Note } from "../types/note";
import { copy } from "../lib/i18n";
import { PENDING_SAVE_KEY_FOR_TESTING, STORAGE_KEY_FOR_TESTING } from "../lib/storage";

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

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("版に対する保存表示（R35 / F06）", () => {
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

  function failLocalWrites() {
    storage.setItem.mockImplementation((key: string, value: string) => {
      if (key === PENDING_SAVE_KEY_FOR_TESTING) {
        throw new DOMException("quota", "QuotaExceededError");
      }
      storage._store[key] = value;
    });
  }
  function restoreLocalWrites() {
    storage.setItem.mockImplementation((key: string, value: string) => {
      storage._store[key] = value;
    });
  }

  it("旧版のnative失敗→新入力→local失敗→local成功→native成功で、表示が最新版の事実と一致する", async () => {
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify([makeNote()]);
    // 起動時の予備保存は失敗する（旧版に対するnative失敗）。
    durable.persist.mockResolvedValueOnce(false);
    root = createRoot(container);
    act(() => root?.render(<App />));
    await flushPromises();
    expect(container.textContent).toContain(copy.nativeBackupError);

    act(() => click(findButton(container, "元のメモ")));
    act(() => click(findButton(container, copy.editNote)));

    // 新しい入力。旧版へのnative警告は、最新版に対する説明として残らない。
    failLocalWrites();
    typeBody(container, "新しい本文");
    expect(container.textContent).not.toContain(copy.nativeBackupError);

    // 本体保存の失敗。最新版が未保存であることが主文になり、「保存済み」という説明は出ない。
    act(() => vi.advanceTimersByTime(1_000));
    await flushPromises();
    expect(container.textContent).toContain(copy.saveErrorQuota);
    expect(container.textContent).not.toContain(copy.nativeBackupError);
    expect(container.textContent).not.toContain(copy.saved);
    expect(durable.persist).toHaveBeenCalledTimes(1); // 未保存の版をnativeへ渡していない

    // 本体保存が成功し、続いてnativeも成功。失敗表示も古い警告も残らない。
    restoreLocalWrites();
    durable.persist.mockResolvedValue(true);
    act(() => click(findButton(container, copy.retrySave)));
    await flushPromises();
    expect(container.textContent).not.toContain(copy.saveErrorQuota);
    expect(container.textContent).not.toContain(copy.nativeBackupError);
    expect(durable.persist).toHaveBeenLastCalledWith(
      expect.arrayContaining([expect.objectContaining({ body: "新しい本文" })]),
    );
  });

  it("本体は最新版を保存済みで、予備保存だけ失敗した時は、その事実を最新版の説明として出す", async () => {
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify([makeNote()]);
    durable.persist.mockResolvedValueOnce(true).mockResolvedValue(false);
    root = createRoot(container);
    act(() => root?.render(<App />));
    await flushPromises();
    expect(container.textContent).not.toContain(copy.nativeBackupError);

    act(() => click(findButton(container, "元のメモ")));
    act(() => click(findButton(container, copy.editNote)));
    typeBody(container, "もう一つの本文");
    act(() => vi.advanceTimersByTime(1_000));
    await flushPromises();

    expect(container.textContent).toContain(copy.nativeBackupError);
    expect(JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[]).toEqual(
      expect.arrayContaining([expect.objectContaining({ body: "もう一つの本文" })]),
    );
  });

  it("結果が返る前に次の入力が始まっていたら、古い版のnative結果で最新版の表示を動かさない", async () => {
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify([makeNote()]);
    durable.persist.mockResolvedValueOnce(true);
    root = createRoot(container);
    act(() => root?.render(<App />));
    await flushPromises();

    act(() => click(findButton(container, "元のメモ")));
    act(() => click(findButton(container, copy.editNote)));

    let resolveFirst!: (ok: boolean) => void;
    durable.persist.mockReturnValueOnce(new Promise<boolean>((resolve) => (resolveFirst = resolve)));
    typeBody(container, "版A");
    act(() => vi.advanceTimersByTime(1_000)); // 版Aが保存され、nativeへ渡る（未解決）

    typeBody(container, "版B"); // 結果が返る前に次の入力
    await act(async () => {
      resolveFirst(false); // 版Aのnative失敗が遅れて届く
      await Promise.resolve();
    });

    // 版Bは未保存なので、版Aの失敗を「最新の変更は保存済み」として出さない。
    expect(container.textContent).not.toContain(copy.nativeBackupError);
  });
});
