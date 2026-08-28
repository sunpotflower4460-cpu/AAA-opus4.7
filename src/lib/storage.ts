import type { Note } from "../types/note";

const STORAGE_KEY = "zanshin.notes.v1";
const BACKUP_KEY = "zanshin.notes.backup.v1";
const CORRUPT_BACKUP_KEY = "zanshin.notes.corrupt.backup";

export type SaveResult =
  | { ok: true }
  | { ok: false; reason: "quota" | "unavailable" | "unknown" };

export type LoadResult =
  | { ok: true; notes: Note[] }
  | {
      ok: false;
      notes: Note[];
      reason: "corrupt" | "invalid_structure" | "unavailable";
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

function preserveCorruptRaw(raw: string): void {
  try {
    window.localStorage.setItem(CORRUPT_BACKUP_KEY, raw);
  } catch {
    // 退避失敗は復旧処理そのものを止めない
  }
}

function readValidatedBackup(): Note[] | null {
  try {
    const backupRaw = window.localStorage.getItem(BACKUP_KEY);
    if (!backupRaw) return null;

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
 * - JSON破損 / 不正要素 / 重複ID / 不正日時は元データを退避する
 * - 直前バックアップが正常なら復元候補としてマージする
 * - 復元候補を表示しても ok:false のまま返し、自動上書きを防ぐ
 */
export function loadNotes(): LoadResult {
  if (typeof window === "undefined") return { ok: true, notes: [] };

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ok: true, notes: [] };

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
 * - 保存前に「正常と検証できた」直前データだけをバックアップする
 * - 破損した主データで正常バックアップを上書きしない
 * - quota超過・利用不可を検出して SaveResult で返す
 */
export function saveNotes(notes: Note[]): SaveResult {
  if (typeof window === "undefined") return { ok: false, reason: "unavailable" };

  try {
    try {
      const current = window.localStorage.getItem(STORAGE_KEY);
      if (current && parseNotesRaw(current).status === "valid") {
        window.localStorage.setItem(BACKUP_KEY, current);
      }
    } catch {
      // バックアップ失敗は主データ保存を妨げない
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    return { ok: true };
  } catch (error) {
    if (isQuotaError(error)) return { ok: false, reason: "quota" };
    if (error instanceof DOMException) return { ok: false, reason: "unavailable" };
    return { ok: false, reason: "unknown" };
  }
}

export const STORAGE_KEY_FOR_TESTING = STORAGE_KEY;
export const BACKUP_KEY_FOR_TESTING = BACKUP_KEY;
export const CORRUPT_BACKUP_KEY_FOR_TESTING = CORRUPT_BACKUP_KEY;
