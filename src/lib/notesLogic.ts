import type { Note } from "../types/note";

/** お気に入りを優先し、同グループ内では更新日時の新しい順に並べる。 */
export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export const HORIZONTAL_SPACES = /[\t\p{Zs}]+/gu;
export const LINE_BREAKS = /\r\n|[\r\n\u2028\u2029]/u;

function searchValue(text: string): string {
  return text.normalize("NFC").replace(HORIZONTAL_SPACES, " ").toLowerCase();
}

export function normalizeSearchQuery(query: string): string {
  return searchValue(query).trim();
}

export function findSearchMatch(text: string, needle: string) {
  if (!needle) return null;
  for (const line of text.split(LINE_BREAKS)) {
    const comparison = searchValue(line);
    const index = comparison.indexOf(needle);
    if (index !== -1) return { line, comparison, index };
  }
  return null;
}

export function matchesNote(note: Note, query: string): boolean {
  const needle = normalizeSearchQuery(query);
  return !needle || findSearchMatch(note.title, needle) !== null || findSearchMatch(note.body, needle) !== null;
}
