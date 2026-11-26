import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Note } from "../types/note";
import { isRetryableSaveFailure, type SaveResult } from "../lib/storage";
import { copy } from "../lib/i18n";
import { getSaveFailureMessage } from "../lib/saveFailureUi";
import { useSaveTrace } from "../hooks/useSaveTrace";
import { BrushPicker } from "./BrushPicker";
import { CopyTextButton } from "./CopyTextButton";
import { getCardDisplay } from "../lib/noteDisplay";
import { ZanshinDateStamp } from "./ZanshinDateStamp";
import { SaveAfterglow } from "./SaveAfterglow";

type Props = {
  note: Note;
  onChange: (patch: Partial<Pick<Note, "title" | "body" | "isFavorite">>) => void;
  /** 戻る操作の名前。行き先（一覧へ／検索結果へ／読み返しへ）で呼ぶ。 */
  backLabel?: string;
  onBack: () => void;
  onDelete: () => void;
  /** App が実際に行った直近の保存結果。UIの保存表示を推測タイマーにしない。 */
  saveResult?: SaveResult | null;
  /** conflict の理由に応じた保存停止メッセージ。 */
  conflictMessage?: string;
  /** quota / unavailable / unknown の一時的な保存失敗を内容変更なしで再試行する。 */
  onRetrySave?: () => void;
};

type SaveState = "idle" | "saving" | "saved" | "error";

const SAVED_FEEDBACK_VISIBLE_MS = 1200;
const ANNOUNCE_SAVED_DELAY_MS = 2500;

export function NoteEditor({
  note,
  onChange,
  backLabel = copy.back,
  onBack,
  onDelete,
  saveResult = null,
  conflictMessage = copy.saveConflict,
  onRetrySave,
}: Props) {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [announcedSaved, setAnnouncedSaved] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const isDateSettling = useSaveTrace(saveState === "saved" ? note.updatedAt : null, 640);

  const savedTimer = useRef<number | null>(null);

  function markDirty() {
    if (savedTimer.current) {
      window.clearTimeout(savedTimer.current);
      savedTimer.current = null;
    }
    setSaveState("saving");
  }

  useEffect(() => {
    if (!saveResult) return;

    // 通常は saving 中の結果だけを受け取る。
    // 競合UIから明示的に上書き保存した場合は error -> saved の回復も許可する。
    const shouldHandleResult =
      saveState === "saving" || (saveState === "error" && saveResult.ok);
    if (!shouldHandleResult) return;

    if (savedTimer.current) {
      window.clearTimeout(savedTimer.current);
      savedTimer.current = null;
    }

    if (!saveResult.ok) {
      // 保存結果は外部ストレージI/Oの結果なので、このeffect内で状態へ反映する。
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSaveState("error");
      return;
    }

    // 実際の saveNotes 成功後にだけ「保存済み」へ遷移する。
    setSaveState("saved");
    savedTimer.current = window.setTimeout(() => {
      setSaveState("idle");
      savedTimer.current = null;
    }, SAVED_FEEDBACK_VISIBLE_MS);
  }, [saveResult, saveState]);

  useEffect(() => {
    return () => {
      if (savedTimer.current) window.clearTimeout(savedTimer.current);
    };
  }, []);

  // 新規作成時は本文にフォーカス。
  // 別のノートを開いたとき（id が変わったとき）にだけ走らせたいので、
  // title / body は依存に含めない（編集中の毎入力で再フォーカスさせないため）。
  // 同時に、前のノートで出ていた保存状態を引き継がないようリセットする。
  useEffect(() => {
    if (savedTimer.current) {
      window.clearTimeout(savedTimer.current);
      savedTimer.current = null;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaveState("idle");
    setConfirmingDelete(false);
    if (!note.title && !note.body) {
      bodyRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  function handleTitle(event: React.ChangeEvent<HTMLTextAreaElement>) {
    // 以前の単一行入力と同じく、貼り付けた改行は空白として扱う（題名は1行の名前）。
    onChange({ title: event.target.value.replace(/\r?\n/g, " ") });
    markDirty();
  }

  function handleTitleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter") return;
    // 日本語変換中の Enter は確定操作。横取りしない。
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    bodyRef.current?.focus();
  }

  // 題名の高さは内容に合わせて伸ばす。別の小さなスクロール枠を作らない。
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [note.title, note.id]);

  function handleBody(event: React.ChangeEvent<HTMLTextAreaElement>) {
    onChange({ body: event.target.value });
    markDirty();
  }

  function toggleFavorite() {
    onChange({ isFavorite: !note.isFavorite });
    markDirty();
  }

  function cancelDeleteConfirmation() {
    setConfirmingDelete(false);
    window.requestAnimationFrame(() => deleteButtonRef.current?.focus());
  }

  // 保存の失敗・競合は、この画面だけの演出ではなく「いまの編集版が保存されていない」という事実。
  // 再入場で saveState が idle に戻っても、App が保持する結果が失敗である間は表示し続ける。
  // 失敗が解消するのは、保存が成功した結果が届いた時（または新しい入力で未確定に戻った時）だけ。
  const displayedSaveState: SaveState = saveResult?.ok === false ? "error" : saveState;

  // 保存済みの読み上げは、最後の保存から少し落ち着いてから一度だけ。入力中・保存中は出さない。
  useEffect(() => {
    if (displayedSaveState !== "saved") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAnnouncedSaved(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setAnnouncedSaved(true), ANNOUNCE_SAVED_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [displayedSaveState, note.updatedAt]);

  const retryableSaveError = isRetryableSaveFailure(saveResult);
  const saveErrorMessage =
    saveResult?.ok === false && saveResult.reason === "conflict"
      ? conflictMessage
      : getSaveFailureMessage(saveResult) ?? copy.saveError;

  function retrySave() {
    if (!retryableSaveError || !onRetrySave) return;
    if (savedTimer.current) {
      window.clearTimeout(savedTimer.current);
      savedTimer.current = null;
    }
    setSaveState("saving");
    onRetrySave();
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[560px] flex-1 flex-col pt-gr-3 animate-washiFade">
      <header className="zanshin-screen-bar flex items-center justify-between gap-gr-4">
        <button
          type="button"
          onClick={onBack}
          aria-label={backLabel}
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
          <span className="font-mincho tracking-mincho">{backLabel}</span>
        </button>

        <div className="flex items-center gap-gr-2">
          <BrushPicker variant="icon" />
          <button
            type="button"
            onClick={toggleFavorite}
            aria-label={note.isFavorite ? copy.favoriteOff : copy.favoriteOn}
            aria-pressed={note.isFavorite}
            title={note.isFavorite ? copy.favoriteOff : copy.favoriteOn}
            className={[
              "zanshin-editor-action flex h-[44px] w-[44px] items-center justify-center rounded-full",
              "transition-soft active:scale-95",
              note.isFavorite
                ? "text-gold hover:bg-gold/10"
                : "text-ink-muted hover:text-sumi hover:bg-paper/60",
            ].join(" ")}
          >
            {note.isFavorite ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="12" cy="12" r="6" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="5.4" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            )}
          </button>

          <button
            ref={deleteButtonRef}
            type="button"
            onClick={() => setConfirmingDelete(true)}
            aria-label={copy.deleteNote}
            title={copy.deleteNote}
            className="
              zanshin-editor-action flex h-[44px] w-[44px] items-center justify-center rounded-full
              text-ink-muted transition-soft
              hover:text-vermilion hover:bg-vermilion/5
              active:scale-95
            "
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-9 0v12a2 2 0 002 2h6a2 2 0 002-2V7"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* 保存の失敗・競合は、いまの編集版が保存されていないという事実。操作バーのすぐ下に出し、
          成功演出（薄い色・短時間表示）とは別の専用の見た目にする（R07 / R24）。 */}
      {displayedSaveState === "error" && (
        <div role="alert" className="zanshin-save-failure">
          <p className="zanshin-save-failure__message">{saveErrorMessage}</p>
          <div className="zanshin-save-failure__actions">
            {retryableSaveError && onRetrySave && (
              <button
                type="button"
                onClick={retrySave}
                className="zanshin-save-failure__retry min-h-[44px] whitespace-nowrap rounded-full border border-vermilion/40 px-gr-4 py-gr-2 font-mincho text-[14px] tracking-mincho text-vermilion transition-soft hover:bg-vermilion/5 active:scale-[0.98]"
              >
                {copy.retrySave}
              </button>
            )}
            {/* 保存できていない最新の文章を、保存の成否と無関係に取り出せる出口（R24）。原文のまま渡す。 */}
            {note.body !== "" && <CopyTextButton label={copy.copyBody} text={note.body} />}
            {note.title !== "" && <CopyTextButton label={copy.copyTitle} text={note.title} />}
          </div>
        </div>
      )}

      {/* 通常の「保存済み」は、入力の区切りごとに繰り返し読み上げない。入力が落ち着いてから一度だけ伝える。 */}
      <span className="sr-only" role="status" aria-live="polite">
        {announcedSaved ? copy.saved : ""}
      </span>

      <main className="flex min-h-0 flex-1 flex-col pt-gr-4">
        <div className="editor-paper flex flex-1 flex-col px-gr-4 py-gr-5 sm:px-gr-5 sm:py-gr-6">
          <SaveAfterglow active={displayedSaveState === "saved"} token={note.updatedAt} />

          <div className="mb-gr-5 self-start">
            <ZanshinDateStamp isoString={note.createdAt} isSettling={isDateSettling} />
          </div>

          {/* 題名は単一行の意味のまま、長い題名は折り返して全文を編集できる（R11）。
              改行は入れない（Enter は本文へ移動。IME の変換確定は横取りしない）。 */}
          <textarea
            ref={titleRef}
            rows={1}
            value={note.title}
            onChange={handleTitle}
            onKeyDown={handleTitleKeyDown}
            placeholder={copy.titlePlaceholder}
            aria-label={copy.titlePlaceholder}
            maxLength={200}
            className="note-title-input jp-writing-surface"
          />

          <div
            aria-hidden="true"
            className="mt-gr-4 h-px w-gr-4 bg-gradient-to-r from-transparent via-gold/22 to-transparent"
          />

          <textarea
            ref={bodyRef}
            value={note.body}
            onChange={handleBody}
            placeholder={copy.bodyPlaceholder}
            aria-label={copy.bodyPlaceholder}
            className="writing-textarea jp-writing-surface mt-gr-5 flex-1"
            style={{ minHeight: "42dvh" }}
          />
        </div>

        <div className="flex items-end gap-gr-4 pb-gr-5 pt-gr-3 text-[10px] tracking-[0.12em] text-ink-muted/72">
          <span aria-hidden="true" className="flex min-h-[1.6em] flex-col justify-end gap-gr-1">
            {displayedSaveState === "saving" && (
              <span className="zanshin-save-status zanshin-save-status--saving flex items-center gap-gr-2">
                <span className="zanshin-breath-dot" aria-hidden="true" />
                <span className="font-mincho">{copy.saving}</span>
              </span>
            )}
            {displayedSaveState === "saved" && (
              <span
                key={`saved-${note.updatedAt}`}
                className="zanshin-save-status zanshin-save-status--saved flex items-center gap-gr-2"
              >
                <span className="font-mincho">{copy.saved}</span>
              </span>
            )}
          </span>
        </div>
      </main>

      {confirmingDelete && (
        <DeleteConfirm
          heading={getCardDisplay(note).heading}
          onCancel={cancelDeleteConfirmation}
          onConfirm={() => {
            setConfirmingDelete(false);
            onDelete();
          }}
        />
      )}
    </div>
  );
}

function DeleteConfirm({
  heading,
  onCancel,
  onConfirm,
}: {
  /** どのメモか分かる短い識別（本人の題名、または本文の最初の行） */
  heading: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }

    if (event.key !== "Tab") return;

    const first = cancelRef.current;
    const last = confirmRef.current;
    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="zanshin-delete-title"
      aria-describedby="zanshin-delete-description"
      className="fixed inset-0 z-20 flex items-end justify-center bg-sumi/35 backdrop-blur-[2px] px-gr-4 pb-gr-5 sm:items-center animate-fadeIn"
      onClick={onCancel}
      onKeyDown={handleKeyDown}
    >
      <div
        className="
          zanshin-delete-dialog w-full max-w-[420px] rounded-[13px] bg-paper
          p-gr-5 shadow-paper-hover border border-[color:var(--color-line)]
          animate-softUp
        "
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="zanshin-delete-title"
          className="font-mincho text-[18px] tracking-mincho text-sumi jp-text-discipline"
        >
          {copy.deleteConfirmTitle}
        </h2>
        <p className="zanshin-delete-target mt-gr-2 text-[15px] leading-ample text-sumi">「{heading}」</p>
        <p
          id="zanshin-delete-description"
          className="mt-gr-3 whitespace-pre-line text-[13px] leading-ample text-ink-muted jp-text-discipline"
        >
          {copy.deleteConfirmBody}
        </p>
        <div className="mt-gr-5 flex flex-wrap items-center justify-end gap-gr-3">
          <button
            ref={cancelRef}
            autoFocus
            type="button"
            onClick={onCancel}
            className="
              min-h-[44px] whitespace-nowrap rounded-full px-gr-4 py-gr-2 font-mincho text-[14px]
              text-ink-muted transition-soft hover:text-sumi hover:bg-paper/60
            "
          >
            {copy.cancel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className="
              zanshin-delete-confirm min-h-[44px] whitespace-nowrap rounded-full bg-vermilion px-gr-5 py-gr-3 font-mincho text-[14px]
              text-washi shadow-paper-soft transition-soft
              hover:bg-vermilion/90 active:scale-[0.98]
            "
          >
            {copy.confirmDelete}
          </button>
        </div>
      </div>
    </div>
  );
}

export default NoteEditor;
