import { useEffect, useRef, useState } from "react";
import type { Note } from "../types/note";
import { copy } from "../lib/i18n";
import { useSaveTrace } from "../hooks/useSaveTrace";
import { ZanshinDateStamp } from "./ZanshinDateStamp";

type Props = {
  note: Note;
  onChange: (patch: Partial<Pick<Note, "title" | "body" | "isFavorite">>) => void;
  onBack: () => void;
  onDelete: () => void;
};

type SaveState = "idle" | "saving" | "saved";

export function NoteEditor({ note, onChange, onBack, onDelete }: Props) {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const isDateSettling = useSaveTrace(saveState === "saved" ? note.updatedAt : null, 900);

  // 自動保存ステータス: 入力後すぐ "saving"、少し経って "saved"、さらに経って消える
  const savingTimer = useRef<number | null>(null);
  const savedTimer = useRef<number | null>(null);

  function markDirty() {
    setSaveState("saving");
    if (savingTimer.current) window.clearTimeout(savingTimer.current);
    if (savedTimer.current) window.clearTimeout(savedTimer.current);
    savingTimer.current = window.setTimeout(() => {
      setSaveState("saved");
      savedTimer.current = window.setTimeout(() => setSaveState("idle"), 1800);
    }, 420);
  }

  useEffect(() => {
    return () => {
      if (savingTimer.current) window.clearTimeout(savingTimer.current);
      if (savedTimer.current) window.clearTimeout(savedTimer.current);
    };
  }, []);

  // 新規作成時は本文にフォーカス。
  // 別のノートを開いたとき（id が変わったとき）にだけ走らせたいので、
  // title / body は依存に含めない（編集中の毎入力で再フォーカスさせないため）。
  // 同時に、前のノートで出ていた「保存中／保存しました」表示を引き継がないように
  // ステータスとタイマーをリセットする。
  useEffect(() => {
    if (savingTimer.current) window.clearTimeout(savingTimer.current);
    if (savedTimer.current) window.clearTimeout(savedTimer.current);
    setSaveState("idle");
    setConfirmingDelete(false);
    if (!note.title && !note.body) {
      bodyRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  function handleTitle(e: React.ChangeEvent<HTMLInputElement>) {
    onChange({ title: e.target.value });
    markDirty();
  }
  function handleBody(e: React.ChangeEvent<HTMLTextAreaElement>) {
    onChange({ body: e.target.value });
    markDirty();
  }
  function toggleFavorite() {
    onChange({ isFavorite: !note.isFavorite });
    markDirty();
  }

  return (
    <div className="flex min-h-full flex-1 flex-col pt-gr-3 animate-washiFade">
      {/* 上部バー */}
      <header className="flex items-center justify-between gap-gr-4">
        <button
          type="button"
          onClick={onBack}
          aria-label={copy.back}
          className="
            -ml-gr-2 flex items-center gap-gr-2 rounded-full
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
              "flex h-[44px] w-[44px] items-center justify-center rounded-full",
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
            type="button"
            onClick={() => setConfirmingDelete(true)}
            aria-label={copy.deleteNote}
            title={copy.deleteNote}
            className="
              flex h-[44px] w-[44px] items-center justify-center rounded-full
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

      {/* エディタ本体 — 一枚の和紙に向かう場所 */}
      <main className="flex flex-1 min-h-0 flex-col pt-gr-5">
        {/* Phase 13: 日付印を控えめに表示 */}
        <div className="mb-gr-4 flex justify-center">
          <ZanshinDateStamp isoString={note.createdAt} isSettling={isDateSettling} />
        </div>

        <div className="editor-paper flex flex-1 flex-col px-gr-4 py-gr-5 sm:px-gr-5">
          <input
            ref={titleRef}
            type="text"
            value={note.title}
            onChange={handleTitle}
            placeholder={copy.titlePlaceholder}
            aria-label={copy.titlePlaceholder}
            maxLength={200}
            className="note-title-input"
          />

          {/* タイトルと本文の間 — 短い金の余韻 */}
          <div
            aria-hidden="true"
            className="mt-gr-4 h-px w-gr-5 bg-gradient-to-r from-transparent via-gold/35 to-transparent"
          />

          <textarea
            ref={bodyRef}
            value={note.body}
            onChange={handleBody}
            placeholder={copy.bodyPlaceholder}
            aria-label={copy.bodyPlaceholder}
            className="writing-textarea mt-gr-4 flex-1"
            style={{ minHeight: "34dvh" }}
          />
        </div>

        {/* 状態行 — 小さく、静かに */}
        <div className="flex items-end gap-gr-4 pb-gr-5 pt-gr-4 text-[10px] tracking-[0.12em] text-ink-muted/70">
          <span
            aria-live="polite"
            className="flex min-h-[2.8em] flex-col justify-end gap-gr-1"
          >
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
            {(saveState === "saving" || saveState === "saved") && (
              <span className="english-subcopy pl-[14px] text-[10px] opacity-70">
                {saveState === "saving" ? copy.savingEn : copy.savedEn}
              </span>
            )}
          </span>
        </div>
      </main>

      {/* 削除確認 */}
      {confirmingDelete && (
        <DeleteConfirm
          onCancel={() => setConfirmingDelete(false)}
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
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="zanshin-delete-title"
      className="fixed inset-0 z-20 flex items-end justify-center bg-sumi/35 backdrop-blur-[2px] px-gr-4 pb-gr-5 sm:items-center animate-fadeIn"
      onClick={onCancel}
    >
      <div
        className="
          w-full max-w-[420px] rounded-[13px] bg-paper
          p-gr-5 shadow-paper-hover border border-[color:var(--color-line)]
          animate-softUp
        "
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="zanshin-delete-title"
          className="font-mincho text-[18px] tracking-mincho text-sumi"
        >
          {copy.deleteConfirmTitle}
        </h2>
        <p className="mt-gr-3 whitespace-pre-line text-[13px] leading-ample text-ink-muted">
          {copy.deleteConfirmBody}
        </p>
        <div className="mt-gr-5 flex items-center justify-end gap-gr-3">
          <button
            type="button"
            onClick={onCancel}
            className="
              rounded-full px-gr-4 py-gr-2 font-mincho text-[14px]
              text-ink-muted transition-soft hover:text-sumi hover:bg-paper/60
            "
          >
            {copy.cancel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="
              rounded-full bg-vermilion px-gr-5 py-gr-3 font-mincho text-[14px]
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
