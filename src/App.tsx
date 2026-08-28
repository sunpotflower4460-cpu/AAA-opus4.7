import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Note } from "./types/note";
import type { MonetizationState } from "./types/monetization";
import {
  getNotesPrimaryHealth,
  isRetryableSaveFailure,
  loadNotes,
  NOTES_STORAGE_KEY,
  saveNotes,
} from "./lib/storage";
import type { LoadResult, SaveResult } from "./lib/storage";
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
import { getSaveFailureMessage } from "./lib/saveFailureUi";
import { subscribeToNativeAppState } from "./lib/nativeAppLifecycle";
import {
  isNativeDurableSnapshotAvailable,
  persistNativeDurableSnapshot,
  readNativeDurableSnapshot,
} from "./lib/nativeDurableSnapshot";
import { AppShell } from "./components/AppShell";
import { NotesList } from "./components/NotesList";
import { NoteEditor } from "./components/NoteEditor";
import { ReadMode } from "./components/ReadMode";
import { PremiumSheet } from "./components/PremiumSheet";

type View = { kind: "list" } | { kind: "editor"; id: string } | { kind: "read"; id: string };
type DeletedNote = Note & { deletedAt: string };

const AUTOSAVE_DEBOUNCE_MS = 500;
const AUTOSAVE_MAX_WAIT_MS = 3_000;
const UNDO_TIMEOUT_MS = 10_000;

function notesSnapshotMatches(left: readonly Note[], right: readonly Note[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function hasRecoveryCandidate(result: LoadResult): boolean {
  return !result.ok && result.recoveryCandidate === true;
}

function canChooseStoredPrimary(result: LoadResult): boolean {
  return result.ok || result.storedPrimaryAvailable === true;
}

export default function App() {
  const [initialLoad] = useState(() => {
    const result = loadNotes();
    const recoveryPending = hasRecoveryCandidate(result);
    return {
      notes: result.notes,
      loadFailed: !result.ok,
      recoveryPending,
      storedPrimaryAvailable: canChooseStoredPrimary(result),
      recoveredCount: recoveryPending ? result.notes.length : 0,
      primaryHealth: getNotesPrimaryHealth(),
    };
  });
  // 同じ画面自身の中断保存だけを継続更新できるよう、mount寿命内で固定したIDを使う。
  const [persistenceWriterId] = useState(() => createId());
  const [nativeRecoveryInitiallyRequired] = useState(
    () =>
      isNativeDurableSnapshotAvailable() &&
      !initialLoad.recoveryPending &&
      (initialLoad.primaryHealth === "missing" ||
        initialLoad.primaryHealth === "invalid" ||
        initialLoad.primaryHealth === "unavailable"),
  );

  const [notes, setNotes] = useState<Note[]>(initialLoad.notes);
  const [view, setView] = useState<View>({ kind: "list" });
  const [searchQuery, setSearchQuery] = useState("");
  const [monetization, setMonetization] = useState<MonetizationState>(() =>
    loadMonetizationState(),
  );
  const [isPremiumSheetOpen, setIsPremiumSheetOpen] = useState(false);
  const [lastSaveResult, setLastSaveResult] = useState<SaveResult | null>(null);
  const [lastDeleted, setLastDeleted] = useState<DeletedNote | null>(null);
  // 復元候補がある場合は、汎用エラーと二重表示せず recovery banner 側で案内する。
  const [loadError, setLoadError] = useState<boolean>(
    initialLoad.loadFailed &&
      !initialLoad.recoveryPending &&
      !nativeRecoveryInitiallyRequired,
  );
  const [externalConflict, setExternalConflict] = useState(initialLoad.recoveryPending);
  const [canLoadStoredNotes, setCanLoadStoredNotes] = useState(
    initialLoad.storedPrimaryAvailable,
  );
  const [recoveryCandidateCount, setRecoveryCandidateCount] = useState(
    initialLoad.recoveredCount,
  );
  const [nativeBackupError, setNativeBackupError] = useState(false);
  const [nativeBackupRetryAllowed, setNativeBackupRetryAllowed] = useState(false);
  const [nativeRecoveryStatus, setNativeRecoveryStatus] = useState<
    "idle" | "checking" | "error"
  >(nativeRecoveryInitiallyRequired ? "checking" : "idle");

  const undoTimerRef = useRef<number | null>(null);
  const persistTimerRef = useRef<number | null>(null);

  // 破損復旧中は、ユーザーが復元内容を明示的に確定するまで保存禁止を維持する。
  const saveGuardRef = useRef<boolean>(
    initialLoad.loadFailed || nativeRecoveryInitiallyRequired,
  );
  // このタブ自身が変更したときだけ lifecycle flush を許可する。
  const notesDirtyRef = useRef(false);
  // debounce が連続入力で永遠に後ろ倒しにならないよう、dirty 区間の開始時刻を保持する。
  const dirtySinceRef = useRef<number | null>(null);
  // 最後に正常に読み込んだ / 保存した集合。保存直前の競合検知に使う。
  const baselineNotesRef = useRef<Note[]>(initialLoad.notes);
  const latestNotesRef = useRef(notes);
  const externalConflictRef = useRef(initialLoad.recoveryPending);
  const nativeRecoveryGateRef = useRef(nativeRecoveryInitiallyRequired);
  const nativeRecoveryProbeIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const persistDurableSnapshot = useCallback((snapshot: readonly Note[]) => {
    if (!isNativeDurableSnapshotAvailable()) return;

    void persistNativeDurableSnapshot(snapshot).then((ok) => {
      if (!mountedRef.current) return;
      setNativeBackupError(!ok);
      setNativeBackupRetryAllowed(
        !ok &&
          !notesDirtyRef.current &&
          !saveGuardRef.current &&
          !externalConflictRef.current,
      );
    });
  }, []);

  // pagehide は非常に早く来ることがあるため、paint 前に flush 用 snapshot を更新する。
  useLayoutEffect(() => {
    latestNotesRef.current = notes;
  }, [notes]);

  const clearPersistTimer = useCallback(() => {
    if (!persistTimerRef.current) return;
    window.clearTimeout(persistTimerRef.current);
    persistTimerRef.current = null;
  }, []);

  const markNotesDirty = useCallback(() => {
    // native復旧の確認中/読込障害中は、旧データを上書きし得る編集自体を開始させない。
    setNativeBackupRetryAllowed(false);
    if (nativeRecoveryGateRef.current) return false;

    if (externalConflictRef.current) {
      // recovery/conflict 中の編集は自動保存を再開せず、エディタにも停止理由を即時通知する。
      setLastSaveResult({ ok: false, reason: "conflict" });
    } else {
      saveGuardRef.current = false;
      setLastSaveResult(null);
    }
    if (!notesDirtyRef.current) dirtySinceRef.current = Date.now();
    notesDirtyRef.current = true;
    return true;
  }, []);

  const flagExternalConflict = useCallback(
    (
      storedReadable: boolean,
      alsoReportLoadError = false,
      visibleRecoveryCount = 0,
    ) => {
      clearPersistTimer();
      externalConflictRef.current = true;
      setExternalConflict(true);
      setCanLoadStoredNotes(storedReadable);
      setRecoveryCandidateCount(storedReadable ? 0 : visibleRecoveryCount);
      setLastSaveResult({ ok: false, reason: "conflict" });
      setNativeBackupRetryAllowed(false);
      // 状態が回復した後に古い汎用エラーが残らないよう、毎回現在状態へ揃える。
      setLoadError(alsoReportLoadError && visibleRecoveryCount === 0);
    },
    [clearPersistTimer],
  );

  const applyCleanRemoteNotes = useCallback((remoteNotes: Note[]) => {
    if (notesSnapshotMatches(remoteNotes, baselineNotesRef.current)) return;

    dirtySinceRef.current = null;
    baselineNotesRef.current = remoteNotes;
    latestNotesRef.current = remoteNotes;
    setNotes(remoteNotes);
    setLastSaveResult(null);
    setCanLoadStoredNotes(true);
  }, []);

  const refreshCleanNotesFromStorage = useCallback(() => {
    if (
      notesDirtyRef.current ||
      saveGuardRef.current ||
      externalConflictRef.current
    ) {
      return;
    }

    const remote = loadNotes();
    if (!remote.ok) {
      if (hasRecoveryCandidate(remote)) {
        // 空配列を含む中断保存も候補になり得るため、件数ではなく明示フラグで判定する。
        applyCleanRemoteNotes(remote.notes);
        flagExternalConflict(
          canChooseStoredPrimary(remote),
          false,
          remote.notes.length,
        );
      } else {
        flagExternalConflict(false, true);
      }
      return;
    }

    applyCleanRemoteNotes(remote.notes);
    // 正常な保存先を正式採用したら、native復旧層も同じ正本へ追従させる。
    // recovery candidate は上の !remote.ok 分岐なので、未確定候補をここで保存することはない。
    persistDurableSnapshot(remote.notes);
  }, [applyCleanRemoteNotes, flagExternalConflict, persistDurableSnapshot]);

  const applySaveResult = useCallback(
    (result: SaveResult, snapshot: Note[]) => {
      setLastSaveResult(result);

      if (result.ok) {
        notesDirtyRef.current = false;
        dirtySinceRef.current = null;
        saveGuardRef.current = false;
        baselineNotesRef.current = snapshot;
        externalConflictRef.current = false;
        setExternalConflict(false);
        setCanLoadStoredNotes(true);
        setRecoveryCandidateCount(0);
        setLoadError(false);
        persistDurableSnapshot(snapshot);
        return;
      }

      if (result.reason === "conflict") {
        // storage event が届く前に保存直前比較で競合した場合も、
        // 現在の保存先が読み込み可能かをここで判定する。
        const stored = loadNotes();
        const storedHasRecoveryCandidate = hasRecoveryCandidate(stored);
        // ここはローカル dirty 状態なので、remote の復元候補を勝手に画面へ適用しない。
        flagExternalConflict(
          canChooseStoredPrimary(stored),
          !stored.ok && !storedHasRecoveryCandidate,
        );
      }
    },
    [flagExternalConflict, persistDurableSnapshot],
  );

  const probeNativeRecovery = useCallback(async () => {
    const probeId = nativeRecoveryProbeIdRef.current + 1;
    nativeRecoveryProbeIdRef.current = probeId;
    nativeRecoveryGateRef.current = true;
    saveGuardRef.current = true;
    clearPersistTimer();
    setNativeRecoveryStatus("checking");

    const nativeResult = await readNativeDurableSnapshot();
    if (!mountedRef.current || nativeRecoveryProbeIdRef.current != probeId) return;

    const primaryHealth = getNotesPrimaryHealth();

    // probe中に別タブ等から正常primaryが到着した場合は、その現在値を正本として採用する。
    if (primaryHealth === "valid") {
      const current = loadNotes();
      nativeRecoveryGateRef.current = false;
      setNativeRecoveryStatus("idle");
      if (current.ok) {
        saveGuardRef.current = false;
        applyCleanRemoteNotes(current.notes);
        setLoadError(false);
        persistDurableSnapshot(current.notes);
      } else {
        flagExternalConflict(
          canChooseStoredPrimary(current),
          !hasRecoveryCandidate(current),
          hasRecoveryCandidate(current) ? current.notes.length : 0,
        );
      }
      return;
    }

    // localStorage自体を読めない状態では、nativeの結果だけで上書き可否を決めない。
    if (primaryHealth === "unavailable" || nativeResult.status === "error") {
      nativeRecoveryGateRef.current = true;
      saveGuardRef.current = true;
      setNativeRecoveryStatus("error");
      setNativeBackupRetryAllowed(false);
      setLoadError(false);
      return;
    }

    if (nativeResult.status === "available") {
      const nativeSnapshot = nativeResult.notes;
      nativeRecoveryGateRef.current = false;
      setNativeRecoveryStatus("idle");
      saveGuardRef.current = true;
      externalConflictRef.current = true;
      dirtySinceRef.current = null;
      baselineNotesRef.current = nativeSnapshot;
      latestNotesRef.current = nativeSnapshot;
      setNotes(nativeSnapshot);
      setLastSaveResult({ ok: false, reason: "conflict" });
      setExternalConflict(true);
      setCanLoadStoredNotes(false);
      setRecoveryCandidateCount(nativeSnapshot.length);
      setLoadError(false);
      setNativeBackupError(false);
      setNativeBackupRetryAllowed(false);
      return;
    }

    if (primaryHealth === "invalid") {
      nativeRecoveryGateRef.current = false;
      setNativeRecoveryStatus("idle");
      saveGuardRef.current = true;
      flagExternalConflict(false, false);
      return;
    }

    // local primary と native primary/backup の不存在をすべて正常確認できた時だけfresh installとして解放する。
    nativeRecoveryGateRef.current = false;
    setNativeRecoveryStatus("idle");
    saveGuardRef.current = false;
    setLoadError(false);
  }, [
    applyCleanRemoteNotes,
    clearPersistTimer,
    flagExternalConflict,
    persistDurableSnapshot,
  ]);

  useEffect(() => {
    if (!isNativeDurableSnapshotAvailable()) return undefined;

    if (nativeRecoveryInitiallyRequired) {
      // 初期state/refですでに編集・保存はgate済み。probeのstate通知はeffect本体の外で開始する。
      queueMicrotask(() => {
        void probeNativeRecovery();
      });
      return () => {
        nativeRecoveryProbeIdRef.current += 1;
      };
    }

    // 正常localStorageがある既存ユーザーは初回Phase38起動でnative耐久層へ移行する。
    if (initialLoad.primaryHealth === "valid" && !initialLoad.loadFailed) {
      persistDurableSnapshot(baselineNotesRef.current);
    }
    return undefined;
  }, [
    initialLoad.loadFailed,
    initialLoad.primaryHealth,
    nativeRecoveryInitiallyRequired,
    persistDurableSnapshot,
    probeNativeRecovery,
  ]);

  const retryNativeRecovery = useCallback(() => {
    void probeNativeRecovery();
  }, [probeNativeRecovery]);

  useEffect(() => {
    clearPersistTimer();

    if (
      saveGuardRef.current ||
      externalConflictRef.current ||
      !notesDirtyRef.current
    ) {
      return undefined;
    }

    const dirtyForMs =
      dirtySinceRef.current === null ? 0 : Math.max(0, Date.now() - dirtySinceRef.current);
    const maxWaitRemainingMs = Math.max(0, AUTOSAVE_MAX_WAIT_MS - dirtyForMs);
    const delayMs = Math.min(AUTOSAVE_DEBOUNCE_MS, maxWaitRemainingMs);

    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null;
      if (
        saveGuardRef.current ||
        externalConflictRef.current ||
        !notesDirtyRef.current
      ) {
        return;
      }

      const result = saveNotes(notes, {
        expectedNotes: baselineNotesRef.current,
        writerId: persistenceWriterId,
      });
      applySaveResult(result, notes);
    }, delayMs);

    return clearPersistTimer;
  }, [notes, applySaveResult, clearPersistTimer, persistenceWriterId]);

  const flushPendingNotes = useCallback(() => {
    if (
      saveGuardRef.current ||
      externalConflictRef.current ||
      !notesDirtyRef.current
    ) {
      return;
    }

    const snapshot = latestNotesRef.current;
    const result = saveNotes(snapshot, {
      expectedNotes: baselineNotesRef.current,
      writerId: persistenceWriterId,
    });
    applySaveResult(result, snapshot);
  }, [applySaveResult, persistenceWriterId]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushPendingNotes();
      } else {
        // iOS/WKWebView の復帰や長時間 suspend 後は storage event を取りこぼすことがあるため、
        // ローカル未編集のときだけ保存先を再確認する。
        refreshCleanNotesFromStorage();
      }
    };

    window.addEventListener("beforeunload", flushPendingNotes);
    window.addEventListener("pagehide", flushPendingNotes);
    window.addEventListener("pageshow", refreshCleanNotesFromStorage);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", flushPendingNotes);
      window.removeEventListener("pagehide", flushPendingNotes);
      window.removeEventListener("pageshow", refreshCleanNotesFromStorage);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [flushPendingNotes, refreshCleanNotesFromStorage]);

  useEffect(() => {
    // WKWebView の DOM lifecycle だけに依存せず、iOS native 側の active/inactive も保存境界にする。
    // DOM と native の両方が発火しても、dirty/no-op guard により二重保存は安全に抑止される。
    return subscribeToNativeAppState(({ isActive }) => {
      if (isActive) {
        refreshCleanNotesFromStorage();
      } else {
        flushPendingNotes();
      }
    });
  }, [flushPendingNotes, refreshCleanNotesFromStorage]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      const notesStorageChanged = event.key === null || event.key === NOTES_STORAGE_KEY;

      if (notesStorageChanged) {
        // startup native probe中のstorage変更はprobe完了時に現在primaryを再評価する。
        // ここで競合扱いにすると、ユーザー編集が無いのに不要なconflictへ昇格してしまう。
        if (nativeRecoveryGateRef.current) return;

        const remote = loadNotes();
        const locallyClean =
          !notesDirtyRef.current &&
          !saveGuardRef.current &&
          !externalConflictRef.current;

        if (!remote.ok) {
          const remoteHasRecoveryCandidate = hasRecoveryCandidate(remote);
          if (locallyClean && remoteHasRecoveryCandidate) {
            applyCleanRemoteNotes(remote.notes);
            flagExternalConflict(
              canChooseStoredPrimary(remote),
              false,
              remote.notes.length,
            );
          } else {
            // dirty 中はローカル内容を守り、remote の復元候補を勝手に適用しない。
            flagExternalConflict(
              canChooseStoredPrimary(remote),
              !remoteHasRecoveryCandidate,
            );
          }
        } else if (!locallyClean) {
          // ローカル未保存編集がある間は、外部変更を勝手に採用も上書きもしない。
          flagExternalConflict(true);
        } else {
          // この画面が未編集なら、別タブの最新状態へ安全に追従する。
          applyCleanRemoteNotes(remote.notes);
          persistDurableSnapshot(remote.notes);
        }
      }

      // Premium は初回リリースでは無効だが、将来の別タブ同期を維持する。
      if (event.key === null || event.key !== NOTES_STORAGE_KEY) {
        setMonetization(loadMonetizationState());
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [applyCleanRemoteNotes, flagExternalConflict, persistDurableSnapshot]);

  useEffect(() => {
    return () => {
      clearPersistTimer();
      if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    };
  }, [clearPersistTimer]);

  const createNote = useCallback(() => {
    if (!markNotesDirty()) return;
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
      if (!markNotesDirty()) return;
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

      if (!markNotesDirty()) return;

      if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
      const deleted: DeletedNote = { ...target, deletedAt: nowIso() };
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
    if (!lastDeleted || !markNotesDirty()) return;

    if (undoTimerRef.current) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }

    const { deletedAt: _, ...note } = lastDeleted;
    setNotes((prev) => (prev.some((item) => item.id === note.id) ? prev : [note, ...prev]));
    setLastDeleted(null);
  }, [lastDeleted, markNotesDirty]);

  const loadStoredNotes = useCallback(() => {
    // pending candidate と正常 primary の両方がある場合は、候補を退避してから primary を明示採用する。
    const result = loadNotes({ resolvePendingSave: "prefer_primary" });
    if (!result.ok) {
      setCanLoadStoredNotes(canChooseStoredPrimary(result));
      setLoadError(!hasRecoveryCandidate(result));
      return;
    }

    clearPersistTimer();
    if (undoTimerRef.current) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }

    notesDirtyRef.current = false;
    dirtySinceRef.current = null;
    saveGuardRef.current = false;
    externalConflictRef.current = false;
    baselineNotesRef.current = result.notes;
    latestNotesRef.current = result.notes;

    setNotes(result.notes);
    setLastDeleted(null);
    // エディタが conflict error のまま残らないよう、採用した保存先状態を正常として通知する。
    setLastSaveResult({ ok: true });
    setExternalConflict(false);
    setCanLoadStoredNotes(true);
    setRecoveryCandidateCount(0);
    setLoadError(false);
    // ユーザーが保存済み版を正本として明示採用したので、古いnative候補を残さない。
    persistDurableSnapshot(result.notes);
  }, [clearPersistTimer, persistDurableSnapshot]);

  const forceSaveCurrentNotes = useCallback(() => {
    clearPersistTimer();
    const snapshot = latestNotesRef.current;
    const result = saveNotes(snapshot, {
      force: true,
      writerId: persistenceWriterId,
    });
    applySaveResult(result, snapshot);
    if (result.ok) setLoadError(false);
  }, [applySaveResult, clearPersistTimer, persistenceWriterId]);

  const retrySaveCurrentNotes = useCallback(() => {
    clearPersistTimer();
    // conflict/recovery は専用UIの明示選択でのみ解決する。通常Retryで force しない。
    if (saveGuardRef.current || externalConflictRef.current) return;

    const snapshot = latestNotesRef.current;
    const result = saveNotes(snapshot, {
      expectedNotes: baselineNotesRef.current,
      writerId: persistenceWriterId,
    });
    applySaveResult(result, snapshot);
  }, [applySaveResult, clearPersistTimer, persistenceWriterId]);

  const retryNativeBackup = useCallback(() => {
    if (
      notesDirtyRef.current ||
      saveGuardRef.current ||
      externalConflictRef.current
    ) {
      return;
    }
    persistDurableSnapshot(baselineNotesRef.current);
  }, [persistDurableSnapshot]);

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
      setMonetization(await restorePurchasesMock());
    } catch (error) {
      console.error("Purchase restore failed", error);
      setMonetization((prev) => ({ ...prev, purchaseStatus: "error" }));
    }
  }, []);

  const currentNote = useMemo<Note | undefined>(() => {
    if (view.kind === "list") return undefined;
    return notes.find((note) => note.id === view.id);
  }, [view, notes]);

  const globalSaveFailureMessage = getSaveFailureMessage(lastSaveResult);
  const showGlobalSaveFailure =
    globalSaveFailureMessage !== null && (view.kind !== "editor" || !currentNote);
  const canRetryGlobalSave =
    showGlobalSaveFailure &&
    !externalConflict &&
    isRetryableSaveFailure(lastSaveResult);
  const canRetryNativeBackup =
    nativeBackupError && nativeBackupRetryAllowed && !externalConflict;

  useEffect(() => {
    if (view.kind !== "list" && !currentNote) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setView({ kind: "list" });
    }
  }, [view, currentNote]);

  return (
    <AppShell>
      {(loadError ||
        externalConflict ||
        showGlobalSaveFailure ||
        nativeBackupError ||
        nativeRecoveryStatus !== "idle") && (
        <div className="pointer-events-none fixed inset-x-gr-4 top-[max(env(safe-area-inset-top),12px)] z-30 flex flex-col gap-gr-2">
          {nativeRecoveryStatus === "checking" && (
            <div
              data-testid="native-recovery-checking"
              role="status"
              aria-live="polite"
              className="pointer-events-auto border border-gold/25 bg-paper px-gr-4 py-gr-3 font-mincho text-[12px] leading-ample text-sumi shadow-paper-hover animate-fadeIn"
              style={{ borderRadius: "7px 13px 8px 11px" }}
            >
              {copy.nativeRecoveryChecking}
            </div>
          )}

          {nativeRecoveryStatus === "error" && (
            <div
              data-testid="native-recovery-error"
              role="alert"
              aria-live="assertive"
              className="pointer-events-auto flex flex-wrap items-center justify-between gap-gr-3 border border-vermilion/30 bg-paper px-gr-4 py-gr-3 text-sumi shadow-paper-hover animate-fadeIn"
              style={{ borderRadius: "7px 13px 8px 11px" }}
            >
              <span className="font-mincho text-[12px] leading-ample jp-text-discipline">
                {copy.nativeRecoveryReadError}
              </span>
              <button
                type="button"
                onClick={retryNativeRecovery}
                className="min-h-[44px] shrink-0 rounded-full border border-gold/35 px-gr-3 py-gr-2 font-mincho text-[11px] tracking-mincho text-sumi transition-soft hover:bg-washi active:scale-[0.98]"
              >
                {copy.nativeRecoveryRetry}
              </button>
            </div>
          )}

          {loadError && (
            <div
              role="alert"
              aria-live="assertive"
              className="pointer-events-auto flex items-center justify-between gap-gr-3 border border-vermilion/30 bg-paper px-gr-4 py-gr-2 text-[12px] leading-ample text-vermilion shadow-paper-hover animate-fadeIn"
              style={{ borderRadius: "7px 13px 8px 11px" }}
            >
              <span className="font-mincho jp-text-discipline">
                データの読み込みに問題がありました。メモが復元できない可能性があります。
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

          {externalConflict && (
            <div
              role="alert"
              aria-live="assertive"
              className="pointer-events-auto border border-gold/35 bg-paper px-gr-4 py-gr-3 text-sumi shadow-paper-hover animate-fadeIn"
              style={{ borderRadius: "7px 13px 8px 11px" }}
            >
              <p className="font-mincho text-[14px] tracking-mincho jp-text-discipline">
                {canLoadStoredNotes ? copy.storageConflictTitle : copy.storageRecoveryTitle}
              </p>
              <p className="mt-gr-2 text-[12px] leading-ample text-ink-muted jp-text-discipline">
                {!canLoadStoredNotes && recoveryCandidateCount > 0 && (
                  <span className="mb-gr-1 block">
                    {copy.storageRecoveryCandidateCount(recoveryCandidateCount)}
                  </span>
                )}
                {canLoadStoredNotes
                  ? copy.storageConflictBody
                  : copy.storageConflictRecoveryBody}
              </p>
              <div className="mt-gr-3 flex flex-wrap justify-end gap-gr-2">
                {canLoadStoredNotes && (
                  <button
                    type="button"
                    onClick={loadStoredNotes}
                    className="min-h-[44px] border border-[color:var(--color-line)] px-gr-3 py-gr-2 font-mincho text-[12px] text-sumi transition-soft hover:bg-washi active:scale-[0.98]"
                    style={{ borderRadius: "6px 10px 7px 9px" }}
                  >
                    {copy.storageConflictLoad}
                  </button>
                )}
                <button
                  type="button"
                  onClick={forceSaveCurrentNotes}
                  className="min-h-[44px] bg-sumi px-gr-3 py-gr-2 font-mincho text-[12px] text-washi transition-soft hover:bg-indigo active:scale-[0.98]"
                  style={{ borderRadius: "6px 10px 7px 9px" }}
                >
                  {canLoadStoredNotes
                    ? copy.storageConflictOverwrite
                    : copy.storageRecoverySave}
                </button>
              </div>
            </div>
          )}


          {nativeBackupError && (
            <div
              data-testid="native-backup-failure"
              role="alert"
              aria-live="polite"
              className="pointer-events-auto flex flex-wrap items-center justify-between gap-gr-3 border border-gold/35 bg-paper px-gr-4 py-gr-3 text-sumi shadow-paper-hover animate-fadeIn"
              style={{ borderRadius: "7px 13px 8px 11px" }}
            >
              <span className="font-mincho text-[12px] leading-ample jp-text-discipline">
                {copy.nativeBackupError}
              </span>
              {canRetryNativeBackup && (
                <button
                  type="button"
                  onClick={retryNativeBackup}
                  className="min-h-[44px] shrink-0 rounded-full border border-gold/35 px-gr-3 py-gr-2 font-mincho text-[11px] tracking-mincho text-sumi transition-soft hover:bg-washi active:scale-[0.98]"
                >
                  {copy.nativeBackupRetry}
                </button>
              )}
            </div>
          )}

          {showGlobalSaveFailure && globalSaveFailureMessage && (
            <div
              data-testid="global-save-failure"
              role="alert"
              aria-live="assertive"
              className="pointer-events-auto flex flex-wrap items-center justify-between gap-gr-3 border border-vermilion/30 bg-paper px-gr-4 py-gr-3 text-vermilion shadow-paper-hover animate-fadeIn"
              style={{ borderRadius: "7px 13px 8px 11px" }}
            >
              <span className="font-mincho text-[12px] leading-ample jp-text-discipline">
                {globalSaveFailureMessage}
              </span>
              {canRetryGlobalSave && (
                <button
                  type="button"
                  onClick={retrySaveCurrentNotes}
                  className="min-h-[44px] shrink-0 rounded-full border border-vermilion/30 px-gr-3 py-gr-2 font-mincho text-[11px] tracking-mincho text-vermilion transition-soft hover:bg-vermilion/5 active:scale-[0.98]"
                >
                  {copy.retrySave}
                </button>
              )}
            </div>
          )}
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
          saveResult={lastSaveResult}
          conflictMessage={canLoadStoredNotes ? copy.saveConflict : copy.saveRecovery}
          onRetrySave={externalConflict ? undefined : retrySaveCurrentNotes}
        />
      )}
    </AppShell>
  );
}
