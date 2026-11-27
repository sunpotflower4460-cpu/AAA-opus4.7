import { useEffect, useMemo, useRef } from "react";
import type { Note } from "../types/note";
import type { MonetizationState } from "../types/monetization";
import { messages } from "../lib/i18n";
import { useI18n } from "../i18n/useI18n";
import { makeNoteDateFormatter } from "../lib/zanshinDate";
import { matchesNote, normalizeSearchQuery, sortNotes } from "../lib/notesLogic";
import { ADS_ENABLED, PREMIUM_ENABLED } from "../lib/featureFlags";
import { BrushPicker } from "./BrushPicker";
import { NoteCard } from "./NoteCard";
import { SearchBar } from "./SearchBar";
import { EmptyState } from "./EmptyState";
import { ZanshinMark } from "./ZanshinMark";
import { AdSlot } from "./AdSlot";
import { PremiumCard } from "./PremiumCard";
import { ZanshinPaperSlip } from "./ZanshinPaperSlip";
import { tsuzuriMessages } from "../tsuzuri/messages";

type Props = {
  notes: Note[];
  monetization: MonetizationState;
  query: string;
  onQueryChange: (query: string) => void;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onOpenPremium: () => void;
  /** 「このアプリについて」を開く */
  onOpenAbout?: (trigger: HTMLButtonElement) => void;
  onOpenBooks?: (trigger: HTMLButtonElement) => void;
  onRestorePurchase: () => void | Promise<void>;
};

const MAX_STAGGERED_ITEMS = 6;
const STAGGER_STEP_MS = 40;
const RESULT_ANNOUNCE_DELAY_MS = 600;

export function NotesList({
  notes,
  monetization,
  query,
  onQueryChange,
  onOpen,
  onCreate,
  onOpenPremium,
  onRestorePurchase,
  onOpenAbout,
  onOpenBooks,
}: Props) {
  const { copy, locale, preferences } = useI18n();
  const formatCreationDate = makeNoteDateFormatter({ formatLocale: locale });
  const visible = useMemo(() => {
    return sortNotes(notes.filter((note) => matchesNote(note, query)));
  }, [notes, query]);

  const isEmpty = visible.length === 0;
  const isSearching = normalizeSearchQuery(query).length > 0;
  // 通常状態（メモが1件以上、検索していない）では、導入の短冊を毎回先頭に置かず、メモへ早く届く（D01）。
  const showIntro = notes.length === 0;

  // 検索結果の件数は、入力が一段落してからまとめて読み上げる（IME 途中や一文字ごとに割り込まない）。
  const noteCount = visible.length;
  const liveResult = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const region = liveResult.current;
    if (!region || !isSearching) return;
    const timer = window.setTimeout(() => {
      region.lang = preferences.getSnapshot().locale;
      const current = messages[preferences.getSnapshot().locale];
      region.textContent = current.searchResultCountLabel({ noteCount });
    }, RESULT_ANNOUNCE_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
      region.textContent = "";
    };
  }, [isSearching, query, noteCount, preferences]);

  const showAdSlot = ADS_ENABLED && !isSearching && !isEmpty && visible.length > 1;
  const showPremiumCard =
    PREMIUM_ENABLED && !isSearching && (visible.length > 1 || monetization.isPremium);

  return (
    <div className="zanshin-home flex flex-1 flex-col gap-gr-5 pt-gr-3 animate-washiFade">
      <header className="zanshin-home-header relative pt-gr-3">
        {onOpenAbout && (
          <button
            type="button"
            onClick={(event) => onOpenAbout(event.currentTarget)}
            className="zanshin-about-entry flex min-h-[44px] flex-wrap items-center justify-end gap-gr-2 rounded-full px-gr-3 font-mincho text-[12px] tracking-[0.08em] text-ink-muted transition-soft hover:text-sumi"
          >
            <span>{copy.aboutOpen}</span>
            {locale === "ja" && <span lang="en">Language</span>}
          </button>
        )}
        <div className="mx-auto flex w-full max-w-[390px] flex-col items-center gap-gr-3 text-center">
          <div className="zanshin-app-title-block flex flex-col items-center gap-gr-2">
            <ZanshinMark size={32} className="text-sumi/82" />
            <h1 className="font-mincho text-[26px] leading-none tracking-[0.2em] text-sumi">
              {copy.appName}
            </h1>
            {locale === "ja" && (
              <p lang="en" className="english-subcopy text-[9px] tracking-[0.24em] opacity-80">Zanshin</p>
            )}
          </div>
          {showIntro && <ZanshinPaperSlip lines={copy.taglineLines} />}
        </div>
      </header>

      <div className="mx-auto w-full max-w-[430px] pt-gr-2">
        <SearchBar value={query} onChange={onQueryChange} />
        <span className="sr-only" role="status" ref={liveResult} />
        <div className="zanshin-list-status mt-gr-3 flex flex-wrap items-center justify-between gap-gr-3 px-gr-1">
          <p className="font-mincho text-[12px] tracking-[0.12em] text-ink-muted/72 jp-text-discipline">
            {isSearching ? copy.searchResultCountLabel({ noteCount }) : copy.notesCountLabel({ noteCount })}
          </p>
          <div className="flex min-w-0 flex-wrap items-center gap-gr-2">
            {onOpenBooks && <button type="button" className="ts-note-link" onClick={(event) => onOpenBooks(event.currentTarget)}>{tsuzuriMessages[locale].shelf}</button>}
            <BrushPicker variant="list" className="-my-gr-2" />
            <p className="text-[10px] tracking-[0.14em] text-ink-muted/80">
              {copy.localOnly}
            </p>
          </div>
        </div>
      </div>

      <section
        className="mx-auto flex w-full max-w-[430px] flex-1 flex-col gap-gr-3 pb-[max(env(safe-area-inset-bottom),89px)]"
        aria-label={copy.notesList}
      >
        {isEmpty ? (
          <EmptyState searching={isSearching} />
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
                <NoteCard note={note} onOpen={onOpen} query={query} formatCreationDate={formatCreationDate} />
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
          zanshin-compose-button
          fixed bottom-[max(env(safe-area-inset-bottom),21px)] right-gr-4
          z-10 flex h-[55px] min-w-[55px] items-center justify-center gap-gr-2
          rounded-full text-washi
          transition-soft
          hover:-translate-y-[1px]
          active:translate-y-0 active:scale-95
        "
        style={{
          backgroundColor: "rgba(31, 27, 24, 0.92)",
          boxShadow: "0 13px 34px rgba(31, 27, 24, 0.18)",
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M12 5v14M5 12h14"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
        <span className="zanshin-compose-label font-mincho text-[13px] tracking-mincho">
          {copy.newNote}
        </span>
      </button>
    </div>
  );
}

export default NotesList;
