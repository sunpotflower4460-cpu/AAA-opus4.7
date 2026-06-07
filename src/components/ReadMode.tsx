import type { Note } from "../types/note";
import { copy } from "../lib/i18n";
import { ZanshinDateStamp } from "./ZanshinDateStamp";

type Props = {
  note: Note;
  onBack: () => void;
};

/**
 * 読み返し専用モード。
 * 編集は横書きの実用、読み返しは縦書きの余韻として分ける。
 */
export function ReadMode({ note, onBack }: Props) {
  const title = note.title.trim() || copy.untitled;
  const body = note.body.trim();

  return (
    <div className="read-mode-shell mx-auto flex min-h-full w-full max-w-[560px] flex-1 flex-col pt-gr-3 animate-washiFade">
      <header className="flex items-center justify-between gap-gr-4">
        <button
          type="button"
          onClick={onBack}
          aria-label={copy.exitReadMode}
          className="
            -ml-gr-2 flex items-center gap-gr-2 rounded-full
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
          <span className="font-mincho tracking-mincho">{copy.exitReadMode}</span>
        </button>
      </header>

      <main className="read-mode-stage flex min-h-0 flex-1 flex-col pt-gr-4 pb-gr-5">
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
