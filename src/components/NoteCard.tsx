import type { Note } from "../types/note";
import { formatUpdatedAt } from "../lib/date";
import { copy } from "../lib/i18n";

type Props = {
  note: Note;
  onOpen: (id: string) => void;
};

function preview(body: string): string {
  // 改行を一行に畳んで、冒頭を返す
  const flat = body.replace(/\s+/g, " ").trim();
  if (!flat) return "";
  return flat.length > 80 ? `${flat.slice(0, 80)}…` : flat;
}

export function NoteCard({ note, onOpen }: Props) {
  const title = note.title.trim() || copy.untitled;
  const bodyPreview = preview(note.body);

  return (
    <button
      type="button"
      onClick={() => onOpen(note.id)}
      aria-label={`${title} — ${formatUpdatedAt(note.updatedAt)}`}
      className="
        group relative block w-full text-left
        rounded-[13px] bg-paper/90
        pl-gr-5 pr-gr-4 py-gr-4
        shadow-paper-soft border border-[color:var(--color-line)]
        transition-soft
        hover:bg-paper hover:shadow-paper-hover hover:-translate-y-[1px]
        active:translate-y-0 active:scale-[0.997]
      "
    >
      {/* 刀の刃のような細い縦線 — お気に入りは金、それ以外は墨の余韻 */}
      <span
        aria-hidden="true"
        className={[
          "absolute left-gr-3 top-gr-3 bottom-gr-3 rounded-full",
          note.isFavorite ? "w-[2px] bg-gold/85" : "w-px bg-sumi/15",
        ].join(" ")}
      />

      <div className="flex items-start gap-gr-3">
        <div className="min-w-0 flex-1">
          <h3
            className={[
              "font-mincho text-[17px] leading-snug tracking-mincho",
              note.title.trim() ? "text-sumi" : "text-ink-muted",
            ].join(" ")}
          >
            {title}
          </h3>

          {bodyPreview && (
            <p className="mt-gr-2 line-clamp-2 text-[14px] leading-golden text-ink-muted">
              {bodyPreview}
            </p>
          )}

          <p className="mt-gr-3 text-[11px] uppercase tracking-[0.18em] text-ink-muted/70">
            {formatUpdatedAt(note.updatedAt)}
          </p>
        </div>

        {note.isFavorite && (
          <span
            aria-label={copy.favorites}
            title={copy.favorites}
            className="mt-[6px] shrink-0 text-gold"
          >
            {/* 金の小さな印 — 装飾ではなく、しるし */}
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="6" />
            </svg>
          </span>
        )}
      </div>
    </button>
  );
}

export default NoteCard;
