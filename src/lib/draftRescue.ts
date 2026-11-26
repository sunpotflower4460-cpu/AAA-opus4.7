import type { Note } from "../types/note";

/**
 * 描画例外で App が破棄されても、最後に受け取った「保存先へ確認できていない内容」へ
 * 届くための保管場所（R33）。
 *
 * - React の外（モジュール）に置くので、AppErrorBoundary が App を破棄しても残る。
 * - 保存先の正本や復元候補の箱とは別物。ここから保存層へ書き戻すことは決してしない。
 *   取り出す（読む・コピーする）ためだけに使う。
 * - 永続化しない。再読み込みで消えるので、画面は取り出しを先に案内する。
 */
export type DraftRescueSnapshot = {
  /** 画面が最後に受け取ったメモ全体 */
  notes: readonly Note[];
  /** 保存先で確認できている版（保存成功／読込で確定した版） */
  savedNotes: readonly Note[];
};

let current: DraftRescueSnapshot | null = null;

export function recordDraftRescue(notes: readonly Note[], savedNotes: readonly Note[]): void {
  current = { notes, savedNotes };
}

export function getDraftRescue(): DraftRescueSnapshot | null {
  return current;
}

export function clearDraftRescueForTesting(): void {
  current = null;
}

/** 保存先で確認できている版と内容が異なる、または保存先にまだ無いメモ。原文のまま返す。 */
export function getUnsavedNotes(snapshot: DraftRescueSnapshot | null): Note[] {
  if (!snapshot) return [];
  const saved = new Map(snapshot.savedNotes.map((note) => [note.id, JSON.stringify(note)]));
  return snapshot.notes.filter((note) => saved.get(note.id) !== JSON.stringify(note));
}
