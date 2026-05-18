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

// 入場アニメの段差を最大いくつまでつけるか。
// それ以上は全カードを同時に出現させる（画面下で長く待たされるのを避けるため）。
const MAX_STAGGERED_ITEMS = 6;
const STAGGER_STEP_MS = 40;

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
    <div className="flex flex-1 flex-col gap-gr-5 pt-gr-4 animate-washiFade">
      {/* ヘッダー */}
      <header className="flex flex-col items-center gap-gr-2 pt-gr-4 text-center">
        <ZanshinMark size={34} className="text-sumi/85" />
        <h1 className="font-mincho text-[30px] leading-none tracking-[0.22em] text-sumi">
          {copy.appName}
        </h1>
        <p className="text-[10px] tracking-[0.42em] text-ink-muted/85">
          {copy.appSubtitle.toUpperCase()}
        </p>
        <p className="mt-gr-3 max-w-[34ch] font-mincho text-[13px] leading-ample text-ink-muted">
          {copy.tagline}
        </p>
        {/* ごく細い金の区切り — 一筋の余韻 */}
        <span
          aria-hidden="true"
          className="mt-gr-3 block h-px w-gr-5 bg-gradient-to-r from-transparent via-gold/40 to-transparent"
        />
      </header>

      {/* 検索 */}
      <div className="pt-gr-1">
        <SearchBar value={query} onChange={setQuery} />
      </div>

      {/* 一覧 */}
      <section
        className="flex flex-1 flex-col gap-gr-3 pb-[max(env(safe-area-inset-bottom),89px)]"
        aria-label="メモ一覧"
      >
        {isEmpty ? (
          <EmptyState onCreate={onCreate} searching={isSearching} />
        ) : (
          <ul className="flex flex-col gap-gr-3">
            {visible.map((note, i) => (
              <li
                key={note.id}
                className="animate-fadeIn"
                style={{
                  animationDelay: `${Math.min(i, MAX_STAGGERED_ITEMS) * STAGGER_STEP_MS}ms`,
                }}
              >
                <NoteCard note={note} onOpen={onOpen} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* FAB — 新規作成（扇がひらくような印象） */}
      <button
        type="button"
        onClick={onCreate}
        aria-label={copy.newNote}
        title={copy.newNote}
        className="
          fixed bottom-[max(env(safe-area-inset-bottom),21px)] right-gr-4
          z-10 flex h-[55px] w-[55px] items-center justify-center
          rounded-full bg-sumi text-washi
          shadow-paper-hover transition-soft
          hover:bg-indigo hover:-translate-y-[1px]
          active:translate-y-0 active:scale-95
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
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

export default NotesList;
