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
        rounded-[13px] bg-paper
        px-gr-4 py-gr-4
        shadow-paper border border-[color:var(--color-line)]
        transition-soft hover:bg-paper/95 active:scale-[0.997]
      "
    >
      {/* 刀のような細い縦線 */}
      <span
        aria-hidden="true"
        className={[
          "absolute left-0 top-gr-3 bottom-gr-3 w-px",
          note.isFavorite ? "bg-gold/80" : "bg-sumi/15",
        ].join(" ")}
      />

      <div className="flex items-start gap-gr-3">
        <div className="min-w-0 flex-1">
          <h3
            className={[
              "font-mincho text-[17px] leading-snug",
              note.title.trim() ? "text-sumi" : "text-ink-muted",
            ].join(" ")}
          >
            {title}
          </h3>

          {bodyPreview && (
            <p className="mt-gr-2 line-clamp-2 text-[14px] text-ink-muted">
              {bodyPreview}
            </p>
          )}

          <p className="mt-gr-3 text-[12px] tracking-wide text-ink-muted/80">
            {formatUpdatedAt(note.updatedAt)}
          </p>
        </div>

        {note.isFavorite && (
          <span
            aria-label={copy.favorites}
            title={copy.favorites}
            className="mt-1 shrink-0 text-gold"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="5" />
            </svg>
          </span>
        )}
      </div>
    </button>
  );
}

export default NoteCard;
