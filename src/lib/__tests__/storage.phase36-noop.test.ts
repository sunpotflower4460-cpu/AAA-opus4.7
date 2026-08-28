import { beforeEach, describe, expect, it, vi } from "vitest";
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
