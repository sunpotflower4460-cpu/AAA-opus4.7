import type { Note } from "../types/note";
import { copy } from "../lib/i18n";
import { ZanshinDateStamp } from "./ZanshinDateStamp";

type Props = {
  note: Note;
  onBack: () => void;
  onEdit: () => void;
};

/**
 * 読み返し専用モード。
 * 編集は横書きの実用、読み返しは縦書きの余韻として分ける。
 */
export function ReadMode({ note, onBack, onEdit }: Props) {
  const title = note.title.trim() || copy.untitled;
  const body = note.body.trim();

  return (
    <div className="read-mode-shell mx-auto flex min-h-full w-full max-w-[560px] flex-1 flex-col pt-gr-3 animate-washiFade">
      <header className="zanshin-screen-bar flex items-center justify-between gap-gr-4">
        <button
          type="button"
          onClick={onBack}
          aria-label={copy.back}
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
          <span className="font-mincho tracking-mincho">{copy.back}</span>
        </button>

        <button
          type="button"
          onClick={onEdit}
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
      </header>

      <main className="read-mode-stage flex min-h-0 flex-1 flex-col pt-gr-3 pb-gr-5">
        <p className="read-mode-hint mb-gr-3 self-end font-mincho text-[11px] tracking-[0.16em] text-ink-muted/54">
          {copy.readModeHint}
        </p>
        <article className="read-mode-paper editor-paper px-gr-5 py-gr-6 jp-text-discipline" aria-label={copy.readNote}>
          <div className="read-mode-date">
            <ZanshinDateStamp isoString={note.createdAt} />
          </div>

          <h1 className="read-mode-title jp-text-discipline">{title}</h1>
          <span className="read-mode-divider" aria-hidden="true" />

          {body ? (
            <p className="read-mode-body jp-text-discipline">{body}</p>
          ) : (
            <p className="read-mode-body read-mode-empty-body jp-text-discipline">
              {copy.emptyReadBody}
            </p>
          )}
        </article>
      </main>
    </div>
  );
}

export default ReadMode;
