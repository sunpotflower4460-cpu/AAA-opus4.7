import { useEffect, useRef, useState } from "react";
import type { Note } from "../types/note";
import { copy } from "../lib/i18n";
import { CopyTextButton } from "./CopyTextButton";

export type ReviewCandidate = {
  id: string;
  label: string;
  notes: readonly Note[];
  /** 保護している候補だけが持つ。整理は利用者の明示操作でのみ行う。 */
  protectedSlot?: { slot: string; raw: string };
};

type Props = {
  candidates: readonly ReviewCandidate[];
  /** 満杯の理由を示し、整理の操作を出す */
  archiveFull: boolean;
  onDiscard: (candidate: ReviewCandidate) => "discarded" | "changed" | "failed";
  onClose: () => void;
};

function formatDateTime(iso: string | null): string {
  if (!iso) return copy.recoveryReviewNoDate;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return copy.recoveryReviewNoDate;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 本人の題名、無ければ本文の最初の非空行。表示用で、保存する値ではない。 */
function identifyingHeading(note: Note): string {
  if (note.title !== "") return note.title;
  const firstLine = note.body.split("\n").find((line) => line.trim() !== "");
  return firstLine ?? copy.untitled;
}

function latestChange(notes: readonly Note[]): string | null {
  let latest: string | null = null;
  let latestTime = -Infinity;
  for (const note of notes) {
    const time = new Date(note.updatedAt).getTime();
    if (!Number.isNaN(time) && time > latestTime) {
      latestTime = time;
      latest = note.updatedAt;
    }
  }
  return latest;
}

/**
 * 保存内容の比較専用画面。
 * 候補ごとに、件数（0件も明示）・変更日・各メモの全文を読め、原文のままコピーできる。
 * 閲覧だけでは保存内容を変えない。「どれが正しいか」は日時から推測せず、並べて見せるだけ。
 */
export function RecoveryReview({ candidates, archiveFull, onDiscard, onClose }: Props) {
  const [selectedId, setSelectedId] = useState(candidates[0]?.id ?? "");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // 候補が整理されて消えたら、選択を残っている候補へ移す。
  const selected = candidates.find((candidate) => candidate.id === selectedId) ?? candidates[0];

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  function discard(candidate: ReviewCandidate) {
    const result = onDiscard(candidate);
    setConfirmingId(null);
    setNotice(
      result === "discarded"
        ? copy.recoveryDiscardDone
        : result === "changed"
          ? copy.recoveryDiscardChanged
          : copy.recoveryDiscardFailed,
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="zanshin-review-title"
      className="fixed inset-0 z-40 overflow-y-auto bg-paper"
      onKeyDown={handleKeyDown}
    >
      <div className="mx-auto flex min-h-full w-full max-w-[560px] flex-col px-gr-4 py-gr-4">
        <header className="flex items-center justify-between gap-gr-3">
          <h2 id="zanshin-review-title" className="font-mincho text-[18px] tracking-mincho text-sumi">
            {copy.recoveryReviewTitle}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="min-h-[44px] whitespace-nowrap rounded-full px-gr-4 py-gr-2 font-mincho text-[14px] text-sumi transition-soft hover:bg-washi"
          >
            {copy.recoveryReviewClose}
          </button>
        </header>

        <p className="mt-gr-3 text-[14px] leading-ample text-ink-muted">{copy.recoveryReviewLead}</p>

        {archiveFull && (
          <div role="status" className="mt-gr-3 border border-vermilion/30 bg-paper px-gr-3 py-gr-3 text-[14px] leading-ample text-sumi">
            <p>{copy.recoveryArchiveFull}</p>
            <p className="mt-gr-2 text-ink-muted">{copy.recoveryArchiveFullGuide}</p>
          </div>
        )}

        {notice && (
          <p role="status" aria-live="polite" className="mt-gr-3 text-[14px] leading-ample text-sumi">
            {notice}
          </p>
        )}

        <div role="radiogroup" aria-label={copy.recoveryReviewTitle} className="mt-gr-4 flex flex-col gap-gr-2">
          {candidates.map((candidate) => {
            const isSelected = candidate.id === selected?.id;
            return (
              <button
                key={candidate.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setSelectedId(candidate.id)}
                className={[
                  "flex min-h-[44px] w-full flex-col items-start gap-[2px] rounded-[10px] border px-gr-4 py-gr-3 text-left transition-soft",
                  isSelected ? "border-gold/60 bg-washi/80" : "border-[color:var(--color-line)]",
                ].join(" ")}
              >
                <span className="font-mincho text-[15px] text-sumi">{candidate.label}</span>
                <span className="text-[13px] text-ink-muted">
                  {candidate.notes.length === 0
                    ? copy.recoveryReviewEmpty
                    : copy.recoveryReviewCount(candidate.notes.length)}
                  {"　"}
                  {copy.recoveryReviewLatestChange(formatDateTime(latestChange(candidate.notes)))}
                </span>
              </button>
            );
          })}
        </div>

        {selected && (
          <section aria-label={selected.label} className="mt-gr-5 flex flex-col gap-gr-3">
            {selected.notes.length === 0 ? (
              <p className="text-[14px] leading-ample text-sumi">{copy.recoveryReviewEmpty}</p>
            ) : (
              <ul className="flex flex-col gap-gr-2">
                {selected.notes.map((note) => (
                  <li key={note.id} className="border-t border-[color:var(--color-line)] pt-gr-2">
                    <details>
                      <summary className="min-h-[44px] cursor-pointer py-gr-2 text-[15px] leading-ample text-sumi">
                        {identifyingHeading(note)}
                        <span className="ml-gr-2 text-[12px] text-ink-muted">
                          {formatDateTime(note.updatedAt)}
                        </span>
                      </summary>
                      <div className="flex flex-col gap-gr-2 pb-gr-3">
                        <span className="text-[12px] text-ink-muted">{copy.recoveryReviewReadFull}</span>
                        {note.title !== "" && (
                          <input
                            readOnly
                            aria-label={copy.titlePlaceholder}
                            value={note.title}
                            onFocus={(event) => event.currentTarget.select()}
                            className="w-full rounded-[8px] border border-[color:var(--color-line)] bg-paper px-gr-3 py-gr-2 text-[16px] text-sumi"
                          />
                        )}
                        <textarea
                          readOnly
                          aria-label={copy.bodyPlaceholder}
                          value={note.body}
                          rows={Math.min(14, Math.max(4, note.body.split("\n").length + 1))}
                          onFocus={(event) => event.currentTarget.select()}
                          className="w-full rounded-[8px] border border-[color:var(--color-line)] bg-paper px-gr-3 py-gr-2 text-[16px] leading-ample text-sumi"
                        />
                        <div className="flex flex-wrap gap-gr-3">
                          <CopyTextButton label={copy.copyBody} text={note.body} />
                          {note.title !== "" && (
                            <CopyTextButton label={copy.copyTitle} text={note.title} />
                          )}
                        </div>
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}

            {selected.protectedSlot && (
              <div className="border-t border-[color:var(--color-line)] pt-gr-3">
                {confirmingId === selected.id ? (
                  <div role="group" aria-label={copy.recoveryDiscardConfirmTitle} className="flex flex-col gap-gr-3">
                    <p className="text-[15px] text-sumi">{copy.recoveryDiscardConfirmTitle}</p>
                    <p className="text-[14px] leading-ample text-ink-muted">
                      {copy.recoveryDiscardConfirmBody(selected.notes.length)}
                    </p>
                    <div className="flex flex-wrap gap-gr-3">
                      <button
                        type="button"
                        autoFocus
                        onClick={() => setConfirmingId(null)}
                        className="min-h-[44px] whitespace-nowrap rounded-full border border-[color:var(--color-line)] px-gr-4 py-gr-2 font-mincho text-[14px] text-sumi"
                      >
                        {copy.recoveryDiscardCancel}
                      </button>
                      <button
                        type="button"
                        onClick={() => discard(selected)}
                        className="min-h-[44px] whitespace-nowrap rounded-full bg-vermilion px-gr-4 py-gr-2 font-mincho text-[14px] text-washi"
                      >
                        {copy.recoveryDiscardConfirm}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setNotice(null);
                      setConfirmingId(selected.id);
                    }}
                    className="min-h-[44px] whitespace-nowrap rounded-full border border-vermilion/40 px-gr-4 py-gr-2 font-mincho text-[14px] text-vermilion"
                  >
                    {copy.recoveryDiscardAction}
                  </button>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

export default RecoveryReview;
