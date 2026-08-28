import type { Note } from "../types/note";
import { copy } from "../lib/i18n";
import { ZanshinDateStamp } from "./ZanshinDateStamp";

type Props = {
  note: Note;
  onOpen: (id: string) => void;
};

function preview(body: string): string {
  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const lastLine = lines.length > 0 ? lines[lines.length - 1] : "";
  const flat = lastLine.replace(/\s+/g, " ").trim();
  if (!flat) return "";
  return flat.length > 72 ? `${flat.slice(0, 72)}…` : flat;
}

export function NoteCard({ note, onOpen }: Props) {
  const title = note.title.trim() || copy.untitled;
  const bodyPreview = preview(note.body);

  return (
    <button
      type="button"
      onClick={() => onOpen(note.id)}
      aria-label={`${title}、${copy.openReadMode}`}
      className="
        group relative block w-full text-left
        rounded-[13px] paper-card zanshin-note-card
        pl-gr-5 pr-gr-5 py-gr-5
        transition-soft
        hover:-translate-y-[1px]
        active:translate-y-0 active:scale-[0.997]
      "
    >
      {/* 刀の刃のような細い縦線 — お気に入りは金、それ以外は薄墨の余韻 */}
      <span
        aria-hidden="true"
        className={[
          "zanshin-note-card__spine absolute left-gr-3 top-gr-3 bottom-gr-3 rounded-full",
          note.isFavorite ? "w-[2px] bg-gold/72" : "w-px bg-sumi/10",
        ].join(" ")}
      />

      <div className="flex items-start gap-gr-3">
        <div className="min-w-0 flex-1">
          <div className="mb-gr-3">
            <ZanshinDateStamp isoString={note.createdAt} compact />
          </div>

          <h3
            className={[
              "font-mincho text-[17px] leading-snug tracking-mincho jp-text-discipline",
              note.title.trim() ? "text-sumi" : "text-ink-muted",
            ].join(" ")}
          >
            {title}
          </h3>

          {bodyPreview && (
            <div className="mt-gr-2">
              <p className="line-clamp-2 text-[14px] leading-ample text-ink-muted/92 jp-text-discipline">
                {bodyPreview}
              </p>
            </div>
          )}

          <div className="mt-gr-4 flex items-center gap-gr-2 text-[11px] tracking-[0.12em] text-ink-muted/54">
            <span className="h-px w-gr-4 bg-gradient-to-r from-gold/28 to-transparent" aria-hidden="true" />
            <span className="font-mincho">{copy.openReadMode}</span>
          </div>
        </div>

        {note.isFavorite && (
          <span
            aria-label={copy.favoriteBadge}
            title={copy.favoriteBadge}
            className="mt-[6px] shrink-0 text-gold/82"
          >
            <svg
              width="9"
              height="9"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="6" />
            </svg>
          </span>
        )}
      </div>

      <span className="zanshin-note-card__corner" aria-hidden="true" />
    </button>
  );
}

export default NoteCard;
