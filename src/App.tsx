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
  discardProtectedRecoveryCandidate,
  getNotesPrimaryHealth,
  isRetryableSaveFailure,
  listProtectedRecoveryCandidates,
  loadNotes,
  NOTES_STORAGE_KEY,
  readPrimaryForReview,
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
import { I18nProvider } from "./i18n/I18nProvider";
import { useI18n } from "./i18n/useI18n";
import { createUiPreferences, type UiPreferences } from "./lib/uiPreferences";
import { UNDO_SECONDS } from "./lib/noteLimits";
import type { ReadingPosition } from "./lib/readingPosition";
import { getSaveFailureMessage } from "./lib/saveFailureUi";
import { subscribeToNativeAppState } from "./lib/nativeAppLifecycle";
import { recordDraftRescue } from "./lib/draftRescue";
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
import { RecoveryReview, type ReviewCandidate } from "./components/RecoveryReview";
import { AboutScreen } from "./components/AboutScreen";

// editor の origin は戻り先と戻る操作の名前を決める（D06）。
// new: 「メモを書く」から開いた新規 / read: 読み返しから「編集する」で開いた既存メモ
type View =
  | { kind: "list" }
  | { kind: "editor"; id: string; origin: "new" | "read"; position?: ReadingPosition }
  | { kind: "read"; id: string; position?: ReadingPosition };

// 一覧へ戻る時に復元する文脈。保存した座標は補助で、対象カードの ID を優先する。
type ListRestore = { cardId: string | null; scrollY: number };
type DeletedNote = { note: Note; expiresAt: number };
type RecoveryCandidateSource = "screen" | "local" | "native";

const AUTOSAVE_DEBOUNCE_MS = 500;
const AUTOSAVE_MAX_WAIT_MS = 3_000;
const UNDO_TIMEOUT_MS = UNDO_SECONDS * 1_000;

function notesSnapshotMatches(left: readonly Note[], right: readonly Note[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function hasRecoveryCandidate(result: LoadResult): boolean {
  return !result.ok && result.recoveryCandidate === true;
}

function canChooseStoredPrimary(result: LoadResult): boolean {
  return result.ok || result.storedPrimaryAvailable === true;
}

export default function App({ preferences }: { preferences?: UiPreferences } = {}) {
  const [store] = useState(() => preferences ?? createUiPreferences());
  return (
    <I18nProvider preferences={store}>
      <NotesApp />
    </I18nProvider>
  );
}

function NotesApp() {
  const { copy, preferences } = useI18n();
  const [initialLoad] = useState(() => {
    const result = loadNotes({ checkFreshInstall: true });
    const recoveryPending = hasRecoveryCandidate(result);
    return {
      notes: result.notes,
      loadFailed: !result.ok,
      recoveryPending,
      storedPrimaryAvailable: canChooseStoredPrimary(result),
      recoveredCount: recoveryPending ? result.notes.length : 0,
      primaryHealth: getNotesPrimaryHealth(),
      freshInstall: result.ok && result.freshInstall === true,
    };
  });
  // 同じ画面自身の中断保存だけを継続更新できるよう、mount寿命内で固定したIDを使う。
  const [persistenceWriterId] = useState(() => createId());
  // native環境では localStorage が正常でも、端末内耐久層との不一致を確認するまで
  // 編集・保存を開始しない。localだけを信頼してnativeを即上書きすると、古いlocalで
  // より新しいnative snapshotを世代送りする可能性があるため。
  const [nativeRecoveryInitiallyRequired] = useState(
    () => isNativeDurableSnapshotAvailable(),
  );

  const [notes, setNotes] = useState<Note[]>(initialLoad.notes);
  const [view, setView] = useState<View>({ kind: "list" });
  // 「メモを書く」で作ったまま、まだ何も入力・変更していない新規下書き（R15）。
  // 既存メモが空であることとは別の概念で、入力後に消したメモは含まない。
  const [untouchedDraftId, setUntouchedDraftId] = useState<string | null>(null);
  const listRestoreRef = useRef<ListRestore | null>(null);
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
  // 保護している復元候補の枠が満杯で、この画面の内容を保存できない状態（R34）。
  const [archiveFull, setArchiveFull] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const aboutTriggerRef = useRef<HTMLButtonElement | null>(null);
  const reviewTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [nativeConfirmedMissing, setNativeConfirmedMissing] = useState(false);
  // 削除が保存先へまだ確定していない（確定する保存が成功するまで true）。
  const [deleteUnconfirmed, setDeleteUnconfirmed] = useState(false);
  const [reviewCandidates, setReviewCandidates] = useState<ReviewCandidate[]>([]);
  // 編集の世代。保存・予備保存の結果が「いま表示している版」に対するものか判定する（R35）。
  // 日時や件数ではなく、この画面が受け取った変更の通し番号。永続化しない。
  const editVersionRef = useRef(0);
  const [editVersion, setEditVersion] = useState(0);
  // 端末内の予備保存の更新に失敗した版。現在の版と一致する間だけ警告にする。
  const [nativeBackupErrorVersion, setNativeBackupErrorVersion] = useState<number | null>(null);
  const [nativeBackupRetryAllowed, setNativeBackupRetryAllowed] = useState(false);
  const [nativeRecoveryStatus, setNativeRecoveryStatus] = useState<
    "idle" | "checking" | "error"
  >(nativeRecoveryInitiallyRequired ? "checking" : "idle");
  const [nativeRecoveryAlternativeCount, setNativeRecoveryAlternativeCount] = useState<
    number | null
  >(null);
  const [recoveryCandidateSource, setRecoveryCandidateSource] =
    useState<RecoveryCandidateSource>("local");
  // null は候補なし。0 件でも比較できる候補は存在する。
  const [screenRecoveryCandidateCount, setScreenRecoveryCandidateCount] = useState<
    number | null
  >(null);
  const [runtimeRecoveryProbeVersion, setRuntimeRecoveryProbeVersion] = useState(0);

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
  const screenRecoveryCandidateRef = useRef<Note[] | null>(null);
  const localRecoveryCandidateRef = useRef<Note[] | null>(
    initialLoad.recoveryPending ? initialLoad.notes : null,
  );
  const nativeRecoveryAlternativeRef = useRef<Note[] | null>(null);
  const nativeOnlyCandidateRef = useRef<Note[] | null>(null);
  const recoveryCandidateSourceRef = useRef<RecoveryCandidateSource>("local");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const persistDurableSnapshot = useCallback((snapshot: readonly Note[]) => {
    if (!isNativeDurableSnapshotAvailable()) return;

    const versionAtRequest = editVersionRef.current;
    void persistNativeDurableSnapshot(snapshot).then((ok) => {
      if (!mountedRef.current) return;
      // 結果が返るまでに新しい入力があれば、その結果は古い版のもの。
      // 新しい版の保存・予備保存が自分の結果を出すので、ここでは表示を動かさない。
      if (editVersionRef.current !== versionAtRequest) return;
      setNativeBackupErrorVersion(ok ? null : versionAtRequest);
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
    if (!externalConflictRef.current) return;

    if (
      recoveryCandidateSourceRef.current === "screen" &&
      screenRecoveryCandidateRef.current !== null
    ) {
      screenRecoveryCandidateRef.current = notes;
      setScreenRecoveryCandidateCount(notes.length);
      setRecoveryCandidateCount(notes.length);
    } else if (
      recoveryCandidateSourceRef.current === "local" &&
      localRecoveryCandidateRef.current !== null
    ) {
      localRecoveryCandidateRef.current = notes;
      setRecoveryCandidateCount(notes.length);
    } else if (
      recoveryCandidateSourceRef.current === "native" &&
      nativeRecoveryAlternativeRef.current !== null
    ) {
      nativeRecoveryAlternativeRef.current = notes;
      setNativeRecoveryAlternativeCount(notes.length);
      setRecoveryCandidateCount(notes.length);
    }
  }, [notes]);

  // 描画例外で App が破棄されても、最後に受け取った内容へ届けるための控え（R33）。
  // 保存層には一切書かない。取り出し専用で、保存先で確認できている版との差も一緒に持つ。
  useLayoutEffect(() => {
    recordDraftRescue(notes, baselineNotesRef.current);
  }, [notes, lastSaveResult]);

  const clearPersistTimer = useCallback(() => {
    if (!persistTimerRef.current) return;
    window.clearTimeout(persistTimerRef.current);
    persistTimerRef.current = null;
  }, []);

  const markNotesDirty = useCallback(() => {
    // native復旧の確認中/読込障害中は、旧データを上書きし得る編集自体を開始させない。
    setNativeBackupRetryAllowed(false);
    if (nativeRecoveryGateRef.current) return false;

    editVersionRef.current += 1;
    setEditVersion(editVersionRef.current);

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

  const clearRecoveryCandidateSources = useCallback(() => {
    screenRecoveryCandidateRef.current = null;
    nativeOnlyCandidateRef.current = null;
    localRecoveryCandidateRef.current = null;
    nativeRecoveryAlternativeRef.current = null;
    recoveryCandidateSourceRef.current = "local";
    setRecoveryCandidateSource("local");
    setScreenRecoveryCandidateCount(null);
    setNativeRecoveryAlternativeCount(null);
  }, []);

  const registerLocalRecoveryCandidate = useCallback((snapshot: Note[]) => {
    localRecoveryCandidateRef.current = snapshot;
    nativeRecoveryAlternativeRef.current = null;
    recoveryCandidateSourceRef.current = "local";
    setRecoveryCandidateSource("local");
    setNativeRecoveryAlternativeCount(null);

    if (!isNativeDurableSnapshotAvailable()) return;
    nativeRecoveryGateRef.current = true;
    saveGuardRef.current = true;
    clearPersistTimer();
    setNativeRecoveryStatus("checking");
    setRuntimeRecoveryProbeVersion((version) => version + 1);
  }, [clearPersistTimer]);

  const registerDirtyRecoveryCandidate = useCallback(
    (remoteSnapshot: Note[]) => {
      // dirty screen は remote candidate と絶対に同じ ref へ入れない。
      // 既に三者競合中なら最初に捕捉した screen を維持し、表示中の local/native で上書きしない。
      if (screenRecoveryCandidateRef.current === null) {
        const screenSnapshot = latestNotesRef.current;
        screenRecoveryCandidateRef.current = screenSnapshot;
        recoveryCandidateSourceRef.current = "screen";
        setRecoveryCandidateSource("screen");
        setScreenRecoveryCandidateCount(screenSnapshot.length);
      }

      // 一度ユーザーへ提示した local 候補は、その後の storage event で自動置換しない。
      // 候補を表示中にユーザーが編集していても、別タブの新しい recovery で上書きしないため。
      // 新しい remote 世代自体は保存層に残り、force 確定時の conflict archive で保全される。
      if (localRecoveryCandidateRef.current === null) {
        localRecoveryCandidateRef.current = remoteSnapshot;
        if (recoveryCandidateSourceRef.current === "local") {
          latestNotesRef.current = remoteSnapshot;
          setNotes(remoteSnapshot);
          setRecoveryCandidateCount(remoteSnapshot.length);
        }
      }

      if (!isNativeDurableSnapshotAvailable()) return;
      nativeRecoveryGateRef.current = true;
      saveGuardRef.current = true;
      clearPersistTimer();
      setNativeRecoveryStatus("checking");
      setRuntimeRecoveryProbeVersion((version) => version + 1);
    },
    [clearPersistTimer],
  );

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
        registerLocalRecoveryCandidate(remote.notes);
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

    if (
      isNativeDurableSnapshotAvailable() &&
      !notesSnapshotMatches(remote.notes, baselineNotesRef.current)
    ) {
      // 復帰時にlocalだけが既知の正本と異なる「正常形式の版」へ変わっていても、
      // 形式が正しいという理由だけで採用せず、native予備保存へも渡さない（R03）。
      // 起動時と同じ比較（probeNativeRecovery）へ送り、同一または不存在を確認できた時だけ
      // 解放し、異なる有効版・読込失敗は編集を止めて利用者の選択／再確認へ回す。
      // 日時の新旧から正しい版を推測しない。
      registerLocalRecoveryCandidate(remote.notes);
      return;
    }

    applyCleanRemoteNotes(remote.notes);
    // 正常な保存先を正式採用したら、native復旧層も同じ正本へ追従させる。
    // recovery candidate は上の !remote.ok 分岐なので、未確定候補をここで保存することはない。
    persistDurableSnapshot(remote.notes);
  }, [
    applyCleanRemoteNotes,
    flagExternalConflict,
    persistDurableSnapshot,
    registerLocalRecoveryCandidate,
  ]);

  const applySaveResult = useCallback(
    (result: SaveResult, snapshot: Note[]) => {
      setLastSaveResult(result);

      if (!result.ok && result.reason === "recovery_archive_full") {
        // 満杯は通常の競合とは別の理由。画面の内容も保護候補も触らず、確認と整理へ案内する。
        setArchiveFull(true);
        return;
      }

      if (result.ok) {
        setArchiveFull(false);
        setDeleteUnconfirmed(false);
        notesDirtyRef.current = false;
        dirtySinceRef.current = null;
        saveGuardRef.current = false;
        baselineNotesRef.current = snapshot;
        externalConflictRef.current = false;
        setExternalConflict(false);
        setCanLoadStoredNotes(true);
        setRecoveryCandidateCount(0);
        setLoadError(false);
        clearRecoveryCandidateSources();
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
    [clearRecoveryCandidateSources, flagExternalConflict, persistDurableSnapshot],
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
    const screenRecoveryCandidate = screenRecoveryCandidateRef.current;
    const localRecoveryCandidate = localRecoveryCandidateRef.current;

    // dirty screen と remote local recovery を両方捕捉済みなら、clean recovery 用分岐へ入れない。
    // probe中に正常primaryが戻っても screen を自動破棄せず、保存先版は既存のload actionで選択可能にする。
    if (screenRecoveryCandidate !== null && localRecoveryCandidate !== null) {
      const current = loadNotes();
      const latestLocalCandidate = localRecoveryCandidate;
      const currentStoredRecoveryCandidate =
        !current.ok && hasRecoveryCandidate(current) ? current.notes : null;

      // probe 中に保存層の recovery 世代が変わっても、すでに提示済みの local 候補を
      // 自動置換しない。active local 候補へのユーザー編集を非同期 probe で失わないため。
      setCanLoadStoredNotes(canChooseStoredPrimary(current));

      if (primaryHealth === "unavailable" || nativeResult.status === "error") {
        nativeRecoveryGateRef.current = true;
        saveGuardRef.current = true;
        setNativeRecoveryStatus("error");
        setNativeBackupRetryAllowed(false);
        setLoadError(false);
        return;
      }

      if (nativeResult.status === "available") {
        const duplicatesKnownCandidate =
          notesSnapshotMatches(nativeResult.notes, screenRecoveryCandidate) ||
          notesSnapshotMatches(nativeResult.notes, latestLocalCandidate) ||
          (currentStoredRecoveryCandidate !== null &&
            notesSnapshotMatches(nativeResult.notes, currentStoredRecoveryCandidate)) ||
          (current.ok && notesSnapshotMatches(nativeResult.notes, current.notes));

        if (
          !duplicatesKnownCandidate &&
          nativeRecoveryAlternativeRef.current === null
        ) {
          // 一度提示した native 候補は、後続 probe で自動置換しない。
          // conflict 中にその候補をユーザーが編集していても非同期 read で失わないため。
          nativeRecoveryAlternativeRef.current = nativeResult.notes;
          setNativeRecoveryAlternativeCount(nativeResult.notes.length);
        }
      }

      nativeRecoveryGateRef.current = false;
      setNativeRecoveryStatus("idle");
      saveGuardRef.current = true;
      externalConflictRef.current = true;
      setExternalConflict(true);
      setNativeBackupRetryAllowed(false);
      setLoadError(false);
      return;
    }

    // localStorage 側にも復元候補がある時は native を自動採用・自動mergeしない。
    // 現在の local 候補を再確認し、異なる native 世代があれば別候補として保持する。
    if (localRecoveryCandidate !== null) {
      const current = loadNotes();
      if (current.ok) {
        // probe中にlocal primaryが正常へ戻っても、native結果との比較を飛ばさない。
        // 下の通常primary/native判定へ合流し、異なる世代を自動上書きしない。
        localRecoveryCandidateRef.current = null;
      }

      if (hasRecoveryCandidate(current)) {
        const currentCandidate = current.notes;
        localRecoveryCandidateRef.current = currentCandidate;
        if (recoveryCandidateSourceRef.current === "local") {
          baselineNotesRef.current = currentCandidate;
          latestNotesRef.current = currentCandidate;
          setNotes(currentCandidate);
          setRecoveryCandidateCount(currentCandidate.length);
        }
        setCanLoadStoredNotes(canChooseStoredPrimary(current));

        if (primaryHealth === "unavailable" || nativeResult.status === "error") {
          nativeRecoveryGateRef.current = true;
          saveGuardRef.current = true;
          setNativeRecoveryStatus("error");
          setNativeBackupRetryAllowed(false);
          setLoadError(false);
          return;
        }

        if (
          nativeResult.status === "available" &&
          !notesSnapshotMatches(nativeResult.notes, currentCandidate)
        ) {
          nativeRecoveryAlternativeRef.current = nativeResult.notes;
          setNativeRecoveryAlternativeCount(nativeResult.notes.length);
        } else {
          nativeRecoveryAlternativeRef.current = null;
          setNativeRecoveryAlternativeCount(null);
          if (recoveryCandidateSourceRef.current === "native") {
            recoveryCandidateSourceRef.current = "local";
            setRecoveryCandidateSource("local");
          }
        }

        nativeRecoveryGateRef.current = false;
        setNativeRecoveryStatus("idle");
        saveGuardRef.current = true;
        externalConflictRef.current = true;
        setExternalConflict(true);
        setLoadError(false);
        return;
      }

      // local candidate が外部要因で消えた場合は通常の primary/native 判定へ戻す。
      localRecoveryCandidateRef.current = null;
    }

    // 正常local primaryがある場合も、native safety probeの結果を比較してから正本を確定する。
    // localとnativeのどちらが新しいかをupdatedAt等から推測せず、不一致は明示選択へ送る。
    if (primaryHealth === "valid") {
      const current = loadNotes();
      if (!current.ok) {
        if (hasRecoveryCandidate(current)) {
          // primary health確認後に別タブ等がpending/recovery候補を追加した場合、
          // mixed-timeの判定で解決せず候補を登録してnativeを再probeする。
          // storage eventはnative gate中に抑止されるため、ここで明示的に拾う必要がある。
          registerLocalRecoveryCandidate(current.notes);
          return;
        }

        // 2回目のlocal readが失敗した場合も「checking」のまま固定しない。
        // local/nativeの整合性を確定できないためfail closedでRetryへ送る。
        nativeRecoveryGateRef.current = true;
        saveGuardRef.current = true;
        setNativeRecoveryStatus("error");
        setNativeBackupRetryAllowed(false);
        setLoadError(false);
        return;
      }

      if (nativeResult.status === "error") {
        nativeRecoveryGateRef.current = true;
        saveGuardRef.current = true;
        setNativeRecoveryStatus("error");
        setNativeBackupRetryAllowed(false);
        setLoadError(false);
        return;
      }

      if (
        nativeResult.status === "available" &&
        !notesSnapshotMatches(nativeResult.notes, current.notes)
      ) {
        // どちらも正常に読めるが内容が異なる場合は、local/nativeを独立候補として保持する。
        // 起動しただけではどちらも書き換えず、ユーザーの明示選択までautosaveも止める。
        localRecoveryCandidateRef.current = current.notes;
        nativeRecoveryAlternativeRef.current = nativeResult.notes;
        recoveryCandidateSourceRef.current = "local";
        baselineNotesRef.current = current.notes;
        latestNotesRef.current = current.notes;
        notesDirtyRef.current = false;
        dirtySinceRef.current = null;
        nativeRecoveryGateRef.current = false;
        saveGuardRef.current = true;
        externalConflictRef.current = true;
        setNativeRecoveryStatus("idle");
        setNotes(current.notes);
        setLastSaveResult({ ok: false, reason: "conflict" });
        setExternalConflict(true);
        setCanLoadStoredNotes(true);
        setRecoveryCandidateCount(current.notes.length);
        setRecoveryCandidateSource("local");
        setScreenRecoveryCandidateCount(null);
        setNativeRecoveryAlternativeCount(nativeResult.notes.length);
        setNativeBackupRetryAllowed(false);
        setLoadError(false);
        return;
      }

      // nativeがmissing、またはlocalと同一内容なら安全にlocalを正本として解放できる。
      // 同一内容でもpersistを通すことで、readerがbackupから救済したケースではprimaryを修復できる。
      nativeRecoveryGateRef.current = false;
      setNativeRecoveryStatus("idle");
      saveGuardRef.current = false;
      notesDirtyRef.current = false;
      dirtySinceRef.current = null;
      baselineNotesRef.current = current.notes;
      latestNotesRef.current = current.notes;
      externalConflictRef.current = false;
      clearRecoveryCandidateSources();
      setNotes(current.notes);
      setLastSaveResult(null);
      setExternalConflict(false);
      setCanLoadStoredNotes(true);
      setRecoveryCandidateCount(0);
      setLoadError(false);
      persistDurableSnapshot(current.notes);
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
      nativeOnlyCandidateRef.current = nativeSnapshot;
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
    setNativeConfirmedMissing(true);
    nativeRecoveryGateRef.current = false;
    setNativeRecoveryStatus("idle");
    saveGuardRef.current = false;
    setLoadError(false);
  }, [
    clearPersistTimer,
    clearRecoveryCandidateSources,
    flagExternalConflict,
    persistDurableSnapshot,
    registerLocalRecoveryCandidate,
  ]);

  useEffect(() => {
    if (!nativeRecoveryInitiallyRequired) return undefined;

    // native環境はlocal primaryの健康状態に関係なく、起動時に一度だけnativeと比較する。
    // 初期state/refですでに編集・保存はgate済み。probeのstate通知はeffect本体の外で開始する。
    queueMicrotask(() => {
      void probeNativeRecovery();
    });
    return () => {
      nativeRecoveryProbeIdRef.current += 1;
    };
  }, [nativeRecoveryInitiallyRequired, probeNativeRecovery]);

  useEffect(() => {
    if (runtimeRecoveryProbeVersion === 0) return undefined;
    if (!isNativeDurableSnapshotAvailable()) return undefined;
    if (localRecoveryCandidateRef.current === null) return undefined;

    queueMicrotask(() => {
      void probeNativeRecovery();
    });
    return () => {
      nativeRecoveryProbeIdRef.current += 1;
    };
  }, [probeNativeRecovery, runtimeRecoveryProbeVersion]);

  useEffect(() => {
    if (nativeRecoveryStatus === "checking") return;
    preferences.initializeReading(
      initialLoad.freshInstall && (!nativeRecoveryInitiallyRequired || nativeConfirmedMissing),
    );
  }, [initialLoad.freshInstall, nativeConfirmedMissing, nativeRecoveryInitiallyRequired, nativeRecoveryStatus, preferences]);

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
            registerLocalRecoveryCandidate(remote.notes);
            applyCleanRemoteNotes(remote.notes);
            flagExternalConflict(
              canChooseStoredPrimary(remote),
              false,
              remote.notes.length,
            );
          } else if (notesDirtyRef.current && remoteHasRecoveryCandidate) {
            // dirty screen / remote recovery / native を別候補として捕捉する。
            // screen を remote で置換せず、native safety probe が完了するまで解決操作も止める。
            // 件数表示は現在ユーザーが見ている候補に合わせる。
            // 3-way開始後にlocal/nativeへ切り替えていても、screen件数へ巻き戻さない。
            const visibleCandidateCount = latestNotesRef.current.length;
            registerDirtyRecoveryCandidate(remote.notes);
            flagExternalConflict(
              canChooseStoredPrimary(remote),
              false,
              visibleCandidateCount,
            );
          } else {
            // recovery candidate が無い通常競合でも dirty screen は守る。
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
  }, [
    applyCleanRemoteNotes,
    flagExternalConflict,
    persistDurableSnapshot,
    registerDirtyRecoveryCandidate,
    registerLocalRecoveryCandidate,
  ]);

  useEffect(() => {
    return () => {
      clearPersistTimer();
      if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    };
  }, [clearPersistTimer]);

  const createNote = useCallback(() => {
    if (!markNotesDirty()) return;
    // 検索語はここでは捨てない。何も書かずに戻った時は、元の検索結果・位置へ戻す（R15 / D06）。
    listRestoreRef.current = { cardId: null, scrollY: window.scrollY };

    const iso = nowIso();
    const note: Note = {
      id: createId(),
      title: "",
      body: "",
      createdAt: iso,
      updatedAt: iso,
      isFavorite: false,
    };

    setNotes((prev) => [note, ...prev]);
    setUntouchedDraftId(note.id);
    setView({ kind: "editor", id: note.id, origin: "new" });
  }, [markNotesDirty]);

  const updateNote = useCallback(
    (id: string, patch: Partial<Pick<Note, "title" | "body" | "isFavorite">>) => {
      if (!markNotesDirty()) return;
      // 何か一つでも変更が入った新規は、「未操作」ではなく入力履歴のあるメモ。
      setUntouchedDraftId((current) => (current === id ? null : current));
      const snapshot = latestNotesRef.current.map((note) =>
        note.id === id ? { ...note, ...patch, updatedAt: nowIso() } : note,
      );
      latestNotesRef.current = snapshot;
      // A formatter can fail while rendering this very edit, before the layout effect runs.
      recordDraftRescue(snapshot, baselineNotesRef.current);
      setNotes(snapshot);
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

      // この削除が保存先へ確定するまで、「削除を保存できませんでした」と区別して伝えるための印。
      setDeleteUnconfirmed(true);
      if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
      const deleted: DeletedNote = { note: target, expiresAt: Date.now() + UNDO_TIMEOUT_MS };
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
    if (Date.now() >= lastDeleted.expiresAt) {
      if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
      setLastDeleted(null);
      return;
    }
    if (!markNotesDirty()) return;

    if (undoTimerRef.current) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }

    // 元に戻した時点で、削除は意図されていない。以後の失敗は通常の保存失敗として扱う。
    setDeleteUnconfirmed(false);
    const { note } = lastDeleted;
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

    setArchiveFull(false);
    setDeleteUnconfirmed(false);
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
    clearRecoveryCandidateSources();
    // ユーザーが保存済み版を正本として明示採用したので、古いnative候補を残さない。
    persistDurableSnapshot(result.notes);
  }, [clearPersistTimer, clearRecoveryCandidateSources, persistDurableSnapshot]);

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

  const showRecoveryCandidateSource = useCallback((source: RecoveryCandidateSource) => {
    const snapshot =
      source === "screen"
        ? screenRecoveryCandidateRef.current
        : source === "local"
          ? localRecoveryCandidateRef.current
          : nativeRecoveryAlternativeRef.current;
    if (snapshot === null) return;

    recoveryCandidateSourceRef.current = source;
    baselineNotesRef.current = snapshot;
    latestNotesRef.current = snapshot;
    setRecoveryCandidateSource(source);
    setNotes(snapshot);
    setRecoveryCandidateCount(snapshot.length);
    setLastSaveResult({ ok: false, reason: "conflict" });
  }, []);

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
    listRestoreRef.current = { cardId: id, scrollY: window.scrollY };
    setView({ kind: "read", id });
  }, []);

  /**
   * 編集画面を閉じる。
   * - 未操作の新規: 空のメモを増やさず、元の一覧／検索結果へ（検索語・位置を保つ）
   * - 入力のあった新規: 新しいカードが見える通常の一覧へ
   * - 読み返しから開いた編集: 同じメモの読み返しへ
   */
  const closeEditor = useCallback(
    (id: string, origin: "new" | "read", position?: ReadingPosition) => {
      if (origin === "read") {
        setView({ kind: "read", id, position });
        return;
      }
      if (untouchedDraftId === id) {
        // 保存先へ書かれていても、この下書きだけを静かに取り除く（削除のUndoは出さない）。
        if (markNotesDirty()) {
          setNotes((prev) => prev.filter((note) => note.id !== id));
        }
        setUntouchedDraftId(null);
        // listRestoreRef は createNote が記録した元の位置をそのまま使う。
        setView({ kind: "list" });
        return;
      }
      // 現在の検索語に新規メモが一致しないまま、見えないカードを作って終わらせない。
      setSearchQuery("");
      listRestoreRef.current = { cardId: id, scrollY: 0 };
      setView({ kind: "list" });
    },
    [markNotesDirty, untouchedDraftId],
  );

  // 一覧へ戻った後、元のカード（または位置）へ復元し、フォーカスを返す。
  useEffect(() => {
    if (view.kind !== "list") return undefined;
    const target = listRestoreRef.current;
    if (!target) return undefined;
    listRestoreRef.current = null;
    const frame = window.requestAnimationFrame(() => {
      // 属性セレクタへ ID を埋め込まず、一覧から照合する（ID に特殊文字があっても安全）。
      const card = target.cardId
        ? (Array.from(document.querySelectorAll<HTMLElement>("[data-note-id]")).find(
            (el) => el.dataset.noteId === target.cardId,
          ) ?? null)
        : null;
      if (card) {
        card.focus({ preventScroll: true });
        // 位置の復元は補助。API が無い環境でも、戻る操作そのものを失敗させない。
        if (typeof card.scrollIntoView === "function") card.scrollIntoView({ block: "center" });
      } else {
        window.scrollTo(0, target.scrollY);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [view]);

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

  const globalSaveFailureMessage = getSaveFailureMessage(copy, lastSaveResult, {
    deletePending: deleteUnconfirmed,
  });
  const showGlobalSaveFailure =
    globalSaveFailureMessage !== null &&
    // 満杯の説明は復旧の案内の中で出すので、同じ文を二重に出さない。
    !archiveFull &&
    (view.kind !== "editor" || !currentNote);
  const canRetryGlobalSave =
    showGlobalSaveFailure &&
    !externalConflict &&
    isRetryableSaveFailure(lastSaveResult);
  // 予備保存の警告は「最新の変更は保存済み」と言える時だけ出す。
  // 本体の保存が失敗・停止している間や、警告の対象より新しい入力がある間は出さない（R35）。
  const latestChangeSaved = lastSaveResult === null || lastSaveResult.ok;
  const showNativeBackupWarning =
    nativeBackupError &&
    latestChangeSaved &&
    !externalConflict &&
    (nativeBackupErrorVersion === null || nativeBackupErrorVersion === editVersion);
  const canRetryNativeBackup = showNativeBackupWarning && nativeBackupRetryAllowed;

  // 比較画面に出す候補を、イベントの中で組み立てる（描画中に ref を読まない）。
  // 開いた時点の内容を並べるだけで、保存内容は変えない。
  const buildReviewCandidates = useCallback((): ReviewCandidate[] => {
    const list: ReviewCandidate[] = [];
    const screen =
      screenRecoveryCandidateRef.current ??
      (notesDirtyRef.current || recoveryCandidateSourceRef.current === "screen"
        ? latestNotesRef.current
        : null);
    if (screen !== null) {
      list.push({ id: "screen", source: "screen", notes: screen });
    }
    const local = localRecoveryCandidateRef.current;
    const primary = readPrimaryForReview();
    if (local !== null) list.push({ id: "stored", source: "stored", notes: local });
    if (primary !== null && (local === null || !notesSnapshotMatches(local, primary))) {
      list.push({ id: "primary", source: "primary", notes: primary });
    }
    const native = nativeRecoveryAlternativeRef.current ?? nativeOnlyCandidateRef.current;
    if (native !== null) list.push({ id: "native", source: "native", notes: native });
    listProtectedRecoveryCandidates().forEach((candidate, index) => {
      list.push({
        id: `protected-${candidate.slot}`,
        source: "protected",
        index: index + 1,
        notes: candidate.notes,
        protectedSlot: { slot: candidate.slot, raw: candidate.raw },
      });
    });
    return list;
  }, []);

  const openReview = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    reviewTriggerRef.current = event.currentTarget;
    setReviewCandidates(buildReviewCandidates());
    setReviewOpen(true);
  }, [buildReviewCandidates]);

  const discardProtectedCandidate = useCallback(
    (candidate: ReviewCandidate) => {
      if (candidate.source !== "protected") return "failed" as const;
      const result = discardProtectedRecoveryCandidate(
        candidate.protectedSlot.slot,
        candidate.protectedSlot.raw,
      );
      // 整理後の保護候補の一覧を読み直す。
      setReviewCandidates(buildReviewCandidates());
      return result;
    },
    [buildReviewCandidates],
  );

  useEffect(() => {
    if (view.kind !== "list" && !currentNote) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setView({ kind: "list" });
    }
  }, [view, currentNote]);

  return (
    <AppShell>
      {aboutOpen && (
        <AboutScreen onClose={() => {
          setAboutOpen(false);
          window.requestAnimationFrame(() => aboutTriggerRef.current?.focus({ preventScroll: true }));
        }} />
      )}
      {reviewOpen && (
        <RecoveryReview
          candidates={reviewCandidates}
          archiveFull={archiveFull}
          onDiscard={discardProtectedCandidate}
          onClose={() => {
            setReviewOpen(false);
            window.requestAnimationFrame(() => reviewTriggerRef.current?.focus({ preventScroll: true }));
          }}
        />
      )}
      {(loadError ||
        externalConflict ||
        showGlobalSaveFailure ||
        showNativeBackupWarning ||
        nativeRecoveryStatus !== "idle") && (
        <div className="zanshin-notices mx-auto flex w-full max-w-[560px] flex-col gap-gr-2 pt-gr-2">
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
                {copy.loadError}
              </span>
              <button
                type="button"
                onClick={() => setLoadError(false)}
                className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[8px] text-ink-muted/70 transition-soft hover:bg-vermilion/5 hover:text-sumi active:scale-[0.96]"
                aria-label={copy.close}
              >
                ✕
              </button>
            </div>
          )}

          {externalConflict && nativeRecoveryStatus === "idle" && (
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
                    {copy.storageRecoveryCandidateCount({ noteCount: recoveryCandidateCount })}
                  </span>
                )}
                {canLoadStoredNotes
                  ? copy.storageConflictBody
                  : copy.storageConflictRecoveryBody}
                {screenRecoveryCandidateCount !== null && (
                  <span
                    data-testid="dirty-recovery-candidates"
                    className="mt-gr-2 block text-sumi/80"
                  >
                    {copy.dirtyRecoveryCandidateNotice}
                    <span className="mt-gr-1 block">
                      {recoveryCandidateSource === "screen"
                        ? copy.dirtyRecoveryScreenActive
                        : recoveryCandidateSource === "local"
                          ? copy.dirtyRecoveryLocalActive
                          : copy.nativeRecoveryAlternativeActive}
                    </span>
                  </span>
                )}
                {nativeRecoveryAlternativeCount !== null && (
                  <span
                    data-testid="native-recovery-alternative"
                    className="mt-gr-2 block text-sumi/80"
                  >
                    {copy.nativeRecoveryAlternativeNotice({ noteCount: nativeRecoveryAlternativeCount })}
                    {screenRecoveryCandidateCount === null &&
                      recoveryCandidateSource === "native" && (
                        <span className="mt-gr-1 block">
                          {copy.nativeRecoveryAlternativeActive}
                        </span>
                      )}
                  </span>
                )}
              </p>
              {archiveFull && (
                <p
                  data-testid="recovery-archive-full"
                  className="mt-gr-2 text-[12px] leading-ample text-sumi jp-text-discipline"
                >
                  {copy.recoveryArchiveFull}
                  <span className="mt-gr-1 block text-ink-muted">{copy.recoveryArchiveFullGuide}</span>
                </p>
              )}
              {notes.length === 0 && <p className="mt-gr-2 text-sm">{copy.storageRecoverySaveEmpty}</p>}
              <div className="mt-gr-3 flex flex-wrap justify-end gap-gr-2">
                <button
                  type="button"
                  onClick={openReview}
                  className="min-h-[44px] border border-gold/35 px-gr-3 py-gr-2 font-mincho text-[12px] text-sumi transition-soft hover:bg-washi active:scale-[0.98]"
                  style={{ borderRadius: "6px 10px 7px 9px" }}
                >
                  {copy.recoveryReviewOpen}
                </button>
                {screenRecoveryCandidateCount !== null ? (
                  <>
                    {recoveryCandidateSource !== "screen" && (
                      <button
                        type="button"
                        onClick={() => showRecoveryCandidateSource("screen")}
                        className="min-h-[44px] border border-gold/35 px-gr-3 py-gr-2 font-mincho text-[12px] text-sumi transition-soft hover:bg-washi active:scale-[0.98]"
                        style={{ borderRadius: "6px 10px 7px 9px" }}
                      >
                        {copy.dirtyRecoveryShowScreen}
                      </button>
                    )}
                    {recoveryCandidateSource !== "local" && (
                      <button
                        type="button"
                        onClick={() => showRecoveryCandidateSource("local")}
                        className="min-h-[44px] border border-gold/35 px-gr-3 py-gr-2 font-mincho text-[12px] text-sumi transition-soft hover:bg-washi active:scale-[0.98]"
                        style={{ borderRadius: "6px 10px 7px 9px" }}
                      >
                        {copy.dirtyRecoveryShowLocal}
                      </button>
                    )}
                    {nativeRecoveryAlternativeCount !== null &&
                      recoveryCandidateSource !== "native" && (
                        <button
                          type="button"
                          onClick={() => showRecoveryCandidateSource("native")}
                          className="min-h-[44px] border border-gold/35 px-gr-3 py-gr-2 font-mincho text-[12px] text-sumi transition-soft hover:bg-washi active:scale-[0.98]"
                          style={{ borderRadius: "6px 10px 7px 9px" }}
                        >
                          {copy.nativeRecoveryShowAlternative}
                        </button>
                      )}
                  </>
                ) : (
                  nativeRecoveryAlternativeCount !== null && (
                    <button
                      type="button"
                      onClick={() =>
                        showRecoveryCandidateSource(
                          recoveryCandidateSource === "native" ? "local" : "native",
                        )
                      }
                      className="min-h-[44px] border border-gold/35 px-gr-3 py-gr-2 font-mincho text-[12px] text-sumi transition-soft hover:bg-washi active:scale-[0.98]"
                      style={{ borderRadius: "6px 10px 7px 9px" }}
                    >
                      {recoveryCandidateSource === "native"
                        ? copy.nativeRecoveryShowLocal
                        : copy.nativeRecoveryShowAlternative}
                    </button>
                  )
                )}
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


          {showNativeBackupWarning && (
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
              <button
                type="button"
                onClick={openReview}
                className="min-h-[44px] rounded-full border border-vermilion/30 px-gr-3 py-gr-2 text-vermilion"
              >
                {copy.recoveryReviewOpen}
              </button>
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
          className="zanshin-undo-toast fixed inset-x-gr-4 bottom-[max(env(safe-area-inset-bottom),89px)] z-30 flex items-center justify-between gap-gr-3 border border-[color:var(--color-line)] bg-paper px-gr-4 py-gr-2 text-[13px] shadow-paper-hover animate-softUp"
          style={{ borderRadius: "7px 13px 8px 11px" }}
        >
          <span className="font-mincho text-sumi/88 jp-text-discipline">{deleteUnconfirmed ? copy.undoDeletePending : copy.undoDeleteMessage}</span>
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
            onOpenAbout={(trigger) => {
              aboutTriggerRef.current = trigger;
              setAboutOpen(true);
            }}
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
          backLabel={searchQuery.trim() !== "" ? copy.backToSearch : copy.back}
          onBack={() => setView({ kind: "list" })}
          position={view.position}
          onEdit={(position) => setView({ kind: "editor", id: currentNote.id, origin: "read", position })}
        />
      ) : (
        <NoteEditor
          note={currentNote}
          onChange={(patch) => updateNote(currentNote.id, patch)}
          backLabel={
            view.kind === "editor" && view.origin === "read"
              ? copy.backToRead
              : view.kind === "editor" &&
                  untouchedDraftId === currentNote.id &&
                  searchQuery.trim() !== ""
                ? copy.backToSearch
                : copy.back
          }
          onBack={() =>
            view.kind === "editor" ? closeEditor(currentNote.id, view.origin, view.position) : setView({ kind: "list" })
          }
          onDelete={() => deleteNote(currentNote.id)}
          saveResult={lastSaveResult}
          conflictMessage={canLoadStoredNotes ? copy.saveConflict : copy.saveRecovery}
          onRetrySave={externalConflict ? undefined : retrySaveCurrentNotes}
        />
      )}
    </AppShell>
  );
}
