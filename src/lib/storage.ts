import type { Note } from "../types/note";

const STORAGE_KEY = "zanshin.notes.v1";

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

/**
 * localStorage からメモを読み込む。
 * - localStorage が空、または利用不可なら空配列を返す
 * - JSON parse に失敗した場合も空配列で復帰する
 * - 配列ではない、または不正な要素は除外する
 */
export function loadNotes(): Note[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isNote);
  } catch {
    return [];
  }
}

/**
 * localStorage にメモを保存する。
 * 保存に失敗しても例外を投げない（quota 超過などへの耐性）。
 */
export function saveNotes(notes: Note[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // ストレージが使えない・容量超過時は静かに失敗する
  }
}

export const STORAGE_KEY_FOR_TESTING = STORAGE_KEY;
