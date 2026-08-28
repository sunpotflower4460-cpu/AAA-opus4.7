import type { Note } from "../types/note";

/** お気に入りを優先し、同グループ内では更新日時の新しい順に並べる。 */
export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

/**
 * 検索語は前後の空白を意味として扱わない。
 * 全角空白を含む ECMAScript WhiteSpace も trim() の対象になる。
 */
export function normalizeSearchQuery(query: string): string {
  return query.trim().toLocaleLowerCase();
}

/** タイトルまたは本文に検索語が含まれるか。空白だけの検索は未検索として扱う。 */
export function matchesNote(note: Note, query: string): boolean {
  const needle = normalizeSearchQuery(query);
  if (!needle) return true;

  return (
    note.title.toLocaleLowerCase().includes(needle) ||
    note.body.toLocaleLowerCase().includes(needle)
  );
}
