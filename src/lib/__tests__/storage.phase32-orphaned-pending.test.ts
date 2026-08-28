import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BACKUP_KEY_FOR_TESTING,
  CONFLICT_BACKUP_KEY_FOR_TESTING,
  PENDING_SAVE_KEY_FOR_TESTING,
  SECONDARY_CONFLICT_BACKUP_KEY_FOR_TESTING,
  STORAGE_KEY_FOR_TESTING,
  loadNotes,
  saveNotes,
} from "../storage";
import type { Note } from "../../types/note";

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "shared",
    title: "基準",
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

describe("Phase 32 orphaned pending-save protection", () => {
  let storage: ReturnType<typeof mockLocalStorage>;

  beforeEach(() => {
    storage = mockLocalStorage();
    Object.defineProperty(window, "localStorage", {
      value: storage,
      writable: true,
      configurable: true,
    });
  });

  function seedOrphanedPending() {
    const base = [makeNote({ title: "journalのbase" })];
    const pending = [
      makeNote({
        title: "中断して残った候補",
        updatedAt: "2026-08-28T00:01:00.000Z",
      }),
    ];
    const current = [
      makeNote({
        title: "現在の別primary",
        updatedAt: "2026-08-28T00:02:00.000Z",
      }),
    ];
    const baseRaw = JSON.stringify(base);
    const pendingRaw = JSON.stringify(pending);
    const currentRaw = JSON.stringify(current);

    storage.setItem(STORAGE_KEY_FOR_TESTING, currentRaw);
    storage.setItem(BACKUP_KEY_FOR_TESTING, currentRaw);
    storage.setItem(
      PENDING_SAVE_KEY_FOR_TESTING,
      JSON.stringify({
        version: 1,
        baseRaw,
        nextRaw: pendingRaw,
        writerId: "other-writer",
      }),
    );

    return { base, pending, current, baseRaw, pendingRaw, currentRaw };
  }

  it("primaryがbase/nextのどちらとも違ってもpending候補を黙って無視しない", () => {
    const { pending } = seedOrphanedPending();

    const result = loadNotes();

    expect(result.ok).toBe(false);
    expect(result.notes).toEqual(pending);
    if (!result.ok) {
      expect(result.reason).toBe("interrupted_save");
      expect(result.recoveryCandidate).toBe(true);
      expect(result.storedPrimaryAvailable).toBe(true);
    }
  });

  it("孤立pendingがある間は通常保存でjournalを上書きしない", () => {
    const { current, pendingRaw, currentRaw } = seedOrphanedPending();
    const local = [
      makeNote({
        title: "この画面の未保存編集",
        updatedAt: "2026-08-28T00:03:00.000Z",
      }),
    ];

    const result = saveNotes(local, {
      expectedNotes: current,
      writerId: "this-writer",
    });

    expect(result).toEqual({ ok: false, reason: "conflict" });
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBe(currentRaw);
    const journal = JSON.parse(storage._store[PENDING_SAVE_KEY_FOR_TESTING]) as {
      nextRaw: string;
    };
    expect(journal.nextRaw).toBe(pendingRaw);
  });

  it("保存済みprimaryを選ぶとpending候補を退避してjournalを解消する", () => {
    const { current, pendingRaw, currentRaw } = seedOrphanedPending();

    const result = loadNotes({ resolvePendingSave: "prefer_primary" });

    expect(result).toEqual({ ok: true, notes: current });
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBe(currentRaw);
    expect(storage._store[BACKUP_KEY_FOR_TESTING]).toBe(currentRaw);
    expect(storage._store[CONFLICT_BACKUP_KEY_FOR_TESTING]).toBe(pendingRaw);
    expect(storage._store[PENDING_SAVE_KEY_FOR_TESTING]).toBeUndefined();
  });

  it("pending退避に失敗した場合はprimary選択を確定せずjournalを残す", () => {
    const { pending, pendingRaw } = seedOrphanedPending();
    storage.setItem.mockImplementation((key: string, value: string) => {
      if (key === CONFLICT_BACKUP_KEY_FOR_TESTING) {
        throw new DOMException("quota", "QuotaExceededError");
      }
      storage._store[key] = value;
    });

    const result = loadNotes({ resolvePendingSave: "prefer_primary" });

    expect(result.ok).toBe(false);
    expect(result.notes).toEqual(pending);
    const journal = JSON.parse(storage._store[PENDING_SAVE_KEY_FOR_TESTING]) as {
      nextRaw: string;
    };
    expect(journal.nextRaw).toBe(pendingRaw);
  });

  it("孤立pending中にローカル版をforceするとpendingとcurrent primaryの両方を退避する", () => {
    const { pendingRaw, currentRaw } = seedOrphanedPending();
    const local = [
      makeNote({
        title: "最終的にこの画面を採用",
        updatedAt: "2026-08-28T00:04:00.000Z",
      }),
    ];
    const localRaw = JSON.stringify(local);

    const result = saveNotes(local, { force: true, writerId: "this-writer" });

    expect(result).toEqual({ ok: true });
    expect(storage._store[CONFLICT_BACKUP_KEY_FOR_TESTING]).toBe(pendingRaw);
    expect(storage._store[SECONDARY_CONFLICT_BACKUP_KEY_FOR_TESTING]).toBe(currentRaw);
    expect(storage._store[BACKUP_KEY_FOR_TESTING]).toBe(localRaw);
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBe(localRaw);
    expect(storage._store[PENDING_SAVE_KEY_FOR_TESTING]).toBeUndefined();
  });

  it("中断候補そのものをforce確定する場合は直前primaryをconflict backupへ残す", () => {
    const base = [makeNote({ title: "直前まで保存済み" })];
    const pending = [
      makeNote({
        title: "中断候補を採用",
        updatedAt: "2026-08-28T00:05:00.000Z",
      }),
    ];
    const baseRaw = JSON.stringify(base);
    const pendingRaw = JSON.stringify(pending);
    storage.setItem(STORAGE_KEY_FOR_TESTING, baseRaw);
    storage.setItem(
      PENDING_SAVE_KEY_FOR_TESTING,
      JSON.stringify({ version: 1, baseRaw, nextRaw: pendingRaw }),
    );

    const result = saveNotes(pending, { force: true });

    expect(result).toEqual({ ok: true });
    expect(storage._store[CONFLICT_BACKUP_KEY_FOR_TESTING]).toBe(baseRaw);
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBe(pendingRaw);
  });
});
