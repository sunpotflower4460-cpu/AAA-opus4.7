import { useMemo, useState } from "react";
import type { Note } from "../types/note";
import type { MonetizationState } from "../types/monetization";
import { copy } from "../lib/i18n";
import { NoteCard } from "./NoteCard";
import { SearchBar } from "./SearchBar";
import { EmptyState } from "./EmptyState";
import { ZanshinMark } from "./ZanshinMark";
import { AdSlot } from "./AdSlot";
import { PremiumCard } from "./PremiumCard";

type Props = {
  notes: Note[];
  monetization: MonetizationState;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onOpenPremium: () => void;
  onRestorePurchase: () => void | Promise<void>;
};

function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

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

export function NotesList({
  notes,
  monetization,
  onOpen,
  onCreate,
  onOpenPremium,
  onRestorePurchase,
}: Props) {
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    return sortNotes(notes.filter((note) => matches(note, query)));
  }, [notes, query]);

  const isEmpty = visible.length === 0;
  const isSearching = query.trim().length > 0;
  const showAdSlot = !isSearching && !isEmpty && visible.length > 1;
  const showPremiumCard =
    !isSearching && (notes.length > 1 || monetization.isPremium);

  return (
    <div className="flex flex-1 flex-col gap-gr-5 pt-gr-3 animate-washiFade">
      <header className="pt-gr-3">
        <div
          className="
            flex flex-col items-center gap-gr-3 rounded-[21px]
            border border-[color:var(--color-line)] bg-paper/75
            px-gr-5 py-gr-5 text-center shadow-paper-soft
          "
        >
          <ZanshinMark size={34} className="text-sumi/85" />
          <div className="flex flex-col gap-gr-2">
            <h1 className="font-mincho text-[26px] leading-none tracking-[0.2em] text-sumi">
              {copy.appName}
            </h1>
            <p className="text-[10px] tracking-[0.42em] text-ink-muted/85">
              {copy.appSubtitle.toUpperCase()}
            </p>
          </div>
          <div className="flex flex-col gap-gr-2">
            <p className="max-w-[24ch] font-mincho text-[17px] leading-snug text-sumi">
              {copy.tagline}
            </p>
            <p className="text-[11px] tracking-[0.18em] text-ink-muted/75">
              {copy.taglineEn}
            </p>
          </div>
          <span
            aria-hidden="true"
            className="block h-px w-gr-5 bg-gradient-to-r from-transparent via-gold/40 to-transparent"
          />
          <p className="max-w-[22ch] font-mincho text-[12px] leading-ample text-ink-muted whitespace-pre-line">
            {copy.zanshinDefinition}
          </p>
        </div>
      </header>

      <div className="pt-gr-1">
        <SearchBar value={query} onChange={setQuery} />
      </div>

      <section
        className="flex flex-1 flex-col gap-gr-3 pb-[max(env(safe-area-inset-bottom),89px)]"
        aria-label="メモ一覧"
      >
        {isEmpty ? (
          <EmptyState onCreate={onCreate} searching={isSearching} />
        ) : (
          <ul className="flex flex-col gap-gr-3">
            {visible.map((note, index) => (
              <li
                key={note.id}
                className="animate-fadeIn"
                style={{
                  animationDelay: `${Math.min(index, MAX_STAGGERED_ITEMS) * STAGGER_STEP_MS}ms`,
                }}
              >
                <NoteCard note={note} onOpen={onOpen} />
              </li>
            ))}
          </ul>
        )}

        {(showAdSlot || showPremiumCard) && (
          <div className="flex flex-col gap-gr-3 pt-gr-2">
            {showAdSlot && (
              <AdSlot
                monetization={monetization}
                currentScreen="notes-list"
                isSearching={isSearching}
                hasVisibleNotes={visible.length > 0}
                onOpenPremium={onOpenPremium}
              />
            )}
            {showPremiumCard && (
              <PremiumCard
                monetization={monetization}
                onOpenPremium={onOpenPremium}
                onRestorePurchase={onRestorePurchase}
              />
            )}
          </div>
        )}
      </section>

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
