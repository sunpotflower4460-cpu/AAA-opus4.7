import { useMemo, useState } from "react";
import type { Note } from "../types/note";
import { copy } from "../lib/i18n";
import { NoteCard } from "./NoteCard";
import { SearchBar } from "./SearchBar";
import { EmptyState } from "./EmptyState";
import { ZanshinMark } from "./ZanshinMark";

type Props = {
  notes: Note[];
  onOpen: (id: string) => void;
  onCreate: () => void;
};

function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

function matches(note: Note, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    note.title.toLowerCase().includes(needle) ||
    note.body.toLowerCase().includes(needle)
  );
}

export function NotesList({ notes, onOpen, onCreate }: Props) {
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    return sortNotes(notes.filter((n) => matches(n, query)));
  }, [notes, query]);

  const isEmpty = visible.length === 0;
  const isSearching = query.trim().length > 0;

  return (
    <div className="flex flex-1 flex-col gap-gr-5 pt-gr-4">
      {/* ヘッダー */}
      <header className="flex flex-col items-center gap-gr-2 pt-gr-3 text-center">
        <ZanshinMark size={34} className="text-sumi/85" />
        <h1 className="font-mincho text-[28px] leading-none tracking-[0.18em] text-sumi">
          {copy.appName}
        </h1>
        <p className="text-[11px] tracking-[0.32em] text-ink-muted">
          {copy.appSubtitle.toUpperCase()}
        </p>
        <p className="mt-gr-2 max-w-[34ch] font-mincho text-[13px] leading-golden text-ink-muted">
          {copy.tagline}
        </p>
      </header>

      {/* 検索 */}
      <div className="pt-gr-2">
        <SearchBar value={query} onChange={setQuery} />
      </div>

      {/* 一覧 */}
      <section
        className="flex flex-1 flex-col gap-gr-3 pb-gr-7"
        aria-label="メモ一覧"
      >
        {isEmpty ? (
          <EmptyState onCreate={onCreate} searching={isSearching} />
        ) : (
          <ul className="flex flex-col gap-gr-3">
            {visible.map((note) => (
              <li key={note.id} className="animate-fadeIn">
                <NoteCard note={note} onOpen={onOpen} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* FAB - 新規作成（扇がひらくような印象） */}
      <button
        type="button"
        onClick={onCreate}
        aria-label={copy.newNote}
        title={copy.newNote}
        className="
          fixed bottom-[max(env(safe-area-inset-bottom),21px)] right-gr-4
          z-10 flex h-[55px] w-[55px] items-center justify-center
          rounded-full bg-sumi text-washi
          shadow-paper transition-soft
          hover:bg-indigo active:scale-95
        "
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M12 5v14M5 12h14"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

export default NotesList;
