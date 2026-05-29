import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Note } from "./types/note";
import type { MonetizationState } from "./types/monetization";
import { loadNotes, saveNotes } from "./lib/storage";
import type { SaveResult } from "./lib/storage";
import {
  REMOVE_ADS_PRODUCT,
  loadMonetizationState,
  purchasePremiumMock,
  restorePurchasesMock,
} from "./lib/monetization";
import { PREMIUM_ENABLED } from "./lib/featureFlags";
import { nowIso } from "./lib/date";
import { createId } from "./lib/id";
import { copy } from "./lib/i18n";
import { AppShell } from "./components/AppShell";
import { NotesList } from "./components/NotesList";
import { NoteEditor } from "./components/NoteEditor";
import { PremiumSheet } from "./components/PremiumSheet";

type View = { kind: "list" } | { kind: "editor"; id: string };

/** 削除後のUndoキュー。deletedAt で管理し、将来のゴミ箱機能へ拡張しやすくする。 */
type DeletedNote = Note & { deletedAt: string };

const AUTOSAVE_DEBOUNCE_MS = 500;
const UNDO_TIMEOUT_MS = 10_000;

export default function App() {
  // 初回ロード結果を一度だけ取得（loadNotes はマウント時に一度だけ呼ぶ）
  const [initialLoad] = useState(() => {
    const r = loadNotes();
    return { notes: r.notes, loadFailed: !r.ok };
  });

  const [notes, setNotes] = useState<Note[]>(initialLoad.notes);
  const [view, setView] = useState<View>({ kind: "list" });
  const [monetization, setMonetization] = useState<MonetizationState>(() =>
    loadMonetizationState(),
  );
  const [isPremiumSheetOpen, setIsPremiumSheetOpen] = useState(false);
  const [lastSaveResult, setLastSaveResult] = useState<SaveResult | null>(null);

  /** 削除Undo: 最後に削除したノートと自動削除タイマー */
  const [lastDeleted, setLastDeleted] = useState<DeletedNote | null>(null);
  const undoTimerRef = useRef<number | null>(null);

  /** 初回ロードがデータ破損だった場合の警告表示 */
  const [loadError, setLoadError] = useState<boolean>(initialLoad.loadFailed);

  /** データ破損時に自動保存で空配列で上書きしないためのガード */
  const saveGuardRef = useRef<boolean>(initialLoad.loadFailed);

  const persistTimer = useRef<number | null>(null);
  useEffect(() => {
    if (persistTimer.current) window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => {
      // 破損ロード時は最初の自動保存をスキップ（空データで上書きしない）
      if (saveGuardRef.current) {
        saveGuardRef.current = false;
        return;
      }
      const result = saveNotes(notes);
      setLastSaveResult(result);
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (persistTimer.current) window.clearTimeout(persistTimer.current);
    };
  }, [notes]);

  useEffect(() => {
    const flush = () => { saveNotes(notes); };
    window.addEventListener("beforeunload", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      window.removeEventListener("pagehide", flush);
    };
  }, [notes]);

  useEffect(() => {
    const syncMonetization = () => setMonetization(loadMonetizationState());
    window.addEventListener("storage", syncMonetization);
    return () => {
      window.removeEventListener("storage", syncMonetization);
    };
  }, []);

  const createNote = useCallback(() => {
    saveGuardRef.current = false; // 明示的な操作: 保存ガードを解除する
    const iso = nowIso();
    const note: Note = {
      id: createId(),
      title: "",
      body: "",
      createdAt: iso,
      updatedAt: iso,
      isFavorite: false,
      locale: "ja",
    };
    setNotes((prev) => [note, ...prev]);
    setView({ kind: "editor", id: note.id });
  }, []);

  const updateNote = useCallback(
    (id: string, patch: Partial<Pick<Note, "title" | "body" | "isFavorite">>) => {
      saveGuardRef.current = false; // 明示的な編集: 保存ガードを解除する
      setNotes((prev) =>
        prev.map((note) =>
          note.id === id ? { ...note, ...patch, updatedAt: nowIso() } : note,
        ),
      );
    },
    [],
  );

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => {
      const target = prev.find((n) => n.id === id);
      if (target) {
        // 既存のUndoタイマーをクリア（前の削除を確定）
        if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
        const deleted: DeletedNote = { ...target, deletedAt: nowIso() };
        setLastDeleted(deleted);
        undoTimerRef.current = window.setTimeout(() => {
          setLastDeleted(null);
        }, UNDO_TIMEOUT_MS);
      }
      return prev.filter((note) => note.id !== id);
    });
    setView({ kind: "list" });
  }, []);

  const undoDelete = useCallback(() => {
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    setLastDeleted((deleted) => {
      if (!deleted) return null;
      const { deletedAt: _, ...note } = deleted;
      setNotes((prev) => [note, ...prev]);
      return null;
    });
  }, []);

  const openNote = useCallback((id: string) => {
    setView({ kind: "editor", id });
  }, []);

  const openPremiumSheet = useCallback(() => {
    setIsPremiumSheetOpen(true);
  }, []);

  const closePremiumSheet = useCallback(() => {
    setIsPremiumSheetOpen(false);
  }, []);

  const handlePurchase = useCallback(async () => {
    setMonetization((prev) => ({ ...prev, purchaseStatus: "loading" }));
    const next = await purchasePremiumMock();
    setMonetization(next);
    if (next.isPremium) setIsPremiumSheetOpen(false);
  }, []);

  const handleRestore = useCallback(async () => {
    setMonetization((prev) => ({ ...prev, purchaseStatus: "loading" }));
    const next = await restorePurchasesMock();
    setMonetization(next);
  }, []);

  const currentNote = useMemo<Note | undefined>(() => {
    if (view.kind !== "editor") return undefined;
    return notes.find((note) => note.id === view.id);
  }, [view, notes]);

  useEffect(() => {
    if (view.kind === "editor" && !currentNote) {
      // 開いていたノートが削除された場合に一覧へ戻す（意図的な setState in effect）
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setView({ kind: "list" });
    }
  }, [view, currentNote]);

  const saveError = lastSaveResult?.ok === false;

  return (
    <AppShell>
      {loadError && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed inset-x-gr-4 top-gr-3 z-30 flex items-center justify-between gap-gr-3 rounded-[13px] border border-vermilion/30 bg-paper px-gr-4 py-gr-3 text-[12px] leading-ample text-vermilion shadow-paper-hover animate-fadeIn"
        >
          <span className="font-mincho">
            データの読み込みに問題がありました。メモが復元できない可能性があります。
          </span>
          <button
            type="button"
            onClick={() => setLoadError(false)}
            className="shrink-0 text-ink-muted/70 transition-soft hover:text-sumi"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>
      )}

      {lastDeleted && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-gr-4 bottom-[max(env(safe-area-inset-bottom),89px)] z-30 flex items-center justify-between gap-gr-3 rounded-[13px] border border-[color:var(--color-line)] bg-paper px-gr-4 py-gr-3 text-[13px] shadow-paper-hover animate-softUp"
        >
          <span className="font-mincho text-sumi/88">{copy.undoDeleteMessage}</span>
          <button
            type="button"
            onClick={undoDelete}
            className="shrink-0 rounded-full border border-[color:var(--color-line)] px-gr-3 py-gr-2 font-mincho text-[12px] tracking-mincho text-sumi transition-soft hover:bg-washi"
          >
            {copy.undoDelete}
          </button>
        </div>
      )}

      {view.kind === "list" || !currentNote ? (
        <>
          <NotesList
            notes={notes}
            monetization={monetization}
            onOpen={openNote}
            onCreate={createNote}
            onOpenPremium={openPremiumSheet}
            onRestorePurchase={handleRestore}
          />
          {PREMIUM_ENABLED && (
            <PremiumSheet
              open={isPremiumSheetOpen}
              monetization={monetization}
              product={REMOVE_ADS_PRODUCT}
              onClose={closePremiumSheet}
              onPurchase={handlePurchase}
              onRestore={handleRestore}
            />
          )}
        </>
      ) : (
        <NoteEditor
          note={currentNote}
          onChange={(patch) => updateNote(currentNote.id, patch)}
          onBack={() => setView({ kind: "list" })}
          onDelete={() => deleteNote(currentNote.id)}
          saveError={saveError}
        />
      )}
    </AppShell>
  );
}
