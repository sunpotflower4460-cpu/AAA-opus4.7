import type { Note } from "../types/note";
import { copy } from "../lib/i18n";
import { cardImperfection } from "../lib/inkJitter";
import { getCardDisplay } from "../lib/noteDisplay";
import { getZanshinStamp } from "../lib/zanshinDate";
import { ZanshinDateStamp } from "./ZanshinDateStamp";

type Props = {
  note: Note;
  onOpen: (id: string) => void;
  /** 検索中の語。一致した理由を抜粋で示すために使う（保存内容は変えない） */
  query?: string;
};

/** 「2026.11.26」→「2026年11月26日」。読み上げで意味が伝わる形にする。 */
function spokenDate(createdAt: string): string | null {
  const { date } = getZanshinStamp(createdAt);
  const match = /^(\d{4})\.(\d{2})\.(\d{2})$/.exec(date ?? "");
  if (!match) return null;
  return `${Number(match[1])}年${Number(match[2])}月${Number(match[3])}日`;
}

export function NoteCard({ note, onOpen, query = "" }: Props) {
  const { heading, excerpt } = getCardDisplay(note, query);
  const imperfection = cardImperfection(note.id);
  const dateLabel = spokenDate(note.createdAt);
  // カードの名前: 識別できる見出し + 作成日 + 固定状態。全カードを同じ名前にしない。
  const accessibleName = [
    heading,
    dateLabel ? `作成日 ${dateLabel}` : null,
    note.isFavorite ? "先頭に固定" : null,
  ]
    .filter(Boolean)
    .join("、");

  return (
    <button
      type="button"
      data-note-id={note.id}
      onClick={() => onOpen(note.id)}
      aria-label={accessibleName}
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
            <ZanshinDateStamp isoString={note.createdAt} compact />
          </div>

          <h3
            className={[
              "zanshin-note-card__title line-clamp-2 font-mincho text-[17px] leading-snug tracking-mincho jp-text-discipline",
              heading === copy.untitled && note.title.trim() === "" ? "text-ink-muted" : "text-sumi",
            ].join(" ")}
          >
            {heading}
          </h3>

          {excerpt !== "" && (
            <div className="mt-gr-2">
              <p className="zanshin-note-card__preview line-clamp-2 text-[14px] leading-ample text-ink-muted jp-text-discipline">
                {excerpt}
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
