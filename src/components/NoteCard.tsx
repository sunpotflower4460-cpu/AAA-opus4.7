import { useId } from "react";
import type { Note } from "../types/note";
import { useI18n } from "../i18n/useI18n";
import { cardImperfection } from "../lib/inkJitter";
import { getCardDisplay } from "../lib/noteDisplay";
import { ZanshinDateStamp } from "./ZanshinDateStamp";

type Props = {
  note: Note;
  onOpen: (id: string) => void;
  /** 検索中の語。一致した理由を抜粋で示すために使う（保存内容は変えない） */
  query?: string;
  formatCreationDate: (iso: string) => string | null;
};

export function NoteCard({ note, onOpen, query = "", formatCreationDate }: Props) {
  const { copy } = useI18n();
  const { heading, headingSource, excerpt } = getCardDisplay(note, query);
  const imperfection = cardImperfection(note.id);
  const nameId = useId();
  const dateId = useId();
  const pinId = useId();
  const dateLabel = formatCreationDate(note.createdAt);
  const nameReferences = [nameId, dateLabel ? dateId : null, note.isFavorite ? pinId : null]
    .filter(Boolean).join(" ");

  return (
    <button
      type="button"
      data-note-id={note.id}
      onClick={() => onOpen(note.id)}
      aria-labelledby={nameReferences}
      style={
        {
          "--card-tilt": `${imperfection.tiltDeg}deg`,
          "--card-radius": imperfection.radius,
        } as React.CSSProperties
      }
      className="
        group relative block w-full text-left
        rounded-[13px] paper-card zanshin-note-card
        pl-gr-5 pr-gr-5 py-gr-5
        transition-soft
        hover:-translate-y-[1px]
        active:translate-y-0 active:scale-[0.997]
      "
    >
      <div className="flex items-start gap-gr-3">
        {/*
         * Phase 28 はカード直下要素を position: relative !important にするため、
         * 紙の背骨はこの相対コンテナ内へ置く。見た目だけでなく上書き競合も避ける。
         */}
        <span
          aria-hidden="true"
          className={[
            "zanshin-note-card__spine absolute left-[-21px] top-gr-3 bottom-gr-3 rounded-full",
            note.isFavorite ? "w-[2px] bg-gold/72" : "w-px bg-sumi/10",
          ].join(" ")}
        />

        <div className="min-w-0 flex-1">
          <div className="mb-gr-3">
            <ZanshinDateStamp isoString={note.createdAt} compact decorative />
          </div>

          {dateLabel && <span className="sr-only" id={dateId}>{copy.creationDate({ displayDate: dateLabel })}</span>}
          {note.isFavorite && <span className="sr-only" id={pinId}>{copy.pinned}</span>}
          <h3
            id={nameId}
            dir={headingSource === "untitled" ? undefined : "auto"}
            lang={headingSource === "untitled" ? undefined : ""}
            className={[
              "zanshin-note-card__title line-clamp-2 font-mincho text-[17px] leading-snug tracking-mincho jp-text-discipline",
              headingSource === "untitled" ? "text-ink-muted" : "text-sumi",
            ].join(" ")}
          >
            {heading ?? copy.untitled}
          </h3>

          {excerpt && (
            <div className="mt-gr-2">
              <p dir="auto" lang="" className="zanshin-note-card__preview line-clamp-2 text-[14px] leading-ample text-ink-muted jp-text-discipline">
                {excerpt.directionSource && <span hidden>{excerpt.directionSource}</span>}
                {excerpt.text}
              </p>
            </div>
          )}
        </div>

        {note.isFavorite && (
          <span aria-hidden="true" className="mt-[6px] shrink-0 text-gold/82">
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
