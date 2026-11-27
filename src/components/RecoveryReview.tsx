import { useEffect, useRef, useState } from "react";
import type { Note } from "../types/note";
import { useI18n } from "../i18n/useI18n";
import type { Messages } from "../lib/i18n";
import { getNoteHeading } from "../lib/noteDisplay";
import type { DiscardProtectedResult, ProtectedRecoverySlot } from "../lib/storage";
import { makeNoteDateFormatter } from "../lib/zanshinDate";
import { OriginalText } from "./OriginalText";
import { CopyTextButton } from "./CopyTextButton";

export type ReviewCandidate = { id: string; notes: readonly Note[] } & (
  | { source: "screen" | "stored" | "primary" | "native" }
  | { source: "protected"; index: number; protectedSlot: { slot: ProtectedRecoverySlot; raw: string } }
);

type Props = {
  candidates: readonly ReviewCandidate[];
  archiveFull: boolean;
  onDiscard: (candidate: ReviewCandidate) => DiscardProtectedResult;
  onClose: () => void;
};

function candidateName(candidate: ReviewCandidate, copy: Messages) {
  switch (candidate.source) {
    case "screen": return copy.recoveryCandidateScreen;
    case "stored": return copy.recoveryCandidateStored;
    case "primary": return copy.recoveryCandidatePrimary;
    case "native": return copy.recoveryCandidateNative;
    case "protected": return copy.recoveryCandidateProtected({ candidateIndex: candidate.index });
  }
}

const noticeKey = {
  discarded: "recoveryDiscardDone",
  changed: "recoveryDiscardChanged",
  failed: "recoveryDiscardFailed",
} as const;

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
  const { copy, locale } = useI18n();
  const format = makeNoteDateFormatter({ formatLocale: locale, withTime: true });
  const [selectedId, setSelectedId] = useState(candidates[0]?.id ?? "");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<DiscardProtectedResult | null>(null);
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
    setNotice(result);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="zanshin-review-title"
      className="fixed inset-0 z-40 overflow-y-auto bg-paper"
      onKeyDown={handleKeyDown}
    >
      <div className="zanshin-info-panel mx-auto flex min-h-full w-full max-w-[560px] flex-col px-gr-4">
        <header className="flex items-center justify-between gap-gr-3">
          <h2 id="zanshin-review-title" className="font-mincho text-[18px] tracking-mincho text-sumi">
            {copy.recoveryReviewTitle}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-full px-gr-4 py-gr-2 font-mincho text-[14px] text-sumi transition-soft hover:bg-washi"
          >
            {copy.close}
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
            {copy[noticeKey[notice]]}
          </p>
        )}

        <p className="mt-gr-3 text-sm text-ink-muted">
          {candidates.length === 0 ? copy.recoveryNoVersions : copy.recoveryVersionCount({ versionCount: candidates.length })}
        </p>
        <div role="radiogroup" aria-label={copy.recoveryReviewTitle} className="mt-gr-4 flex flex-col gap-gr-2">
          {candidates.map((candidate) => {
            const isSelected = candidate.id === selected?.id;
            const latest = latestChange(candidate.notes);
            const displayDate = latest === null ? null : format(latest);
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
                <span className="font-mincho text-[15px] text-sumi">{candidateName(candidate, copy)}</span>
                <span className="text-[13px] text-ink-muted">
                  {candidate.notes.length === 0
                    ? copy.recoveryReviewEmpty
                    : copy.recoveryReviewCount({ noteCount: candidate.notes.length })}
                </span>
                <span className="text-[13px] text-ink-muted">
                  {displayDate ? copy.recoveryReviewLatestChange({ displayDate }) : copy.recoveryReviewNoDate}
                </span>
              </button>
            );
          })}
        </div>

        {selected && (
          <section aria-label={candidateName(selected, copy)} className="mt-gr-5 flex flex-col gap-gr-3">
            {selected.notes.length === 0 ? (
              <p className="text-[14px] leading-ample text-sumi">{copy.recoveryReviewEmpty}</p>
            ) : (
              <ul className="flex flex-col gap-gr-2">
                {selected.notes.map((note) => {
                  const heading = getNoteHeading(note).text;
                  const displayDate = format(note.updatedAt);
                  return (
                    <li key={note.id} className="border-t border-[color:var(--color-line)] pt-gr-2">
                      <details>
                        <summary className="min-h-[44px] cursor-pointer break-words py-gr-2 text-[15px] leading-ample text-sumi">
                          <bdi lang={heading === null ? undefined : ""}>{heading ?? copy.untitled}</bdi>
                          {displayDate && (
                            <time dateTime={note.updatedAt} className="ml-gr-2 text-[12px] text-ink-muted">
                              {copy.changeDate({ displayDate })}
                            </time>
                          )}
                        </summary>
                        <div className="flex flex-col gap-gr-2 pb-gr-3">
                          {note.title !== "" && <OriginalText label={copy.originalTitle} text={note.title} rows={3} />}
                          <OriginalText label={copy.originalText} text={note.body} rows={6} />
                          <div className="flex flex-wrap gap-gr-3">
                            <CopyTextButton label={copy.copyBody} text={note.body} feedback={copy} />
                            {note.title !== "" && (
                              <CopyTextButton label={copy.copyTitle} text={note.title} feedback={copy} />
                            )}
                          </div>
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            )}

            {selected.source === "protected" && (
              <div className="border-t border-[color:var(--color-line)] pt-gr-3">
                {confirmingId === selected.id ? (
                  <div role="group" aria-label={copy.recoveryDiscardConfirmTitle} className="flex flex-col gap-gr-3">
                    <p className="text-[15px] text-sumi">{copy.recoveryDiscardConfirmTitle}</p>
                    <p className="text-[14px] leading-ample text-ink-muted">
                      {copy.recoveryDiscardConfirmBody({ noteCount: selected.notes.length })}
                    </p>
                    <div className="flex flex-wrap gap-gr-3">
                      <button
                        type="button"
                        autoFocus
                        onClick={() => setConfirmingId(null)}
                        className="min-h-[44px] rounded-full border border-[color:var(--color-line)] px-gr-4 py-gr-2 font-mincho text-[14px] text-sumi"
                      >
                        {copy.cancel}
                      </button>
                      <button
                        type="button"
                        onClick={() => discard(selected)}
                        className="min-h-[44px] rounded-full bg-vermilion px-gr-4 py-gr-2 font-mincho text-[14px] text-washi"
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
                    className="min-h-[44px] rounded-full border border-vermilion/40 px-gr-4 py-gr-2 font-mincho text-[14px] text-vermilion"
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
