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
  return flat.length > 88 ? `${flat.slice(0, 88)}…` : flat;
}

export function NoteCard({ note, onOpen }: Props) {
  const title = note.title.trim() || copy.untitled;
  const bodyPreview = preview(note.body);

  return (
    <button
      type="button"
      onClick={() => onOpen(note.id)}
      aria-label={`${title}`}
      className="
        group relative block w-full text-left
        rounded-[13px] paper-card
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
          "absolute left-gr-3 top-gr-3 bottom-gr-3 rounded-full",
          note.isFavorite ? "w-[2px] bg-gold/85" : "w-px bg-sumi/12",
        ].join(" ")}
      />

      <div className="flex items-start gap-gr-3">
        <div className="min-w-0 flex-1">
          {/* Phase 13: 日付印を上部に配置 */}
          <div className="mb-gr-3">
            <ZanshinDateStamp isoString={note.createdAt} compact />
          </div>

          <h3
            className={[
              "font-mincho text-[17px] leading-snug tracking-mincho",
              note.title.trim() ? "text-sumi" : "text-ink-muted",
            ].join(" ")}
          >
            {title}
          </h3>

          {bodyPreview && (
            <div className="mt-gr-3 flex flex-col gap-gr-2">
              <span className="text-[10px] tracking-[0.12em] text-ink-muted/55">
                {copy.lastRemains}
              </span>
              <p className="line-clamp-2 text-[14px] leading-ample text-ink-muted">
                {bodyPreview}
              </p>
            </div>
          )}
        </div>

        {note.isFavorite && (
          <span
            aria-label={copy.favoriteBadge}
            title={copy.favoriteBadge}
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
