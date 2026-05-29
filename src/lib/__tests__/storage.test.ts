import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  loadNotes,
  saveNotes,
  STORAGE_KEY_FOR_TESTING,
  BACKUP_KEY_FOR_TESTING,
  CORRUPT_BACKUP_KEY_FOR_TESTING,
} from "../storage";
import type { Note } from "../../types/note";

// ヘルパー: 最低限有効な Note を生成する
function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "test-id-1",
    title: "テストタイトル",
    body: "テスト本文",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    isFavorite: false,
    locale: "ja",
    ...overrides,
  };
}

// localStorage のモック
function mockLocalStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { Object.keys(store).forEach((k) => delete store[k]); }),
    get _store() { return store; },
  };
}

describe("loadNotes", () => {
  let storage: ReturnType<typeof mockLocalStorage>;

  beforeEach(() => {
    storage = mockLocalStorage();
    Object.defineProperty(window, "localStorage", {
      value: storage,
      writable: true,
      configurable: true,
    });
  });

  it("ストレージが空の場合は空配列を返す (ok: true)", () => {
    const result = loadNotes();
    expect(result.ok).toBe(true);
    expect(result.notes).toEqual([]);
  });

  it("有効なメモを正しく読み込む (ok: true)", () => {
    const note = makeNote();
    storage.setItem(STORAGE_KEY_FOR_TESTING, JSON.stringify([note]));
    const result = loadNotes();
    expect(result.ok).toBe(true);
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0].id).toBe("test-id-1");
  });

  it("複数のメモを読み込む", () => {
    const notes = [makeNote({ id: "id-1" }), makeNote({ id: "id-2" }), makeNote({ id: "id-3" })];
    storage.setItem(STORAGE_KEY_FOR_TESTING, JSON.stringify(notes));
    const result = loadNotes();
    expect(result.ok).toBe(true);
    expect(result.notes).toHaveLength(3);
  });

  it("JSON破損時は ok: false を返し、corrupt backup キーを含む", () => {
    storage.setItem(STORAGE_KEY_FOR_TESTING, "{ invalid json ~~~");
    const result = loadNotes();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("corrupt");
      expect(result.corruptBackupKey).toBe(CORRUPT_BACKUP_KEY_FOR_TESTING);
      expect(result.notes).toEqual([]);
    }
  });

  it("JSON破損時に破損データを corrupt backup キーへ退避する", () => {
    const corruptData = "{ not valid json";
    storage.setItem(STORAGE_KEY_FOR_TESTING, corruptData);
    loadNotes();
    expect(storage._store[CORRUPT_BACKUP_KEY_FOR_TESTING]).toBe(corruptData);
  });

  it("配列ではないデータ(オブジェクト)の場合は invalid_structure を返す", () => {
    storage.setItem(STORAGE_KEY_FOR_TESTING, JSON.stringify({ id: "123" }));
    const result = loadNotes();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("invalid_structure");
    }
  });

  it("不正な要素を除外する (isNote フィルタ)", () => {
    const valid = makeNote({ id: "valid" });
    const invalid = { id: 123, title: "bad" }; // id が number
    storage.setItem(STORAGE_KEY_FOR_TESTING, JSON.stringify([valid, invalid]));
    const result = loadNotes();
    expect(result.ok).toBe(true);
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0].id).toBe("valid");
  });

  it("locale フィールドが省略されていてもロードできる", () => {
    const noteWithoutLocale = makeNote();
    delete (noteWithoutLocale as Partial<Note>).locale;
    storage.setItem(STORAGE_KEY_FOR_TESTING, JSON.stringify([noteWithoutLocale]));
    const result = loadNotes();
    expect(result.ok).toBe(true);
    expect(result.notes).toHaveLength(1);
  });
});

describe("saveNotes", () => {
  let storage: ReturnType<typeof mockLocalStorage>;

  beforeEach(() => {
    storage = mockLocalStorage();
    Object.defineProperty(window, "localStorage", {
      value: storage,
      writable: true,
      configurable: true,
    });
  });

  it("正常に保存できた場合は { ok: true } を返す", () => {
    const result = saveNotes([makeNote()]);
    expect(result.ok).toBe(true);
  });

  it("保存後にloadNotesで同じデータを読み込める", () => {
    const notes = [makeNote({ id: "save-test" })];
    saveNotes(notes);
    const loaded = loadNotes();
    expect(loaded.ok).toBe(true);
    expect(loaded.notes[0].id).toBe("save-test");
  });

  it("保存前に直前のデータをバックアップする", () => {
    const original = [makeNote({ id: "original" })];
    storage.setItem(STORAGE_KEY_FOR_TESTING, JSON.stringify(original));

    const updated = [makeNote({ id: "updated" })];
    saveNotes(updated);

    const backup = storage._store[BACKUP_KEY_FOR_TESTING];
    expect(backup).toBeDefined();
    const parsed: unknown = JSON.parse(backup);
    expect(Array.isArray(parsed) && (parsed as Array<{id: string}>)[0].id).toBe("original");
  });

  it("容量超過時は { ok: false, reason: 'quota' } を返す", () => {
    storage.setItem.mockImplementation(() => {
      throw new DOMException("QuotaExceededError", "QuotaExceededError");
    });
    const result = saveNotes([makeNote()]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("quota");
    }
  });

  it("空配列を保存できる", () => {
    const result = saveNotes([]);
    expect(result.ok).toBe(true);
    const loaded = loadNotes();
    expect(loaded.ok).toBe(true);
    expect(loaded.notes).toEqual([]);
  });
});
