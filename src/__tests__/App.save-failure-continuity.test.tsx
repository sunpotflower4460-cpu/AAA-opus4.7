/**
 * R02 / R07 / R35: 保存の失敗は画面の一時的な演出ではなく、現在の編集版に対する事実として保持される。
 * 画面を往復しても未保存の事実と再試行が残り、保存成功の結果が出たときだけ解消する。
 */
import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { PENDING_SAVE_KEY_FOR_TESTING, STORAGE_KEY_FOR_TESTING } from "../lib/storage";
import { messages } from "../lib/i18n";
import type { Note } from "../types/note";

const copy = messages.ja;

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

function findByLabel(container: HTMLElement, label: string): HTMLButtonElement {
  const button = container.querySelector(`button[aria-label="${label}"]`);
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Button not found by label: ${label}`);
  return button;
}

function hasButton(container: HTMLElement, text: string): boolean {
  return Array.from(container.querySelectorAll("button")).some((candidate) =>
    candidate.textContent?.includes(text),
  );
}

function changeTextarea(container: HTMLElement, value: string) {
  const textarea = container.querySelector<HTMLTextAreaElement>("textarea.writing-textarea");
  if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("textarea not found");
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("保存失敗の継続（R02）", () => {
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
    storage.setItem(
      STORAGE_KEY_FOR_TESTING,
      JSON.stringify([makeNote(), makeNote({ id: "note-2", title: "別のメモ" })]),
    );
    root = createRoot(container);
    act(() => {
      root?.render(
        <StrictMode>
          <App />
        </StrictMode>,
      );
    });
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container.remove();
    vi.useRealTimers();
  });

  function failWrites() {
    storage.setItem.mockImplementation((key: string, value: string) => {
      if (key === PENDING_SAVE_KEY_FOR_TESTING) {
        throw new DOMException("quota", "QuotaExceededError");
      }
      storage._store[key] = value;
    });
  }

  function restoreWrites() {
    storage.setItem.mockImplementation((key: string, value: string) => {
      storage._store[key] = value;
    });
  }

  function openEditor(title: string) {
    act(() => click(findButton(container, title)));
    act(() => click(findButton(container, copy.editNote)));
  }

  function backToList() {
    // 読み返しから開いた編集は「読み返しへ」戻り、もう一度で一覧へ。
    act(() => click(findButton(container, copy.backToRead)));
    act(() => click(findButton(container, copy.back)));
  }

  function backToRead() {
    // 編集→一覧→開き直し の往復を、画面の入口を変えずに繰り返す。
    backToList();
  }

  it("失敗→一覧→読み返し→編集へ戻っても、未保存の事実と再試行が残り、無変更の再試行が成功した時だけ消える", () => {
    openEditor("元のメモ");
    failWrites();
    changeTextarea(container, "未保存の本文");
    act(() => vi.advanceTimersByTime(1_000));
    expect(container.textContent).toContain(copy.saveErrorQuota);
    expect(hasButton(container, copy.retrySave)).toBe(true);

    // 一覧に戻ってもバナーで未保存を示す。
    backToRead();
    expect(container.textContent).toContain(copy.saveErrorQuota);

    // 読み返し → 編集へ再入場。以前はここでエラーも再試行も消えていた。
    act(() => click(findButton(container, "元のメモ")));
    act(() => click(findButton(container, copy.editNote)));
    expect(container.querySelector<HTMLTextAreaElement>("textarea.writing-textarea")?.value).toBe("未保存の本文");
    expect(container.textContent).toContain(copy.saveErrorQuota);
    expect(hasButton(container, copy.retrySave)).toBe(true);
    expect(container.textContent).not.toContain(copy.saved);

    // 再試行が再失敗しても残る。
    act(() => click(findButton(container, copy.retrySave)));
    expect(container.textContent).toContain(copy.saveErrorQuota);
    expect(hasButton(container, copy.retrySave)).toBe(true);

    // 保存が成功した結果が出たときだけ解消する。
    restoreWrites();
    act(() => click(findButton(container, copy.retrySave)));
    expect(container.textContent).not.toContain(copy.saveErrorQuota);
    expect(container.textContent).toContain(copy.saved);
    expect(JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[]).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "note-1", body: "未保存の本文" })]),
    );
  });

  it("失敗中に別のメモを開いても、未保存の事実を失わない", () => {
    openEditor("元のメモ");
    failWrites();
    changeTextarea(container, "未保存の本文");
    act(() => vi.advanceTimersByTime(1_000));
    expect(container.textContent).toContain(copy.saveErrorQuota);

    backToList();
    openEditor("別のメモ");
    expect(container.textContent).toContain(copy.saveErrorQuota);
    expect(hasButton(container, copy.retrySave)).toBe(true);
  });

  it("画面を往復しただけでは、保存済みの表示にならない", () => {
    openEditor("元のメモ");
    failWrites();
    changeTextarea(container, "未保存の本文");
    act(() => vi.advanceTimersByTime(1_000));
    backToList();
    act(() => vi.advanceTimersByTime(5_000));
    act(() => click(findButton(container, "元のメモ")));
    act(() => click(findButton(container, copy.editNote)));
    act(() => vi.advanceTimersByTime(5_000));
    expect(container.textContent).not.toContain(copy.saved);
    expect(container.textContent).toContain(copy.saveErrorQuota);
  });
});

describe("保存失敗中の本文の取り出し（R24）", () => {
  let storage: ReturnType<typeof mockLocalStorage>;
  let container: HTMLDivElement;
  let root: Root | null = null;
  const writeText = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    writeText.mockReset();
    writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    storage = mockLocalStorage();
    Object.defineProperty(window, "localStorage", { value: storage, writable: true, configurable: true });
    storage.setItem(STORAGE_KEY_FOR_TESTING, JSON.stringify([makeNote({ title: "取り出す題名" })]));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root?.render(<App />));
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it("保存に失敗している時、最新の本文と題名を原文のままコピーでき、コピーしても保存済みにならない", async () => {
    act(() => click(findButton(container, "取り出す題名")));
    act(() => click(findButton(container, copy.editNote)));
    storage.setItem.mockImplementation((key: string, value: string) => {
      if (key === PENDING_SAVE_KEY_FOR_TESTING) throw new DOMException("quota", "QuotaExceededError");
      storage._store[key] = value;
    });
    const raw = "  行頭の空白\n\n空行と絵文字🌙  ";
    changeTextarea(container, raw);
    act(() => vi.advanceTimersByTime(1_000));
    expect(container.textContent).toContain(copy.saveErrorQuota);

    await act(async () => {
      click(findButton(container, copy.copyBody));
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledWith(raw); // trim・整形をしない
    expect(container.textContent).toContain(copy.copied);
    // コピーの成功は保存の成功ではない。
    expect(container.textContent).toContain(copy.saveErrorQuota);
    expect(container.textContent).not.toContain(copy.saved);

    await act(async () => {
      click(findButton(container, copy.copyTitle));
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenLastCalledWith("取り出す題名");
  });
});

describe("削除の保存失敗（R36 / F08）", () => {
  let storage: ReturnType<typeof mockLocalStorage>;
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    storage = mockLocalStorage();
    Object.defineProperty(window, "localStorage", { value: storage, writable: true, configurable: true });
    storage.setItem(STORAGE_KEY_FOR_TESTING, JSON.stringify([makeNote(), makeNote({ id: "note-2", title: "残るメモ" })]));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root?.render(<App />));
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it("削除の保存が確定しない間は「削除を保存できませんでした」と伝え、元のメモは保存先に残り、容量不足を削除だけで解決できるとは案内しない", () => {
    act(() => click(findButton(container, "元のメモ")));
    act(() => click(findButton(container, copy.editNote)));
    storage.setItem.mockImplementation((key: string, value: string) => {
      if (key === PENDING_SAVE_KEY_FOR_TESTING) throw new DOMException("quota", "QuotaExceededError");
      storage._store[key] = value;
    });
    act(() => click(findByLabel(container, copy.deleteNote)));
    act(() => click(findButton(container, copy.confirmDelete)));
    act(() => vi.advanceTimersByTime(1_000));

    expect(container.textContent).toContain(copy.deleteSaveFailed);
    // 「削除しました」とだけ伝えて終わらせず、取り消しの導線も残す。
    expect(container.textContent).toContain(copy.undoDelete);
    // 保存先には元のメモが残っている（削除は確定していない）。
    expect(JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[]).toHaveLength(2);
    // 容量不足の案内は、削除すれば解決するという書き方をしない。
    expect(copy.saveErrorQuota).not.toMatch(/削除|消(す|し)/);
    expect(copy.deleteSaveFailed).not.toMatch(/削除すれば|消せば/);
  });

  it("元に戻した後は、削除の失敗ではなく通常の保存失敗として扱う", () => {
    act(() => click(findButton(container, "元のメモ")));
    act(() => click(findButton(container, copy.editNote)));
    storage.setItem.mockImplementation((key: string, value: string) => {
      if (key === PENDING_SAVE_KEY_FOR_TESTING) throw new DOMException("quota", "QuotaExceededError");
      storage._store[key] = value;
    });
    act(() => click(findByLabel(container, copy.deleteNote)));
    act(() => click(findButton(container, copy.confirmDelete)));
    act(() => vi.advanceTimersByTime(1_000));
    act(() => click(findButton(container, copy.undoDelete)));
    act(() => vi.advanceTimersByTime(1_000));

    expect(container.textContent).not.toContain(copy.deleteSaveFailed);
  });
});
