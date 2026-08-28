from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match for {old!r}, found {count}")
    file.write_text(text.replace(old, new, 1))


anchor = '''    if (!options.force && options.expectedNotes) {
      if (
        currentParsed.status !== "valid" ||
        !notesMatch(currentParsed.notes, options.expectedNotes)
      ) {
        return { ok: false, reason: "conflict" };
      }
    }

    if (options.force) {'''

replacement = '''    if (!options.force && options.expectedNotes) {
      if (
        currentParsed.status !== "valid" ||
        !notesMatch(currentParsed.notes, options.expectedNotes)
      ) {
        return { ok: false, reason: "conflict" };
      }
    }

    if (!options.force && currentParsed.status === "valid" && currentRaw === serialized) {
      if (unresolvedPendingSave && activePendingSave) {
        // 同じ画面自身の中断候補を、その後の Undo 等で primary と同じ状態へ戻したケース。
        // primary はすでに希望状態なので再書き込みせず、古い next を復元候補として残さないよう
        // backup を現在 primary へ戻してから journal を解消する。
        // 別 writer の active pending は上の競合判定ですでに止めている。
        try {
          window.localStorage.setItem(BACKUP_KEY, currentRaw);
          window.localStorage.removeItem(PENDING_SAVE_KEY);
        } catch (error) {
          return saveFailureFromError(error);
        }
      }

      // pending が無い完全な no-op は localStorage へ一切書かない。
      // 実体がすでに保存済みなら quota / unavailable を偽の保存失敗として出さない。
      return { ok: true };
    }

    if (options.force) {'''

replace_once("src/lib/storage.ts", anchor, replacement)

Path("src/lib/__tests__/storage.phase36-noop.test.ts").write_text(
    '''import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BACKUP_KEY_FOR_TESTING,
  PENDING_SAVE_KEY_FOR_TESTING,
  STORAGE_KEY_FOR_TESTING,
  saveNotes,
} from "../storage";
import type { Note } from "../../types/note";

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "shared",
    title: "保存済み",
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

describe("Phase 36 no-op save and own pending cancellation", () => {
  let storage: ReturnType<typeof mockLocalStorage>;

  beforeEach(() => {
    storage = mockLocalStorage();
    Object.defineProperty(window, "localStorage", {
      value: storage,
      writable: true,
      configurable: true,
    });
  });

  it("primaryと完全一致する通常保存はlocalStorageへ書かず成功する", () => {
    const current = [makeNote()];
    const currentRaw = JSON.stringify(current);
    storage._store[STORAGE_KEY_FOR_TESTING] = currentRaw;
    storage._store[BACKUP_KEY_FOR_TESTING] = currentRaw;
    storage.setItem.mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });

    const result = saveNotes(current, {
      expectedNotes: current,
      writerId: "same-tab",
    });

    expect(result).toEqual({ ok: true });
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBe(currentRaw);
  });

  it("自分の中断候補をUndoしてprimaryへ戻した場合はbackupを戻してjournalだけ解消する", () => {
    const current = [makeNote()];
    const pending = [makeNote({ title: "削除前とは違う中断候補", updatedAt: "2026-08-28T00:01:00.000Z" })];
    const currentRaw = JSON.stringify(current);
    const pendingRaw = JSON.stringify(pending);
    storage._store[STORAGE_KEY_FOR_TESTING] = currentRaw;
    storage._store[BACKUP_KEY_FOR_TESTING] = pendingRaw;
    storage._store[PENDING_SAVE_KEY_FOR_TESTING] = JSON.stringify({
      version: 1,
      baseRaw: currentRaw,
      nextRaw: pendingRaw,
      writerId: "same-tab",
    });
    storage.setItem.mockImplementation((key: string, value: string) => {
      if (key === STORAGE_KEY_FOR_TESTING) {
        throw new Error("primary should not be rewritten for no-op cancellation");
      }
      storage._store[key] = value;
    });

    const result = saveNotes(current, {
      expectedNotes: current,
      writerId: "same-tab",
    });

    expect(result).toEqual({ ok: true });
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBe(currentRaw);
    expect(storage._store[BACKUP_KEY_FOR_TESTING]).toBe(currentRaw);
    expect(storage._store[PENDING_SAVE_KEY_FOR_TESTING]).toBeUndefined();
  });

  it("自分の中断候補キャンセルでbackupを戻せない場合はjournalを残して失敗を返す", () => {
    const current = [makeNote()];
    const pending = [makeNote({ title: "中断候補", updatedAt: "2026-08-28T00:01:00.000Z" })];
    const currentRaw = JSON.stringify(current);
    const pendingRaw = JSON.stringify(pending);
    storage._store[STORAGE_KEY_FOR_TESTING] = currentRaw;
    storage._store[BACKUP_KEY_FOR_TESTING] = pendingRaw;
    storage._store[PENDING_SAVE_KEY_FOR_TESTING] = JSON.stringify({
      version: 1,
      baseRaw: currentRaw,
      nextRaw: pendingRaw,
      writerId: "same-tab",
    });
    storage.setItem.mockImplementation((key: string, value: string) => {
      if (key === BACKUP_KEY_FOR_TESTING) {
        throw new DOMException("quota", "QuotaExceededError");
      }
      storage._store[key] = value;
    });

    const result = saveNotes(current, {
      expectedNotes: current,
      writerId: "same-tab",
    });

    expect(result).toEqual({ ok: false, reason: "quota" });
    expect(storage._store[BACKUP_KEY_FOR_TESTING]).toBe(pendingRaw);
    expect(storage._store[PENDING_SAVE_KEY_FOR_TESTING]).toBeDefined();
  });

  it("journal削除に失敗した場合も成功扱いせず候補を残す", () => {
    const current = [makeNote()];
    const pending = [makeNote({ title: "中断候補", updatedAt: "2026-08-28T00:01:00.000Z" })];
    const currentRaw = JSON.stringify(current);
    const pendingRaw = JSON.stringify(pending);
    storage._store[STORAGE_KEY_FOR_TESTING] = currentRaw;
    storage._store[BACKUP_KEY_FOR_TESTING] = pendingRaw;
    storage._store[PENDING_SAVE_KEY_FOR_TESTING] = JSON.stringify({
      version: 1,
      baseRaw: currentRaw,
      nextRaw: pendingRaw,
      writerId: "same-tab",
    });
    storage.removeItem.mockImplementation((key: string) => {
      if (key === PENDING_SAVE_KEY_FOR_TESTING) {
        throw new DOMException("blocked", "SecurityError");
      }
      delete storage._store[key];
    });

    const result = saveNotes(current, {
      expectedNotes: current,
      writerId: "same-tab",
    });

    expect(result).toEqual({ ok: false, reason: "unavailable" });
    expect(storage._store[BACKUP_KEY_FOR_TESTING]).toBe(currentRaw);
    expect(storage._store[PENDING_SAVE_KEY_FOR_TESTING]).toBeDefined();
  });

  it("別writerの中断候補はoutgoingがprimaryと同じでもno-op扱いで消さない", () => {
    const current = [makeNote()];
    const pending = [makeNote({ title: "別タブ候補", updatedAt: "2026-08-28T00:01:00.000Z" })];
    const currentRaw = JSON.stringify(current);
    const pendingRaw = JSON.stringify(pending);
    storage._store[STORAGE_KEY_FOR_TESTING] = currentRaw;
    storage._store[BACKUP_KEY_FOR_TESTING] = pendingRaw;
    storage._store[PENDING_SAVE_KEY_FOR_TESTING] = JSON.stringify({
      version: 1,
      baseRaw: currentRaw,
      nextRaw: pendingRaw,
      writerId: "other-tab",
    });

    const result = saveNotes(current, {
      expectedNotes: current,
      writerId: "this-tab",
    });

    expect(result).toEqual({ ok: false, reason: "conflict" });
    expect(storage._store[BACKUP_KEY_FOR_TESTING]).toBe(pendingRaw);
    expect(storage._store[PENDING_SAVE_KEY_FOR_TESTING]).toBeDefined();
  });
});
'''
)

Path("src/__tests__/App.undo-pending-cancel.test.tsx").write_text(
    '''import { StrictMode, act } from "react";
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
'''
)
