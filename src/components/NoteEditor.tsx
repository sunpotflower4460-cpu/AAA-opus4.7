import { useEffect, useRef, useState } from "react";
import type { Note } from "../types/note";
import type { SaveResult } from "../lib/storage";
import { copy } from "../lib/i18n";
import { useSaveTrace } from "../hooks/useSaveTrace";
import { ZanshinDateStamp } from "./ZanshinDateStamp";
import { SaveAfterglow } from "./SaveAfterglow";

type Props = {
  note: Note;
  onChange: (patch: Partial<Pick<Note, "title" | "body" | "isFavorite">>) => void;
  onBack: () => void;
  onDelete: () => void;
  /** App が実際に行った直近の保存結果。UIの保存表示を推測タイマーにしない。 */
  saveResult?: SaveResult | null;
};

type SaveState = "idle" | "saving" | "saved" | "error";

const SAVED_FEEDBACK_VISIBLE_MS = 1200;

export function NoteEditor({ note, onChange, onBack, onDelete, saveResult = null }: Props) {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
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
    if (saveState !== "saving" || !saveResult) return;

    if (savedTimer.current) {
      window.clearTimeout(savedTimer.current);
      savedTimer.current = null;
    }

    if (!saveResult.ok) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSaveState("error");
      return;
    }

    // 実際の saveNotes 成功後にだけ「保存済み」へ遷移する。
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  function handleTitle(event: React.ChangeEvent<HTMLInputElement>) {
    onChange({ title: event.target.value });
    markDirty();
  }

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

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[560px] flex-1 flex-col pt-gr-3 animate-washiFade">
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

      <main className="flex min-h-0 flex-1 flex-col pt-gr-4">
        <div className="editor-paper flex flex-1 flex-col px-gr-4 py-gr-5 sm:px-gr-5 sm:py-gr-6">
          <SaveAfterglow active={saveState === "saved"} token={note.updatedAt} />

          <div className="mb-gr-5 self-start">
            <ZanshinDateStamp isoString={note.createdAt} isSettling={isDateSettling} />
          </div>

          <input
            type="text"
            value={note.title}
            onChange={handleTitle}
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

        <div className="flex items-end gap-gr-4 pb-gr-5 pt-gr-3 text-[10px] tracking-[0.12em] text-ink-muted/62">
          <span aria-live="polite" className="flex min-h-[1.6em] flex-col justify-end gap-gr-1">
            {saveState === "saving" && (
              <span className="zanshin-save-status zanshin-save-status--saving flex items-center gap-gr-2">
                <span className="zanshin-breath-dot" aria-hidden="true" />
                <span className="font-mincho">{copy.saving}</span>
              </span>
            )}
            {saveState === "saved" && (
              <span
                key={`saved-${note.updatedAt}`}
                className="zanshin-save-status zanshin-save-status--saved flex items-center gap-gr-2"
              >
                <span className="font-mincho">{copy.saved}</span>
              </span>
            )}
            {saveState === "error" && (
              <span className="zanshin-save-status flex items-center gap-gr-2 text-vermilion">
                <span className="font-mincho">{copy.saveError}</span>
              </span>
            )}
          </span>
        </div>
      </main>

      {confirmingDelete && (
        <DeleteConfirm
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
  onCancel,
  onConfirm,
}: {
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
        <p
          id="zanshin-delete-description"
          className="mt-gr-3 whitespace-pre-line text-[13px] leading-ample text-ink-muted jp-text-discipline"
        >
          {copy.deleteConfirmBody}
        </p>
        <div className="mt-gr-5 flex items-center justify-end gap-gr-3">
          <button
            ref={cancelRef}
            autoFocus
            type="button"
            onClick={onCancel}
            className="
              min-h-[44px] rounded-full px-gr-4 py-gr-2 font-mincho text-[14px]
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
              zanshin-delete-confirm min-h-[44px] rounded-full bg-vermilion px-gr-5 py-gr-3 font-mincho text-[14px]
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
