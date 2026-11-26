import type { Note } from "../types/note";
import { copy } from "../lib/i18n";
import { lineWobble } from "../lib/inkJitter";
import { BrushPicker } from "./BrushPicker";
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
  const hasBody = note.body.trim().length > 0;

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

        <div className="flex items-center gap-gr-2">
        <BrushPicker variant="icon" />
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
        </div>
      </header>

      <main className="read-mode-stage flex min-h-0 flex-1 flex-col pt-gr-3 pb-gr-5">
        <p className="read-mode-hint mb-gr-3 self-end font-mincho text-[11px] tracking-[0.16em] text-ink-muted/80">
          {copy.readModeHint}
        </p>
        <article className="read-mode-paper editor-paper px-gr-5 py-gr-6 jp-text-discipline" aria-label={copy.readNote}>
          <div className="read-mode-date">
            <ZanshinDateStamp isoString={note.createdAt} />
          </div>

          <h1 className="read-mode-title jp-text-discipline">{title}</h1>
          <span className="read-mode-divider" aria-hidden="true" />

          {hasBody ? (
            // 空判定だけ trim() を使い、表示内容は原文の改行・先頭末尾の余白を保つ。
            <p className="read-mode-body jp-text-discipline">
              {note.body.split("\n").map((line, index) => {
                const w = lineWobble(note.id, index);
                return (
                  // 行ごとに、手で書いたようなごく小さなズレを与える（見た目だけ。内容は変えない）。
                  <span
                    key={index}
                    className="read-line"
                    style={
                      {
                        "--jx": `${w.x}px`,
                        "--jy": `${w.y}px`,
                        "--jr": `${w.rotate}deg`,
                        "--jo": w.opacity,
                      } as React.CSSProperties
                    }
                  >
                    {line === "" ? "\u200b" : line}
                  </span>
                );
              })}
            </p>
          ) : (
            <p className="read-mode-body read-mode-empty-body jp-text-discipline">
              {copy.emptyReadBody}
            </p>
          )}
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
