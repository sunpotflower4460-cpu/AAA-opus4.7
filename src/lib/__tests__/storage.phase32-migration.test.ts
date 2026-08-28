import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BACKUP_KEY_FOR_TESTING,
  CONFLICT_BACKUP_KEY_FOR_TESTING,
  PENDING_SAVE_KEY_FOR_TESTING,
  STORAGE_KEY_FOR_TESTING,
  loadNotes,
  saveNotes,
} from "../storage";
import type { Note } from "../../types/note";

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "note-1",
    title: "メモ",
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

describe("Phase 32 storage migration and writer ownership", () => {
  let storage: ReturnType<typeof mockLocalStorage>;

  beforeEach(() => {
    storage = mockLocalStorage();
    Object.defineProperty(window, "localStorage", {
      value: storage,
      writable: true,
      configurable: true,
    });
  });

  it("Phase31の1世代前backupを退避して、正常primaryを最新版mirrorへ移行する", () => {
    const previous = [makeNote({ id: "previous", title: "1世代前" })];
    const current = [
      makeNote({
        id: "current",
        title: "現在のprimary",
        updatedAt: "2026-08-28T00:10:00.000Z",
      }),
    ];
    const previousRaw = JSON.stringify(previous);
    const currentRaw = JSON.stringify(current);
    storage.setItem(BACKUP_KEY_FOR_TESTING, previousRaw);
    storage.setItem(STORAGE_KEY_FOR_TESTING, currentRaw);

    expect(loadNotes()).toEqual({ ok: true, notes: current });
    expect(storage._store[BACKUP_KEY_FOR_TESTING]).toBe(currentRaw);
    expect(storage._store[CONFLICT_BACKUP_KEY_FOR_TESTING]).toBe(previousRaw);
  });

  it("backupが無い正常primaryも初回ロードで最新版mirrorを作る", () => {
    const current = [makeNote({ id: "only-primary" })];
    const currentRaw = JSON.stringify(current);
    storage.setItem(STORAGE_KEY_FOR_TESTING, currentRaw);

    expect(loadNotes()).toEqual({ ok: true, notes: current });
    expect(storage._store[BACKUP_KEY_FOR_TESTING]).toBe(currentRaw);
  });

  it("既存のconflict backupがある場合はPhase31旧backupで上書きしない", () => {
    const current = [makeNote({ id: "current" })];
    const previous = [makeNote({ id: "previous" })];
    const protectedConflict = [makeNote({ id: "protected-conflict" })];
    storage.setItem(STORAGE_KEY_FOR_TESTING, JSON.stringify(current));
    storage.setItem(BACKUP_KEY_FOR_TESTING, JSON.stringify(previous));
    storage.setItem(CONFLICT_BACKUP_KEY_FOR_TESTING, JSON.stringify(protectedConflict));

    loadNotes();

    expect(JSON.parse(storage._store[CONFLICT_BACKUP_KEY_FOR_TESTING]) as Note[]).toEqual(
      protectedConflict,
    );
    expect(JSON.parse(storage._store[BACKUP_KEY_FOR_TESTING]) as Note[]).toEqual(current);
  });

  it("同じwriterは自分の中断journalを、さらに新しい編集へ更新して保存できる", () => {
    const base = [makeNote({ title: "base" })];
    const firstAttempt = [
      makeNote({ title: "最初の保存失敗", updatedAt: "2026-08-28T00:01:00.000Z" }),
    ];
    const latest = [
      makeNote({ title: "その後も入力した最新版", updatedAt: "2026-08-28T00:02:00.000Z" }),
    ];
    const baseRaw = JSON.stringify(base);
    storage.setItem(STORAGE_KEY_FOR_TESTING, baseRaw);
    storage.setItem(
      PENDING_SAVE_KEY_FOR_TESTING,
      JSON.stringify({
        version: 1,
        baseRaw,
        nextRaw: JSON.stringify(firstAttempt),
        writerId: "writer-a",
      }),
    );

    const result = saveNotes(latest, { expectedNotes: base, writerId: "writer-a" });

    expect(result).toEqual({ ok: true });
    expect(JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[]).toEqual(latest);
    expect(storage._store[PENDING_SAVE_KEY_FOR_TESTING]).toBeUndefined();
  });

  it("別writerは同じprimaryを見ていても他画面の中断journalを上書きできない", () => {
    const base = [makeNote({ title: "base" })];
    const interrupted = [
      makeNote({ title: "writer-aの候補", updatedAt: "2026-08-28T00:01:00.000Z" }),
    ];
    const other = [
      makeNote({ title: "writer-bの編集", updatedAt: "2026-08-28T00:02:00.000Z" }),
    ];
    const baseRaw = JSON.stringify(base);
    const interruptedRaw = JSON.stringify(interrupted);
    storage.setItem(STORAGE_KEY_FOR_TESTING, baseRaw);
    storage.setItem(
      PENDING_SAVE_KEY_FOR_TESTING,
      JSON.stringify({
        version: 1,
        baseRaw,
        nextRaw: interruptedRaw,
        writerId: "writer-a",
      }),
    );

    const result = saveNotes(other, { expectedNotes: base, writerId: "writer-b" });

    expect(result).toEqual({ ok: false, reason: "conflict" });
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBe(baseRaw);
    const journal = JSON.parse(storage._store[PENDING_SAVE_KEY_FOR_TESTING]) as {
      nextRaw: string;
      writerId: string;
    };
    expect(journal.nextRaw).toBe(interruptedRaw);
    expect(journal.writerId).toBe("writer-a");
  });
});
