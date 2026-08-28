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
import { ReadMode } from "./components/ReadMode";
import { PremiumSheet } from "./components/PremiumSheet";

type View = { kind: "list" } | { kind: "editor"; id: string } | { kind: "read"; id: string };

/** 削除後のUndoキュー。deletedAt で管理し、将来のゴミ箱機能へ拡張しやすくする。 */
type DeletedNote = Note & { deletedAt: string };

const AUTOSAVE_DEBOUNCE_MS = 500;
const UNDO_TIMEOUT_MS = 10_000;

export default function App() {
  // 初回ロード結果を一度だけ取得（loadNotes はマウント時に一度だけ呼ぶ）
  const [initialLoad] = useState(() => {
    const result = loadNotes();
    return {
      notes: result.notes,
      loadFailed: !result.ok,
      recoveredCount: result.ok ? 0 : result.notes.length,
    };
  });

  const [notes, setNotes] = useState<Note[]>(initialLoad.notes);
  const [view, setView] = useState<View>({ kind: "list" });
  const [searchQuery, setSearchQuery] = useState("");
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

  /**
   * 破損ロード時は、ユーザーが明示的に編集するまで保存を禁止する。
   * 一度スキップしただけで解除せず、データ確認中のリロード/終了でも元データを守る。
   */
  const saveGuardRef = useRef<boolean>(initialLoad.loadFailed);

  /**
   * このタブ自身が変更したときだけ lifecycle flush を許可する。
   * 開いただけの古いタブが pagehide で新しい別タブの内容を上書きする事故を防ぐ。
   */
  const notesDirtyRef = useRef(false);
  const latestNotesRef = useRef(notes);
  latestNotesRef.current = notes;

  const markNotesDirty = useCallback(() => {
    saveGuardRef.current = false;
    notesDirtyRef.current = true;
    setLastSaveResult(null);
  }, []);

  const persistTimer = useRef<number | null>(null);
  useEffect(() => {
    if (persistTimer.current) {
      window.clearTimeout(persistTimer.current);
      persistTimer.current = null;
    }

    if (saveGuardRef.current || !notesDirtyRef.current) return undefined;

    persistTimer.current = window.setTimeout(() => {
      persistTimer.current = null;
      if (saveGuardRef.current || !notesDirtyRef.current) return;

      const result = saveNotes(notes);
      setLastSaveResult(result);
      if (result.ok) notesDirtyRef.current = false;
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (persistTimer.current) {
        window.clearTimeout(persistTimer.current);
        persistTimer.current = null;
      }
    };
  }, [notes]);

  const flushPendingNotes = useCallback(() => {
    if (saveGuardRef.current || !notesDirtyRef.current) return;

    const result = saveNotes(latestNotesRef.current);
    setLastSaveResult(result);
    if (result.ok) notesDirtyRef.current = false;
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushPendingNotes();
    };

    window.addEventListener("beforeunload", flushPendingNotes);
    window.addEventListener("pagehide", flushPendingNotes);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", flushPendingNotes);
      window.removeEventListener("pagehide", flushPendingNotes);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [flushPendingNotes]);

  useEffect(() => {
    const syncMonetization = () => setMonetization(loadMonetizationState());
    window.addEventListener("storage", syncMonetization);
    return () => {
      window.removeEventListener("storage", syncMonetization);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    };
  }, []);

  const createNote = useCallback(() => {
    markNotesDirty();
    setSearchQuery("");

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
  }, [markNotesDirty]);

  const updateNote = useCallback(
    (id: string, patch: Partial<Pick<Note, "title" | "body" | "isFavorite">>) => {
      markNotesDirty();
      setNotes((prev) =>
        prev.map((note) =>
          note.id === id ? { ...note, ...patch, updatedAt: nowIso() } : note,
        ),
      );
    },
    [markNotesDirty],
  );

  const deleteNote = useCallback(
    (id: string) => {
      const target = notes.find((note) => note.id === id);
      if (!target) {
        setView({ kind: "list" });
        return;
      }

      // State updater の中でタイマーや別 setState を作らない。
      // React StrictMode の updater 二重評価でも副作用が重複しないようにする。
      if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
      const deleted: DeletedNote = { ...target, deletedAt: nowIso() };

      markNotesDirty();
      setNotes((prev) => prev.filter((note) => note.id !== id));
      setLastDeleted(deleted);
      undoTimerRef.current = window.setTimeout(() => {
        undoTimerRef.current = null;
        setLastDeleted(null);
      }, UNDO_TIMEOUT_MS);
      setView({ kind: "list" });
    },
    [markNotesDirty, notes],
  );

  const undoDelete = useCallback(() => {
    if (!lastDeleted) return;

    if (undoTimerRef.current) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }

    const { deletedAt: _, ...note } = lastDeleted;
    markNotesDirty();
    setNotes((prev) => (prev.some((item) => item.id === note.id) ? prev : [note, ...prev]));
    setLastDeleted(null);
  }, [lastDeleted, markNotesDirty]);

  const openNote = useCallback((id: string) => {
    setView({ kind: "read", id });
  }, []);

  const openPremiumSheet = useCallback(() => {
    setIsPremiumSheetOpen(true);
  }, []);

  const closePremiumSheet = useCallback(() => {
    setIsPremiumSheetOpen(false);
  }, []);

  const handlePurchase = useCallback(async () => {
    setMonetization((prev) => ({ ...prev, purchaseStatus: "loading" }));
    try {
      const next = await purchasePremiumMock();
      setMonetization(next);
      if (next.isPremium) setIsPremiumSheetOpen(false);
    } catch (error) {
      console.error("Premium purchase failed", error);
      setMonetization((prev) => ({ ...prev, purchaseStatus: "error" }));
    }
  }, []);

  const handleRestore = useCallback(async () => {
    setMonetization((prev) => ({ ...prev, purchaseStatus: "loading" }));
    try {
      const next = await restorePurchasesMock();
      setMonetization(next);
    } catch (error) {
      console.error("Purchase restore failed", error);
      setMonetization((prev) => ({ ...prev, purchaseStatus: "error" }));
    }
  }, []);

  const currentNote = useMemo<Note | undefined>(() => {
    if (view.kind === "list") return undefined;
    return notes.find((note) => note.id === view.id);
  }, [view, notes]);

  useEffect(() => {
    if (view.kind !== "list" && !currentNote) {
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
          className="fixed inset-x-gr-4 top-gr-3 z-30 flex items-center justify-between gap-gr-3 border border-vermilion/30 bg-paper px-gr-4 py-gr-2 text-[12px] leading-ample text-vermilion shadow-paper-hover animate-fadeIn"
          style={{ borderRadius: "7px 13px 8px 11px" }}
        >
          <span className="font-mincho jp-text-discipline">
            {initialLoad.recoveredCount > 0
              ? `保存データに問題がありました。復元できた${initialLoad.recoveredCount}件を表示しています。`
              : "データの読み込みに問題がありました。メモが復元できない可能性があります。"}
          </span>
          <button
            type="button"
            onClick={() => setLoadError(false)}
            className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[8px] text-ink-muted/70 transition-soft hover:bg-vermilion/5 hover:text-sumi active:scale-[0.96]"
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
          className="fixed inset-x-gr-4 bottom-[max(env(safe-area-inset-bottom),89px)] z-30 flex items-center justify-between gap-gr-3 border border-[color:var(--color-line)] bg-paper px-gr-4 py-gr-2 text-[13px] shadow-paper-hover animate-softUp"
          style={{ borderRadius: "7px 13px 8px 11px" }}
        >
          <span className="font-mincho text-sumi/88 jp-text-discipline">{copy.undoDeleteMessage}</span>
          <button
            type="button"
            onClick={undoDelete}
            className="min-h-[44px] shrink-0 border border-[color:var(--color-line)] px-gr-3 py-gr-2 font-mincho text-[12px] tracking-mincho text-sumi transition-soft hover:bg-washi active:scale-[0.98]"
            style={{ borderRadius: "6px 10px 7px 9px" }}
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
            query={searchQuery}
            onQueryChange={setSearchQuery}
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
      ) : view.kind === "read" ? (
        <ReadMode
          note={currentNote}
          onBack={() => setView({ kind: "list" })}
          onEdit={() => setView({ kind: "editor", id: currentNote.id })}
        />
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
