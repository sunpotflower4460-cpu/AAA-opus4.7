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
  notes: readonly Note[];
  /** null は本体の保存状況を確認できていない状態。 */
  savedNotes: readonly Note[] | null;
  /** 現在表示していない候補への入力も含む。 */
  edits: readonly Note[];
};

let current: DraftRescueSnapshot | null = null;

export function recordDraftRescue(snapshot: DraftRescueSnapshot): void {
  current = snapshot;
}

export function getDraftRescue(): DraftRescueSnapshot | null {
  return current;
}

export function clearDraftRescueForTesting(): void {
  current = null;
}

type RescueEntry = { note: Note; kind: "edited" | "unconfirmed" };

/** 同じIDに別の入力があれば、取り出せる原文を両方残す。 */
export function getRescueNotes(snapshot: DraftRescueSnapshot | null): RescueEntry[] {
  if (!snapshot) return [];

  const saved = new Map(snapshot.savedNotes?.map((note) => [note.id, JSON.stringify(note)]));
  const entries = new Map<string, RescueEntry>();
  function addNotes(notes: readonly Note[], kind: RescueEntry["kind"]) {
    for (const note of notes) {
      if (!note.title && !note.body) continue;
      if (saved.get(note.id) === JSON.stringify(note)) continue;
      const original = JSON.stringify([note.id, note.title, note.body]);
      if (!entries.has(original)) entries.set(original, { note, kind });
    }
  }
  addNotes(snapshot.edits, "edited");
  addNotes(snapshot.notes, snapshot.savedNotes === null ? "unconfirmed" : "edited");
  return [...entries.values()];
}
