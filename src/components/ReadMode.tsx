import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Note } from "../types/note";
import { useI18n } from "../i18n/useI18n";
import { useEverydaySurface } from "../tsuzuri/everyday";
import { captureReadingPosition, restoreReadingPosition, type ReadingPosition } from "../lib/readingPosition";
import type { ReadingMode } from "../lib/uiPreferences";
import { hasVisibleText } from "../lib/noteDisplay";
import { ReadingText } from "./ReadingText";
import { BrushPicker } from "./BrushPicker";
import { ZanshinDateStamp } from "./ZanshinDateStamp";
import { tsuzuriMessages } from "../tsuzuri/messages";

type Props = {
  note: Note;
  /** 戻る操作の名前。行き先（一覧へ／検索結果へ）で呼ぶ。 */
  backLabel?: string;
  onBack: () => void;
  onEdit: (position: ReadingPosition | undefined) => void;
  onBind?: (trigger: HTMLButtonElement, noteId: string) => void;
  position?: ReadingPosition;
};

export function ReadMode({ note, backLabel, onBack, onEdit, position, onBind }: Props) {
  const { copy, locale, preferences, readingMode, readingWriteFailed } = useI18n();
  const everyday = useEverydaySurface(false);
  const hasTitle = hasVisibleText(note.title);
  const hasBody = note.body !== "";
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastPosition = useRef(position);
  const [hasMore, setHasMore] = useState(false);

  const measureMore = useCallback(() => {
    const el = scrollRef.current;
    if (!el || readingMode !== "vertical") return;
    const remaining = el.scrollWidth - el.clientWidth - Math.abs(el.scrollLeft);
    setHasMore(remaining > 4);
  }, [readingMode]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && lastPosition.current) {
      restoreReadingPosition(el, note.body, readingMode, lastPosition.current);
    }
    measureMore();
  }, [measureMore, note.id, note.title, note.body, readingMode]);

  useEffect(() => {
    window.addEventListener("resize", measureMore);
    const el = scrollRef.current;
    const observer = el && typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(measureMore)
      : null;
    if (el) observer?.observe(el);
    const body = el?.querySelector(".read-mode-body");
    if (body) observer?.observe(body);
    return () => {
      window.removeEventListener("resize", measureMore);
      observer?.disconnect();
    };
  }, [measureMore]);

  function recordPosition() {
    if (scrollRef.current) {
      lastPosition.current = captureReadingPosition(scrollRef.current, note.body, readingMode);
    }
    return lastPosition.current;
  }

  function chooseDirection(mode: ReadingMode) {
    recordPosition();
    preferences.selectReadingMode(mode);
  }

  const back = backLabel ?? copy.back;

  return (
    <div className="read-mode-shell mx-auto flex min-h-full w-full max-w-[560px] flex-1 flex-col pt-gr-3 animate-washiFade">
      <header className="zanshin-screen-bar flex items-center justify-between gap-gr-4">
        <button
          type="button"
          onClick={onBack}
          aria-label={back}
          className="
            zanshin-nav-button -ml-gr-2 flex items-center gap-gr-2 rounded-full
            px-gr-3 py-gr-2 text-[14px] text-ink-muted
            transition-soft hover:text-sumi hover:bg-paper/60
          "
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M15 6l-6 6 6 6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="font-mincho tracking-mincho">{back}</span>
        </button>

        <div className="flex items-center gap-gr-2">
        <BrushPicker variant="icon" />
        <button
          type="button"
          onClick={() => onEdit(recordPosition())}
          aria-label={copy.editNote}
          className="
            zanshin-secondary-button rounded-full border border-[color:var(--color-line)]
            bg-paper/62 px-gr-4 py-gr-2 font-mincho text-[13px]
            tracking-mincho text-ink-muted shadow-paper-soft transition-soft
            hover:bg-paper hover:text-sumi
          "
        >
          {copy.editNote}
        </button>
        </div>
      </header>

      <div className="read-mode-options">
        <div role="group" aria-label={copy.readingDirection} className="flex flex-wrap gap-gr-2">
          {(["vertical", "horizontal"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={readingMode === mode}
              onClick={() => chooseDirection(mode)}
              className="read-mode-option"
            >
              {copy[mode]}
            </button>
          ))}
        </div>
        {readingWriteFailed && <p role="status">{copy.preferenceWriteFailed}</p>}
        {onBind && <button type="button" className="ts-note-link" onClick={(event) => onBind(event.currentTarget, note.id)}>{tsuzuriMessages[locale].bindNote}</button>}
      </div>

      <main className="read-mode-stage flex min-h-0 flex-1 flex-col pt-gr-3 pb-gr-5">
        {readingMode === "vertical" && hasMore && (
          <p className="read-mode-more font-mincho" aria-hidden="true">
            {copy.readModeMore}
          </p>
        )}
        <article {...everyday} className="read-mode-paper editor-paper jp-text-discipline" aria-label={copy.readNote}>
          <div className="read-mode-date">
            <ZanshinDateStamp isoString={note.createdAt} />
          </div>

          <div
            ref={scrollRef}
            className="read-mode-scroll"
            data-reading-mode={readingMode}
            tabIndex={0}
            role="region"
            aria-label={copy.readNote}
            onScroll={() => {
              recordPosition();
              measureMore();
            }}
          >
            {(hasTitle || !hasBody) && (
              <h1 className="read-mode-title jp-text-discipline" dir="auto" lang={hasTitle ? "" : undefined}>
                {hasTitle ? <ReadingText text={note.title} /> : copy.untitled}
              </h1>
            )}
            {hasTitle && hasBody && <span className="read-mode-divider" aria-hidden="true" />}

            {hasBody ? (
              <pre className="read-mode-body jp-text-discipline" dir="auto" lang="">
                <ReadingText text={note.body} />
                {note.body.endsWith("\n") && <span className="read-final-line" aria-hidden="true" />}
              </pre>
            ) : (
              <p className="read-mode-body read-mode-empty-body jp-text-discipline">
                {copy.emptyReadBody}
              </p>
            )}
          </div>
        </article>
        <svg
          className="read-mode-seal"
          viewBox="0 0 34 34"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <filter id="zanshin-seal-rough" x="-10%" y="-10%" width="120%" height="120%">
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="n" />
              <feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" />
            </filter>
          </defs>
          <g filter="url(#zanshin-seal-rough)">
            <rect x="3" y="3" width="28" height="28" rx="2.5" fill="#b14a36" />
            <text
              lang="ja"
              x="17"
              y="25.5"
              textAnchor="middle"
              fontSize="21"
              fill="#f7f1e5"
              style={{ fontFamily: '"Yuji Boku", "Hiragino Mincho ProN", serif' }}
            >
              残
            </text>
          </g>
        </svg>
      </main>
    </div>
  );
}

export default ReadMode;
