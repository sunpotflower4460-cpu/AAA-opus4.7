import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  loadNotes,
  saveNotes,
  STORAGE_KEY_FOR_TESTING,
  BACKUP_KEY_FOR_TESTING,
  CONFLICT_BACKUP_KEY_FOR_TESTING,
  PENDING_SAVE_KEY_FOR_TESTING,
  CORRUPT_BACKUP_KEY_FOR_TESTING,
} from "../storage";
import type { Note } from "../../types/note";

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

  it("ストレージが空の場合は空配列を返す", () => {
    expect(loadNotes()).toEqual({ ok: true, notes: [] });
  });

  it("primary だけ消失して正常な backup が残っていれば復元候補として返す", () => {
    const backup = [makeNote({ id: "backup-only", title: "救出できる言葉" })];
    storage.setItem(BACKUP_KEY_FOR_TESTING, JSON.stringify(backup));

    const result = loadNotes();

    expect(result.ok).toBe(false);
    expect(result.notes).toEqual(backup);
    if (!result.ok) {
      expect(result.reason).toBe("missing_primary");
      expect(result.recoveredFromBackup).toBe(true);
      expect(result.recoveryCandidate).toBe(true);
    }
  });

  it("primary が無くても backup が空なら初回状態として空配列を返す", () => {
    storage.setItem(BACKUP_KEY_FOR_TESTING, JSON.stringify([]));

    expect(loadNotes()).toEqual({ ok: true, notes: [] });
  });

  it("有効なメモを正しく読み込む", () => {
    storage.setItem(STORAGE_KEY_FOR_TESTING, JSON.stringify([makeNote()]));
    const result = loadNotes();
    expect(result.ok).toBe(true);
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0].id).toBe("test-id-1");
  });

  it("中断 journal の base が primary と一致すれば next を復元候補として返す", () => {
    const base = [makeNote({ id: "base" })];
    const next = [makeNote({ id: "next", title: "保存途中の最新版" })];
    const baseRaw = JSON.stringify(base);
    const nextRaw = JSON.stringify(next);
    storage.setItem(STORAGE_KEY_FOR_TESTING, baseRaw);
    storage.setItem(
      PENDING_SAVE_KEY_FOR_TESTING,
      JSON.stringify({ version: 1, baseRaw, nextRaw }),
    );

    const result = loadNotes();

    expect(result.ok).toBe(false);
    expect(result.notes).toEqual(next);
    if (!result.ok) {
      expect(result.reason).toBe("interrupted_save");
      expect(result.recoveredFromPendingSave).toBe(true);
      expect(result.recoveryCandidate).toBe(true);
    }
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBe(baseRaw);
  });

  it("中断 journal の next が空配列でも削除保存の復元候補として保持する", () => {
    const baseRaw = JSON.stringify([makeNote({ id: "delete-me" })]);
    const nextRaw = JSON.stringify([]);
    storage.setItem(STORAGE_KEY_FOR_TESTING, baseRaw);
    storage.setItem(
      PENDING_SAVE_KEY_FOR_TESTING,
      JSON.stringify({ version: 1, baseRaw, nextRaw }),
    );

    const result = loadNotes();

    expect(result.ok).toBe(false);
    expect(result.notes).toEqual([]);
    if (!result.ok) {
      expect(result.reason).toBe("interrupted_save");
      expect(result.recoveryCandidate).toBe(true);
    }
  });

  it("journal の next がすでに primary なら完了済みとして backup を修復し journal を消す", () => {
    const baseRaw = JSON.stringify([makeNote({ id: "base" })]);
    const next = [makeNote({ id: "completed", title: "確定済み" })];
    const nextRaw = JSON.stringify(next);
    storage.setItem(STORAGE_KEY_FOR_TESTING, nextRaw);
    storage.setItem(BACKUP_KEY_FOR_TESTING, baseRaw);
    storage.setItem(
      PENDING_SAVE_KEY_FOR_TESTING,
      JSON.stringify({ version: 1, baseRaw, nextRaw }),
    );

    const result = loadNotes();

    expect(result).toEqual({ ok: true, notes: next });
    expect(storage._store[BACKUP_KEY_FOR_TESTING]).toBe(nextRaw);
    expect(storage._store[PENDING_SAVE_KEY_FOR_TESTING]).toBeUndefined();
  });

  it("不正な journal は正常な primary の読み込みを壊さない", () => {
    const primary = [makeNote({ id: "primary" })];
    storage.setItem(STORAGE_KEY_FOR_TESTING, JSON.stringify(primary));
    storage.setItem(PENDING_SAVE_KEY_FOR_TESTING, "{ malformed journal");

    expect(loadNotes()).toEqual({ ok: true, notes: primary });
  });

  it("JSON破損時は元データを退避する", () => {
    const corruptData = "{ not valid json";
    storage.setItem(STORAGE_KEY_FOR_TESTING, corruptData);

    const result = loadNotes();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("corrupt");
      expect(result.corruptBackupKey).toBe(CORRUPT_BACKUP_KEY_FOR_TESTING);
    }
    expect(storage._store[CORRUPT_BACKUP_KEY_FOR_TESTING]).toBe(corruptData);
  });

  it("主データが壊れていても正常なバックアップから復元する", () => {
    const backup = [makeNote({ id: "from-backup", title: "復元" })];
    storage.setItem(STORAGE_KEY_FOR_TESTING, "{ broken");
    storage.setItem(BACKUP_KEY_FOR_TESTING, JSON.stringify(backup));

    const result = loadNotes();

    expect(result.ok).toBe(false);
    expect(result.notes.map((note) => note.id)).toEqual(["from-backup"]);
    if (!result.ok) {
      expect(result.recoveredFromBackup).toBe(true);
      expect(result.recoveryCandidate).toBe(true);
    }
  });

  it("配列ではない主データでも正常なバックアップを復元する", () => {
    storage.setItem(STORAGE_KEY_FOR_TESTING, JSON.stringify({ id: "bad" }));
    storage.setItem(
      BACKUP_KEY_FOR_TESTING,
      JSON.stringify([makeNote({ id: "backup-note" })]),
    );

    const result = loadNotes();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_structure");
    expect(result.notes[0].id).toBe("backup-note");
  });

  it("一部に不正要素がある配列を正常扱いせず、正常要素だけ復元候補にする", () => {
    const valid = makeNote({ id: "valid" });
    const invalid = { id: 123, title: "bad" };
    storage.setItem(STORAGE_KEY_FOR_TESTING, JSON.stringify([valid, invalid]));

    const result = loadNotes();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_structure");
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0].id).toBe("valid");
  });

  it("バックアップ領域だけ読めなくても主データから救えた正常要素を返す", () => {
    const valid = makeNote({ id: "survivor" });
    const invalid = { id: 123, title: "bad" };
    storage.setItem(STORAGE_KEY_FOR_TESTING, JSON.stringify([valid, invalid]));

    storage.getItem.mockImplementation((key: string) => {
      if (key === BACKUP_KEY_FOR_TESTING) {
        throw new DOMException("blocked", "SecurityError");
      }
      return storage._store[key] ?? null;
    });

    const result = loadNotes();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_structure");
    expect(result.notes.map((note) => note.id)).toEqual(["survivor"]);
  });

  it("重複IDは不正構造とし、updatedAt が新しい方だけを復元候補にする", () => {
    const oldNote = makeNote({
      id: "duplicate",
      title: "古い",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });
    const newNote = makeNote({
      id: "duplicate",
      title: "新しい",
      updatedAt: "2024-02-01T00:00:00.000Z",
    });
    storage.setItem(STORAGE_KEY_FOR_TESTING, JSON.stringify([oldNote, newNote]));

    const result = loadNotes();

    expect(result.ok).toBe(false);
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0].title).toBe("新しい");
  });

  it("不正日時を持つメモを正常扱いしない", () => {
    storage.setItem(
      STORAGE_KEY_FOR_TESTING,
      JSON.stringify([makeNote({ createdAt: "not-a-date" })]),
    );

    const result = loadNotes();

    expect(result.ok).toBe(false);
    expect(result.notes).toEqual([]);
  });

  it("不正 locale を持つメモを正常扱いしない", () => {
    const invalidLocale = { ...makeNote(), locale: "xx" };
    storage.setItem(STORAGE_KEY_FOR_TESTING, JSON.stringify([invalidLocale]));

    const result = loadNotes();

    expect(result.ok).toBe(false);
    expect(result.notes).toEqual([]);
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

  it("正常に保存できた場合は { ok: true } を返して journal を残さない", () => {
    expect(saveNotes([makeNote()]).ok).toBe(true);
    expect(storage._store[PENDING_SAVE_KEY_FOR_TESTING]).toBeUndefined();
  });

  it("保存後にloadNotesで同じデータを読み込める", () => {
    saveNotes([makeNote({ id: "save-test" })]);
    const loaded = loadNotes();
    expect(loaded.ok).toBe(true);
    expect(loaded.notes[0].id).toBe("save-test");
  });

  it("保存成功時は primary と同じ最新内容を復旧 backup に残す", () => {
    const original = [makeNote({ id: "original" })];
    const updated = [makeNote({ id: "updated" })];
    storage.setItem(STORAGE_KEY_FOR_TESTING, JSON.stringify(original));

    const result = saveNotes(updated);

    expect(result).toEqual({ ok: true });
    expect(JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[]).toEqual(updated);
    expect(JSON.parse(storage._store[BACKUP_KEY_FOR_TESTING]) as Note[]).toEqual(updated);
  });

  it("journal の書き込みに失敗したら backup と primary を変更しない", () => {
    const original = [makeNote({ id: "original" })];
    const updated = [makeNote({ id: "updated" })];
    const originalRaw = JSON.stringify(original);
    storage.setItem(STORAGE_KEY_FOR_TESTING, originalRaw);

    storage.setItem.mockImplementation((key: string, value: string) => {
      if (key === PENDING_SAVE_KEY_FOR_TESTING) {
        throw new DOMException("quota", "QuotaExceededError");
      }
      storage._store[key] = value;
    });

    const result = saveNotes(updated);

    expect(result).toEqual({ ok: false, reason: "quota" });
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBe(originalRaw);
    expect(storage._store[BACKUP_KEY_FOR_TESTING]).toBeUndefined();
  });

  it("復旧 backup の更新に失敗したら primary を変更せず journal に最新版候補を残す", () => {
    const original = [makeNote({ id: "original" })];
    const updated = [makeNote({ id: "updated" })];
    const originalRaw = JSON.stringify(original);
    storage.setItem(STORAGE_KEY_FOR_TESTING, originalRaw);

    storage.setItem.mockImplementation((key: string, value: string) => {
      if (key === BACKUP_KEY_FOR_TESTING) {
        throw new DOMException("quota", "QuotaExceededError");
      }
      storage._store[key] = value;
    });

    const result = saveNotes(updated);

    expect(result).toEqual({ ok: false, reason: "quota" });
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBe(originalRaw);
    expect(storage._store[PENDING_SAVE_KEY_FOR_TESTING]).toBeDefined();

    const recovered = loadNotes();
    expect(recovered.ok).toBe(false);
    expect(recovered.notes).toEqual(updated);
    if (!recovered.ok) expect(recovered.reason).toBe("interrupted_save");
  });

  it("backup 成功後に primary 保存が失敗しても再起動時に最新版を中断保存候補として返す", () => {
    const original = [makeNote({ id: "original" })];
    const updated = [makeNote({ id: "updated" })];
    const originalRaw = JSON.stringify(original);
    storage.setItem(STORAGE_KEY_FOR_TESTING, originalRaw);

    storage.setItem.mockImplementation((key: string, value: string) => {
      if (key === STORAGE_KEY_FOR_TESTING) {
        throw new DOMException("blocked", "SecurityError");
      }
      storage._store[key] = value;
    });

    const result = saveNotes(updated);

    expect(result).toEqual({ ok: false, reason: "unavailable" });
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBe(originalRaw);
    expect(JSON.parse(storage._store[BACKUP_KEY_FOR_TESTING]) as Note[]).toEqual(updated);
    expect(storage._store[PENDING_SAVE_KEY_FOR_TESTING]).toBeDefined();

    const recovered = loadNotes();
    expect(recovered.ok).toBe(false);
    expect(recovered.notes).toEqual(updated);
    if (!recovered.ok) {
      expect(recovered.reason).toBe("interrupted_save");
      expect(recovered.recoveryCandidate).toBe(true);
    }
  });

  it("空配列の保存が primary で中断しても全削除の意図を復元候補として返す", () => {
    const originalRaw = JSON.stringify([makeNote({ id: "delete-me" })]);
    storage.setItem(STORAGE_KEY_FOR_TESTING, originalRaw);

    storage.setItem.mockImplementation((key: string, value: string) => {
      if (key === STORAGE_KEY_FOR_TESTING) {
        throw new DOMException("blocked", "SecurityError");
      }
      storage._store[key] = value;
    });

    expect(saveNotes([])).toEqual({ ok: false, reason: "unavailable" });
    const recovered = loadNotes();
    expect(recovered.ok).toBe(false);
    expect(recovered.notes).toEqual([]);
    if (!recovered.ok) {
      expect(recovered.reason).toBe("interrupted_save");
      expect(recovered.recoveryCandidate).toBe(true);
    }
  });

  it("破損した主データでは通常保存で既存の正常バックアップを上書きしない", () => {
    const validBackup = JSON.stringify([makeNote({ id: "safe-backup" })]);
    storage.setItem(BACKUP_KEY_FOR_TESTING, validBackup);
    storage.setItem(STORAGE_KEY_FOR_TESTING, "{ broken primary");

    const result = saveNotes([makeNote({ id: "recovered-and-edited" })]);

    expect(result).toEqual({ ok: false, reason: "conflict" });
    expect(storage._store[BACKUP_KEY_FOR_TESTING]).toBe(validBackup);
  });

  it("空文字の primary を正常な空状態と誤認せず conflict で止めて退避する", () => {
    storage.setItem(STORAGE_KEY_FOR_TESTING, "");

    const result = saveNotes([makeNote()], { expectedNotes: [] });

    expect(result).toEqual({ ok: false, reason: "conflict" });
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBe("");
    expect(storage._store[CORRUPT_BACKUP_KEY_FOR_TESTING]).toBe("");
  });

  it("force 保存で破損 primary を上書きする場合も元 raw を退避する", () => {
    const corruptRaw = "{ broken before force";
    const forced = [makeNote({ id: "forced" })];
    storage.setItem(STORAGE_KEY_FOR_TESTING, corruptRaw);

    const result = saveNotes(forced, { force: true });

    expect(result).toEqual({ ok: true });
    expect(storage._store[CORRUPT_BACKUP_KEY_FOR_TESTING]).toBe(corruptRaw);
    expect(JSON.parse(storage._store[BACKUP_KEY_FOR_TESTING]) as Note[]).toEqual(forced);
    expect(JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[]).toEqual(forced);
    expect(storage._store[PENDING_SAVE_KEY_FOR_TESTING]).toBeUndefined();
  });

  it("期待していた内容から primary が変わっていれば conflict で保存を止める", () => {
    const baseline = [makeNote({ id: "shared", title: "最初" })];
    const remote = [
      makeNote({
        id: "shared",
        title: "別タブ更新",
        updatedAt: "2024-01-02T00:00:00.000Z",
      }),
    ];
    const local = [
      makeNote({
        id: "shared",
        title: "こちらの更新",
        updatedAt: "2024-01-03T00:00:00.000Z",
      }),
    ];
    storage.setItem(STORAGE_KEY_FOR_TESTING, JSON.stringify(remote));

    const result = saveNotes(local, { expectedNotes: baseline });

    expect(result).toEqual({ ok: false, reason: "conflict" });
    expect(JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[]).toEqual(remote);
    expect(storage._store[BACKUP_KEY_FOR_TESTING]).toBeUndefined();
  });

  it("未知の将来フィールドだけが変わっていても conflict として検知する", () => {
    const baseline = [
      { ...makeNote({ id: "shared" }), futureField: { revision: 1 } },
    ];
    const remote = [
      { ...makeNote({ id: "shared" }), futureField: { revision: 2 } },
    ];
    const local = [makeNote({ id: "shared", title: "古い画面から編集" })];
    storage.setItem(STORAGE_KEY_FOR_TESTING, JSON.stringify(remote));

    const result = saveNotes(local, { expectedNotes: baseline });

    expect(result).toEqual({ ok: false, reason: "conflict" });
    expect(JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as unknown).toEqual(remote);
  });

  it("別スナップショットの中断 journal が残っていれば primary が同じでも通常保存を止める", () => {
    const baseline = [makeNote({ id: "shared", title: "最初" })];
    const interrupted = [
      makeNote({
        id: "shared",
        title: "別画面の中断編集",
        updatedAt: "2024-01-02T00:00:00.000Z",
      }),
    ];
    const local = [
      makeNote({
        id: "shared",
        title: "こちらの別編集",
        updatedAt: "2024-01-03T00:00:00.000Z",
      }),
    ];
    const baseRaw = JSON.stringify(baseline);
    const interruptedRaw = JSON.stringify(interrupted);
    storage.setItem(STORAGE_KEY_FOR_TESTING, baseRaw);
    storage.setItem(
      PENDING_SAVE_KEY_FOR_TESTING,
      JSON.stringify({ version: 1, baseRaw, nextRaw: interruptedRaw }),
    );

    const result = saveNotes(local, { expectedNotes: baseline });

    expect(result).toEqual({ ok: false, reason: "conflict" });
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBe(baseRaw);
    const journal = JSON.parse(storage._store[PENDING_SAVE_KEY_FOR_TESTING]) as {
      nextRaw: string;
    };
    expect(journal.nextRaw).toBe(interruptedRaw);
  });

  it("同じ中断 journal の next は安全な再試行として保存を完了できる", () => {
    const baseline = [makeNote({ id: "shared", title: "最初" })];
    const interrupted = [
      makeNote({
        id: "shared",
        title: "再試行する編集",
        updatedAt: "2024-01-02T00:00:00.000Z",
      }),
    ];
    const baseRaw = JSON.stringify(baseline);
    const interruptedRaw = JSON.stringify(interrupted);
    storage.setItem(STORAGE_KEY_FOR_TESTING, baseRaw);
    storage.setItem(
      PENDING_SAVE_KEY_FOR_TESTING,
      JSON.stringify({ version: 1, baseRaw, nextRaw: interruptedRaw }),
    );

    const result = saveNotes(interrupted, { expectedNotes: baseline });

    expect(result).toEqual({ ok: true });
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBe(interruptedRaw);
    expect(storage._store[BACKUP_KEY_FOR_TESTING]).toBe(interruptedRaw);
    expect(storage._store[PENDING_SAVE_KEY_FOR_TESTING]).toBeUndefined();
  });

  it("期待内容と primary が一致していれば通常保存できる", () => {
    const baseline = [makeNote({ id: "shared", title: "最初" })];
    const local = [
      makeNote({
        id: "shared",
        title: "こちらの更新",
        updatedAt: "2024-01-03T00:00:00.000Z",
      }),
    ];
    storage.setItem(STORAGE_KEY_FOR_TESTING, JSON.stringify(baseline));

    const result = saveNotes(local, { expectedNotes: baseline });

    expect(result).toEqual({ ok: true });
    expect(JSON.parse(storage._store[BACKUP_KEY_FOR_TESTING]) as Note[]).toEqual(local);
    expect(JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[]).toEqual(local);
  });

  it("force 保存は別画面版を conflict backup に残し、復旧 backup と primary をローカル版へ揃える", () => {
    const remote = [makeNote({ id: "remote", title: "別タブ" })];
    const local = [makeNote({ id: "local", title: "この画面" })];
    storage.setItem(STORAGE_KEY_FOR_TESTING, JSON.stringify(remote));

    const result = saveNotes(local, { force: true });

    expect(result).toEqual({ ok: true });
    expect(JSON.parse(storage._store[CONFLICT_BACKUP_KEY_FOR_TESTING]) as Note[]).toEqual(
      remote,
    );
    expect(JSON.parse(storage._store[BACKUP_KEY_FOR_TESTING]) as Note[]).toEqual(local);
    expect(JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[]).toEqual(local);
  });

  it("force 保存は中断 journal の next を最優先の競合候補として退避する", () => {
    const base = [makeNote({ id: "shared", title: "古いprimary" })];
    const interrupted = [
      makeNote({
        id: "shared",
        title: "別画面の未確定最新版",
        updatedAt: "2024-01-02T00:00:00.000Z",
      }),
    ];
    const local = [
      makeNote({
        id: "shared",
        title: "この画面を優先",
        updatedAt: "2024-01-03T00:00:00.000Z",
      }),
    ];
    const baseRaw = JSON.stringify(base);
    const interruptedRaw = JSON.stringify(interrupted);
    storage.setItem(STORAGE_KEY_FOR_TESTING, baseRaw);
    storage.setItem(
      PENDING_SAVE_KEY_FOR_TESTING,
      JSON.stringify({ version: 1, baseRaw, nextRaw: interruptedRaw }),
    );

    const result = saveNotes(local, { force: true });

    expect(result).toEqual({ ok: true });
    expect(storage._store[CONFLICT_BACKUP_KEY_FOR_TESTING]).toBe(interruptedRaw);
    expect(JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[]).toEqual(local);
  });

  it("force 保存で conflict backup の退避に失敗したら別画面版を上書きしない", () => {
    const remote = [makeNote({ id: "remote", title: "守る別タブ" })];
    const local = [makeNote({ id: "local", title: "この画面" })];
    const remoteRaw = JSON.stringify(remote);
    storage.setItem(STORAGE_KEY_FOR_TESTING, remoteRaw);

    storage.setItem.mockImplementation((key: string, value: string) => {
      if (key === CONFLICT_BACKUP_KEY_FOR_TESTING) {
        throw new DOMException("quota", "QuotaExceededError");
      }
      storage._store[key] = value;
    });

    const result = saveNotes(local, { force: true });

    expect(result).toEqual({ ok: false, reason: "quota" });
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBe(remoteRaw);
    expect(storage._store[BACKUP_KEY_FOR_TESTING]).toBeUndefined();
    expect(storage._store[PENDING_SAVE_KEY_FOR_TESTING]).toBeUndefined();
  });

  it("保存対象そのものが不正なら invalid_data として永続化を拒否する", () => {
    const duplicateId = [
      makeNote({ id: "duplicate", title: "a" }),
      makeNote({ id: "duplicate", title: "b" }),
    ];

    const result = saveNotes(duplicateId);

    expect(result).toEqual({ ok: false, reason: "invalid_data" });
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBeUndefined();
  });

  it("容量超過時は quota を返す", () => {
    storage.setItem.mockImplementation(() => {
      throw new DOMException("QuotaExceededError", "QuotaExceededError");
    });

    const result = saveNotes([makeNote()]);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("quota");
  });

  it("空配列を保存できる", () => {
    const result = saveNotes([]);
    expect(result.ok).toBe(true);
    expect(loadNotes()).toEqual({ ok: true, notes: [] });
  });
});
