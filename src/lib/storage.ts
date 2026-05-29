import type { Note } from "../types/note";

const STORAGE_KEY = "zanshin.notes.v1";
const BACKUP_KEY = "zanshin.notes.backup.v1";
const CORRUPT_BACKUP_KEY = "zanshin.notes.corrupt.backup";

export type SaveResult =
  | { ok: true }
  | { ok: false; reason: "quota" | "unavailable" | "unknown" };

export type LoadResult =
  | { ok: true; notes: Note[] }
  | { ok: false; notes: Note[]; reason: "corrupt" | "invalid_structure" | "unavailable"; corruptBackupKey?: string };

function isNote(value: unknown): value is Note {
  if (!value || typeof value !== "object") return false;
  const n = value as Record<string, unknown>;
  return (
    typeof n.id === "string" &&
    typeof n.title === "string" &&
    typeof n.body === "string" &&
    typeof n.createdAt === "string" &&
    typeof n.updatedAt === "string" &&
    typeof n.isFavorite === "boolean"
  );
}

function isQuotaError(e: unknown): boolean {
  if (!(e instanceof DOMException)) return false;
  // DOMException.code は非推奨のため name で判定する
  return e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED";
}

/**
 * localStorage からメモを読み込む。
 * - localStorage が空、または利用不可なら空配列を返す
 * - JSON parse に失敗した場合は破損データを退避し、LoadResult で通知する
 * - 配列ではない、または不正な要素は除外する
 */
export function loadNotes(): LoadResult {
  if (typeof window === "undefined") return { ok: true, notes: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ok: true, notes: [] };

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // JSON破損: データを退避してから空配列で復帰
      try {
        window.localStorage.setItem(CORRUPT_BACKUP_KEY, raw);
      } catch {
        // 退避失敗は無視
      }
      return { ok: false, notes: [], reason: "corrupt", corruptBackupKey: CORRUPT_BACKUP_KEY };
    }

    if (!Array.isArray(parsed)) {
      try {
        window.localStorage.setItem(CORRUPT_BACKUP_KEY, raw);
      } catch {
        // 退避失敗は無視
      }
      return { ok: false, notes: [], reason: "invalid_structure", corruptBackupKey: CORRUPT_BACKUP_KEY };
    }

    return { ok: true, notes: parsed.filter(isNote) };
  } catch {
    return { ok: false, notes: [], reason: "unavailable" };
  }
}

/**
 * localStorage にメモを保存する。
 * - 保存前に直前のデータをバックアップする
 * - quota超過・利用不可を検出して SaveResult で返す
 */
export function saveNotes(notes: Note[]): SaveResult {
  if (typeof window === "undefined") return { ok: false, reason: "unavailable" };
  try {
    // 直前バックアップを保存（失敗しても続行）
    try {
      const current = window.localStorage.getItem(STORAGE_KEY);
      if (current) window.localStorage.setItem(BACKUP_KEY, current);
    } catch {
      // バックアップ失敗は続行
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    return { ok: true };
  } catch (e) {
    if (isQuotaError(e)) return { ok: false, reason: "quota" };
    if (e instanceof DOMException) return { ok: false, reason: "unavailable" };
    return { ok: false, reason: "unknown" };
  }
}

export const STORAGE_KEY_FOR_TESTING = STORAGE_KEY;
export const BACKUP_KEY_FOR_TESTING = BACKUP_KEY;
export const CORRUPT_BACKUP_KEY_FOR_TESTING = CORRUPT_BACKUP_KEY;
