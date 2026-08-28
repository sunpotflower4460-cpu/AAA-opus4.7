import type { Note } from "../types/note";

export const NOTES_STORAGE_KEY = "zanshin.notes.v1";
const STORAGE_KEY = NOTES_STORAGE_KEY;
// 保存しようとした最新の正常スナップショット。primary 消失・破損時の第一復旧候補。
const BACKUP_KEY = "zanshin.notes.backup.v1";
// 競合解決で「この画面を優先」する直前の、別画面側の正常データ専用退避先。
const CONFLICT_BACKUP_KEY = "zanshin.notes.conflict.backup.v1";
const CORRUPT_BACKUP_KEY = "zanshin.notes.corrupt.backup";

export type SaveResult =
  | { ok: true }
  | {
      ok: false;
      reason: "quota" | "unavailable" | "unknown" | "conflict" | "invalid_data";
    };

export type SaveOptions = {
  /**
   * 最後にこの画面が正常に読み込んだ / 保存したメモ集合。
   * 現在の localStorage がこれと違う場合、別画面の更新とみなして保存を止める。
   */
  expectedNotes?: readonly Note[];
  /** ユーザーが競合を理解した上で、この画面の内容を明示的に優先するときだけ true。 */
  force?: boolean;
};

export type LoadResult =
  | { ok: true; notes: Note[] }
  | {
      ok: false;
      notes: Note[];
      reason: "corrupt" | "invalid_structure" | "missing_primary" | "unavailable";
      corruptBackupKey?: string;
      recoveredFromBackup?: boolean;
    };

type ParsedNotesResult = {
  status: "valid" | "corrupt" | "invalid_structure";
  notes: Note[];
};

function isValidDateString(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !Number.isNaN(new Date(value).getTime())
  );
}

function isNote(value: unknown): value is Note {
  if (!value || typeof value !== "object") return false;
  const note = value as Record<string, unknown>;
  const localeIsValid =
    note.locale === undefined || note.locale === "ja" || note.locale === "en";

  return (
    typeof note.id === "string" &&
    note.id.trim().length > 0 &&
    typeof note.title === "string" &&
    typeof note.body === "string" &&
    isValidDateString(note.createdAt) &&
    isValidDateString(note.updatedAt) &&
    typeof note.isFavorite === "boolean" &&
    localeIsValid
  );
}

function parseNotesRaw(raw: string): ParsedNotesResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: "corrupt", notes: [] };
  }

  if (!Array.isArray(parsed)) {
    return { status: "invalid_structure", notes: [] };
  }

  const notesById = new Map<string, Note>();
  let foundInvalidStructure = false;

  for (const value of parsed) {
    if (!isNote(value)) {
      foundInvalidStructure = true;
      continue;
    }

    const existing = notesById.get(value.id);
    if (!existing) {
      notesById.set(value.id, value);
      continue;
    }

    // 重複IDは編集・削除が複数メモへ波及するため不正構造として扱う。
    // 復元表示には、より新しい updatedAt を持つ方だけを残す。
    foundInvalidStructure = true;
    if (new Date(value.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
      notesById.set(value.id, value);
    }
  }

  return {
    status: foundInvalidStructure ? "invalid_structure" : "valid",
    notes: Array.from(notesById.values()),
  };
}

function notesMatch(left: readonly Note[], right: readonly Note[]): boolean {
  // Note 型に将来フィールドが追加された場合も、その差分を競合として扱う。
  // 既知フィールドだけを比較すると、古い画面が新しいスキーマの情報を黙って消し得る。
  // 多少の false-positive より silent overwrite を防ぐ方を優先する。
  return JSON.stringify(left) === JSON.stringify(right);
}

function mergeRecoveredNotes(primary: Note[], backup: Note[]): Note[] {
  const merged = new Map<string, Note>();

  for (const note of backup) merged.set(note.id, note);

  for (const note of primary) {
    const existing = merged.get(note.id);
    if (
      !existing ||
      new Date(note.updatedAt).getTime() >= new Date(existing.updatedAt).getTime()
    ) {
      merged.set(note.id, note);
    }
  }

  return Array.from(merged.values());
}

function isQuotaError(error: unknown): boolean {
  if (!(error instanceof DOMException)) return false;
  // DOMException.code は非推奨のため name で判定する
  return error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED";
}

function saveFailureFromError(error: unknown): SaveResult {
  if (isQuotaError(error)) return { ok: false, reason: "quota" };
  if (error instanceof DOMException) return { ok: false, reason: "unavailable" };
  return { ok: false, reason: "unknown" };
}

function preserveCorruptRaw(raw: string): void {
  try {
    window.localStorage.setItem(CORRUPT_BACKUP_KEY, raw);
  } catch {
    // 退避失敗は復旧処理そのものを止めない。
    // UIでは「可能な場合は退避」と表現し、成功を断定しない。
  }
}

function readValidatedBackup(): Note[] | null {
  try {
    const backupRaw = window.localStorage.getItem(BACKUP_KEY);
    if (backupRaw === null) return null;

    const backup = parseNotesRaw(backupRaw);
    return backup.status === "valid" ? backup.notes : null;
  } catch {
    // バックアップ領域だけが読み出せなくても、主データから救えた正常要素は返す。
    return null;
  }
}

/**
 * localStorage からメモを読み込む。
 * - 正常データはそのまま返す
 * - primary だけ消失して正常な backup が残っていれば復元候補として返す
 * - JSON破損 / 不正要素 / 重複ID / 不正日時は元データを退避する
 * - 最新の正常 backup が利用できれば復元候補としてマージする
 * - 復元候補を表示しても ok:false のまま返し、自動上書きを防ぐ
 */
export function loadNotes(): LoadResult {
  if (typeof window === "undefined") return { ok: true, notes: [] };

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      // アプリ自身は保存済み primary を removeItem しない。
      // backup は保存処理の primary より先に確定するため、primary 消失時の第一候補にする。
      const backupNotes = readValidatedBackup();
      if (backupNotes) {
        if (backupNotes.length === 0) return { ok: true, notes: [] };
        return {
          ok: false,
          notes: backupNotes,
          reason: "missing_primary",
          recoveredFromBackup: true,
        };
      }
      return { ok: true, notes: [] };
    }

    const primary = parseNotesRaw(raw);
    if (primary.status === "valid") {
      return { ok: true, notes: primary.notes };
    }

    preserveCorruptRaw(raw);

    let recoveredNotes = primary.notes;
    let recoveredFromBackup = false;

    const backupNotes = readValidatedBackup();
    if (backupNotes) {
      recoveredNotes = mergeRecoveredNotes(primary.notes, backupNotes);
      recoveredFromBackup = backupNotes.length > 0;
    }

    return {
      ok: false,
      notes: recoveredNotes,
      reason: primary.status,
      corruptBackupKey: CORRUPT_BACKUP_KEY,
      recoveredFromBackup,
    };
  } catch {
    return { ok: false, notes: [], reason: "unavailable" };
  }
}

/**
 * localStorage にメモを保存する。
 * - 保存対象そのものを検証し、不正構造を新たに永続化しない
 * - expectedNotes が指定されている場合は、現在の primary と一致するときだけ保存する
 * - 別画面の変更を検知した場合は conflict を返し、黙って上書きしない
 * - 破損 primary は force なしでは上書きせず、raw を退避して conflict とする
 * - force で正常な別画面データを上書きする前は conflict backup への退避成功を必須にする
 * - 復旧用 backup を primary より先に書き、backup 更新に失敗した場合は primary を変更しない
 */
export function saveNotes(notes: Note[], options: SaveOptions = {}): SaveResult {
  if (typeof window === "undefined") return { ok: false, reason: "unavailable" };

  let serialized: string;
  try {
    serialized = JSON.stringify(notes);
  } catch {
    return { ok: false, reason: "invalid_data" };
  }

  if (parseNotesRaw(serialized).status !== "valid") {
    return { ok: false, reason: "invalid_data" };
  }

  try {
    const currentRaw = window.localStorage.getItem(STORAGE_KEY);
    const currentParsed =
      currentRaw !== null
        ? parseNotesRaw(currentRaw)
        : ({ status: "valid", notes: [] } satisfies ParsedNotesResult);

    if (currentRaw !== null && currentParsed.status !== "valid") {
      preserveCorruptRaw(currentRaw);
      // 破損状態を通常保存で黙って置換しない。復元内容を確認した force のみ許可する。
      if (!options.force) return { ok: false, reason: "conflict" };
    }

    if (!options.force && options.expectedNotes) {
      if (
        currentParsed.status !== "valid" ||
        !notesMatch(currentParsed.notes, options.expectedNotes)
      ) {
        return { ok: false, reason: "conflict" };
      }
    }

    // 正常な別画面データを明示上書きする場合、その版を保存できなければ上書き自体を中止する。
    if (options.force && currentRaw !== null && currentParsed.status === "valid") {
      try {
        window.localStorage.setItem(CONFLICT_BACKUP_KEY, currentRaw);
      } catch (error) {
        return saveFailureFromError(error);
      }
    }

    // primary より先に復旧コピーを確定する。
    // これに失敗した場合は「保存成功なのに復旧コピーだけ古い」状態を作らない。
    try {
      window.localStorage.setItem(BACKUP_KEY, serialized);
    } catch (error) {
      return saveFailureFromError(error);
    }

    window.localStorage.setItem(STORAGE_KEY, serialized);
    return { ok: true };
  } catch (error) {
    return saveFailureFromError(error);
  }
}

export const STORAGE_KEY_FOR_TESTING = STORAGE_KEY;
export const BACKUP_KEY_FOR_TESTING = BACKUP_KEY;
export const CONFLICT_BACKUP_KEY_FOR_TESTING = CONFLICT_BACKUP_KEY;
export const CORRUPT_BACKUP_KEY_FOR_TESTING = CORRUPT_BACKUP_KEY;
