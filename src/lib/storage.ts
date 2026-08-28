import type { Note } from "../types/note";

export const NOTES_STORAGE_KEY = "zanshin.notes.v1";
const STORAGE_KEY = NOTES_STORAGE_KEY;
// 保存しようとした最新の正常スナップショット。primary 消失・破損時の第一復旧候補。
const BACKUP_KEY = "zanshin.notes.backup.v1";
// 競合解決で採用しなかった最優先候補の退避先。
const CONFLICT_BACKUP_KEY = "zanshin.notes.conflict.backup.v1";
// pending候補と現在primaryの両方を退避する必要がある稀な競合で、primary側を残す第二退避先。
const SECONDARY_CONFLICT_BACKUP_KEY = "zanshin.notes.conflict.secondary.backup.v1";
// localStorage は複数キーを原子的に更新できないため、base -> next を記録して中断保存を判定する。
const PENDING_SAVE_KEY = "zanshin.notes.pending.v1";
const CORRUPT_BACKUP_KEY = "zanshin.notes.corrupt.backup";

export type SaveResult =
  | { ok: true }
  | {
      ok: false;
      reason: "quota" | "unavailable" | "unknown" | "conflict" | "invalid_data";
    };

export function isRetryableSaveFailure(
  result: SaveResult | null | undefined,
): boolean {
  return (
    result?.ok === false &&
    (result.reason === "quota" ||
      result.reason === "unavailable" ||
      result.reason === "unknown")
  );
}

export type SaveOptions = {
  /**
   * 最後にこの画面が正常に読み込んだ / 保存したメモ集合。
   * 現在の localStorage がこれと違う場合、別画面の更新とみなして保存を止める。
   */
  expectedNotes?: readonly Note[];
  /** ユーザーが競合を理解した上で、この画面の内容を明示的に優先するときだけ true。 */
  force?: boolean;
  /** 同じ画面自身の中断 journal だけを安全に更新するための、画面寿命内で安定したID。 */
  writerId?: string;
};

export type LoadOptions = {
  /**
   * 中断 journal より現在の正常 primary を明示採用する。
   * 未採用の next は conflict backup へ退避できた場合だけ journal を解消する。
   */
  resolvePendingSave?: "prefer_primary";
};

export type LoadResult =
  | { ok: true; notes: Note[] }
  | {
      ok: false;
      notes: Note[];
      reason:
        | "corrupt"
        | "invalid_structure"
        | "missing_primary"
        | "interrupted_save"
        | "unavailable";
      corruptBackupKey?: string;
      recoveredFromBackup?: boolean;
      recoveredFromPendingSave?: boolean;
      /** 空配列も正当な「削除を保存しようとした」候補になり得るため件数とは分けて持つ。 */
      recoveryCandidate?: boolean;
      /** 中断候補とは別に、現在の primary が正常でユーザーがそちらを選べる場合。 */
      storedPrimaryAvailable?: boolean;
    };

type ParsedNotesResult = {
  status: "valid" | "corrupt" | "invalid_structure";
  notes: Note[];
};

type PendingSaveJournal = {
  version: 1;
  baseRaw: string | null;
  nextRaw: string;
  nextNotes: Note[];
  writerId: string | null;
};

function isValidDateString(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !Number.isNaN(new Date(value).getTime())
  );
}

function isNote(value: unknown): value is Note {
  if (!value || typeof value !== "object") return false;
  const note = value as Record<string, unknown>;
  const localeIsValid =
    note.locale === undefined || note.locale === "ja" || note.locale === "en";

  return (
    typeof note.id === "string" &&
    note.id.trim().length > 0 &&
    typeof note.title === "string" &&
    typeof note.body === "string" &&
    isValidDateString(note.createdAt) &&
    isValidDateString(note.updatedAt) &&
    typeof note.isFavorite === "boolean" &&
    localeIsValid
  );
}

function parseNotesRaw(raw: string): ParsedNotesResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: "corrupt", notes: [] };
  }

  if (!Array.isArray(parsed)) {
    return { status: "invalid_structure", notes: [] };
  }

  const notesById = new Map<string, Note>();
  let foundInvalidStructure = false;

  for (const value of parsed) {
    if (!isNote(value)) {
      foundInvalidStructure = true;
      continue;
    }

    const existing = notesById.get(value.id);
    if (!existing) {
      notesById.set(value.id, value);
      continue;
    }

    // 重複IDは編集・削除が複数メモへ波及するため不正構造として扱う。
    // 復元表示には、より新しい updatedAt を持つ方だけを残す。
    foundInvalidStructure = true;
    if (new Date(value.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
      notesById.set(value.id, value);
    }
  }

  return {
    status: foundInvalidStructure ? "invalid_structure" : "valid",
    notes: Array.from(notesById.values()),
  };
}

export function parseValidNotesSnapshot(raw: string): Note[] | null {
  const parsed = parseNotesRaw(raw);
  return parsed.status === "valid" ? parsed.notes : null;
}

export type NotesPrimaryHealth = "missing" | "valid" | "invalid" | "unavailable";

export function getNotesPrimaryHealth(): NotesPrimaryHealth {
  if (typeof window === "undefined") return "unavailable";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return "missing";
    return parseNotesRaw(raw).status === "valid" ? "valid" : "invalid";
  } catch {
    return "unavailable";
  }
}

function notesMatch(left: readonly Note[], right: readonly Note[]): boolean {
  // Note 型に将来フィールドが追加された場合も、その差分を競合として扱う。
  // 既知フィールドだけを比較すると、古い画面が新しいスキーマの情報を黙って消し得る。
  // 多少の false-positive より silent overwrite を防ぐ方を優先する。
  return JSON.stringify(left) === JSON.stringify(right);
}

function mergeRecoveredNotes(primary: Note[], backup: Note[]): Note[] {
  const merged = new Map<string, Note>();

  for (const note of backup) merged.set(note.id, note);

  for (const note of primary) {
    const existing = merged.get(note.id);
    if (
      !existing ||
      new Date(note.updatedAt).getTime() >= new Date(existing.updatedAt).getTime()
    ) {
      merged.set(note.id, note);
    }
  }

  return Array.from(merged.values());
}

function isQuotaError(error: unknown): boolean {
  if (!(error instanceof DOMException)) return false;
  // DOMException.code は非推奨のため name で判定する
  return error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED";
}

function saveFailureFromError(error: unknown): SaveResult {
  if (isQuotaError(error)) return { ok: false, reason: "quota" };
  if (error instanceof DOMException) return { ok: false, reason: "unavailable" };
  return { ok: false, reason: "unknown" };
}

function preserveCorruptRaw(raw: string): void {
  try {
    window.localStorage.setItem(CORRUPT_BACKUP_KEY, raw);
  } catch {
    // 退避失敗は復旧処理そのものを止めない。
    // UIでは「可能な場合は退避」と表現し、成功を断定しない。
  }
}

function readValidatedBackup(): Note[] | null {
  try {
    const backupRaw = window.localStorage.getItem(BACKUP_KEY);
    if (backupRaw === null) return null;

    const backup = parseNotesRaw(backupRaw);
    return backup.status === "valid" ? backup.notes : null;
  } catch {
    // バックアップ領域だけが読み出せなくても、主データから救えた正常要素は返す。
    return null;
  }
}

function readPendingSaveJournal(): PendingSaveJournal | null {
  try {
    const journalRaw = window.localStorage.getItem(PENDING_SAVE_KEY);
    if (journalRaw === null) return null;

    const parsed = JSON.parse(journalRaw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;

    const journal = parsed as Record<string, unknown>;
    if (
      journal.version !== 1 ||
      (journal.baseRaw !== null && typeof journal.baseRaw !== "string") ||
      typeof journal.nextRaw !== "string"
    ) {
      return null;
    }

    const next = parseNotesRaw(journal.nextRaw);
    if (next.status !== "valid") return null;

    const writerId =
      typeof journal.writerId === "string" && journal.writerId.trim().length > 0
        ? journal.writerId
        : null;

    return {
      version: 1,
      baseRaw: journal.baseRaw as string | null,
      nextRaw: journal.nextRaw,
      nextNotes: next.notes,
      writerId,
    };
  } catch {
    // journal が読めなくても、primary / backup の通常復旧は継続する。
    return null;
  }
}

function clearPendingSaveJournal(): void {
  try {
    window.localStorage.removeItem(PENDING_SAVE_KEY);
  } catch {
    // 次回 loadNotes() が primary === nextRaw を確認して再度掃除できる。
  }
}

function repairCompletedPendingSave(journal: PendingSaveJournal): void {
  try {
    window.localStorage.setItem(BACKUP_KEY, journal.nextRaw);
  } catch {
    // primary はすでに nextRaw なので読み込みは正常継続する。
    // journal を残せば次回もう一度 backup 修復を試せる。
    return;
  }
  clearPendingSaveJournal();
}

function mirrorValidPrimaryForPhase32(raw: string): void {
  try {
    const backupRaw = window.localStorage.getItem(BACKUP_KEY);
    if (backupRaw === raw) return;

    // Phase31 までの BACKUP_KEY は「1世代前」だったため、Phase32 初回ロード時に
    // その正常な旧版を conflict backup の空きスロットへ可能な範囲で残してから、
    // BACKUP_KEY を「現在の正常 primary のミラー」へ移行する。
    if (backupRaw !== null && parseNotesRaw(backupRaw).status === "valid") {
      const existingConflictBackup = window.localStorage.getItem(CONFLICT_BACKUP_KEY);
      if (existingConflictBackup === null) {
        try {
          window.localStorage.setItem(CONFLICT_BACKUP_KEY, backupRaw);
        } catch {
          // 移行用の旧版退避が失敗しても、primary の読み込み自体は妨げない。
        }
      }
    }

    try {
      window.localStorage.setItem(BACKUP_KEY, raw);
    } catch {
      // 正常 primary は読めているため、ミラー更新失敗だけで読み込みエラーにはしない。
    }
  } catch {
    // 補助キーへのアクセス失敗で正常 primary の読み込みを壊さない。
  }
}

function interruptedSaveResult(
  pendingSave: PendingSaveJournal,
  storedPrimaryAvailable: boolean,
): LoadResult {
  return {
    ok: false,
    notes: pendingSave.nextNotes,
    reason: "interrupted_save",
    recoveredFromPendingSave: true,
    recoveryCandidate: true,
    storedPrimaryAvailable,
  };
}

function resolvePendingSaveWithPrimary(
  raw: string,
  primary: Note[],
  pendingSave: PendingSaveJournal,
): LoadResult {
  try {
    // ユーザーが primary を選んでも、中断していた next を即座には捨てない。
    window.localStorage.setItem(CONFLICT_BACKUP_KEY, pendingSave.nextRaw);
    // primary 採用を確定する前に recovery backup も primary へ揃える。
    // ここで失敗したら journal を残し、次回も二択を提示できる状態を維持する。
    window.localStorage.setItem(BACKUP_KEY, raw);
    // candidate退避とprimary mirrorの両方が成功して初めて中断journalを解消する。
    window.localStorage.removeItem(PENDING_SAVE_KEY);
  } catch {
    // 退避・mirror・journal解消のどこかに失敗したら選択を確定しない。
    return interruptedSaveResult(pendingSave, true);
  }

  return { ok: true, notes: primary };
}

/**
 * localStorage からメモを読み込む。
 * - 正常データはそのまま返し、Phase31形式の backup は最新版ミラーへ安全に移行する
 * - save journal の base が現在 primary と一致すれば、中断された next を復元候補として返す
 * - save journal の next が現在 primary と一致すれば保存完了済みとして backup / journal を自己修復する
 * - journal と primary がどちらにも一致しない場合も、journal の候補を黙って捨てず競合として提示する
 * - primary だけ消失して正常な backup が残っていれば復元候補として返す
 * - JSON破損 / 不正要素 / 重複ID / 不正日時は元データを退避する
 * - 最新の正常 backup が利用できれば復元候補としてマージする
 * - 復元候補を表示しても ok:false のまま返し、自動上書きを防ぐ
 */
export function loadNotes(options: LoadOptions = {}): LoadResult {
  if (typeof window === "undefined") return { ok: true, notes: [] };

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const pendingSave = readPendingSaveJournal();

    if (pendingSave && raw === pendingSave.nextRaw) {
      // primary まで書けた後に cleanup だけ中断したケース。
      // 正常データを返しつつ、backup と journal を可能な範囲で自己修復する。
      repairCompletedPendingSave(pendingSave);
      return { ok: true, notes: pendingSave.nextNotes };
    }

    const primaryForPending = raw !== null ? parseNotesRaw(raw) : null;
    if (pendingSave) {
      const storedPrimaryAvailable = primaryForPending?.status === "valid";

      if (
        options.resolvePendingSave === "prefer_primary" &&
        raw !== null &&
        primaryForPending?.status === "valid"
      ) {
        return resolvePendingSaveWithPrimary(raw, primaryForPending.notes, pendingSave);
      }

      // base と一致する典型的な中断だけでなく、base / next のどちらとも一致しない孤立journalも
      // 候補として表に出す。旧版混在・外部書換え・極小レースでも silent discard しない。
      if (raw !== null && primaryForPending?.status !== "valid") preserveCorruptRaw(raw);
      return interruptedSaveResult(pendingSave, storedPrimaryAvailable);
    }

    if (raw === null) {
      // アプリ自身は保存済み primary を removeItem しない。
      // backup は保存処理の primary より先に確定するため、primary 消失時の第一候補にする。
      const backupNotes = readValidatedBackup();
      if (backupNotes) {
        if (backupNotes.length === 0) return { ok: true, notes: [] };
        return {
          ok: false,
          notes: backupNotes,
          reason: "missing_primary",
          recoveredFromBackup: true,
          recoveryCandidate: true,
        };
      }
      return { ok: true, notes: [] };
    }

    const primary = primaryForPending ?? parseNotesRaw(raw);
    if (primary.status === "valid") {
      mirrorValidPrimaryForPhase32(raw);
      return { ok: true, notes: primary.notes };
    }

    preserveCorruptRaw(raw);

    let recoveredNotes = primary.notes;
    let recoveredFromBackup = false;

    const backupNotes = readValidatedBackup();
    if (backupNotes) {
      recoveredNotes = mergeRecoveredNotes(primary.notes, backupNotes);
      recoveredFromBackup = backupNotes.length > 0;
    }

    return {
      ok: false,
      notes: recoveredNotes,
      reason: primary.status,
      corruptBackupKey: CORRUPT_BACKUP_KEY,
      recoveredFromBackup,
      recoveryCandidate: recoveredNotes.length > 0,
    };
  } catch {
    return { ok: false, notes: [], reason: "unavailable", recoveryCandidate: false };
  }
}

/**
 * localStorage にメモを保存する。
 * - 保存対象そのものを検証し、不正構造を新たに永続化しない
 * - expectedNotes が指定されている場合は、現在の primary と一致するときだけ保存する
 * - 別画面の変更を検知した場合は conflict を返し、黙って上書きしない
 * - 既存の中断 journal が別画面・別スナップショットを指す場合も競合として守る
 * - 同じ画面自身の active journal だけは、より新しい編集へ安全に更新できる
 * - primary と無関係になった孤立 journal は通常保存で上書きしない
 * - 破損 primary は force なしでは上書きせず、raw を退避して conflict とする
 * - force では未採用の pending 候補と正常 primary を必要に応じて別々に退避してから上書きする
 * - journal -> recovery backup -> primary の順に書き、途中中断を次回 loadNotes() で判定可能にする
 */
export function saveNotes(notes: Note[], options: SaveOptions = {}): SaveResult {
  if (typeof window === "undefined") return { ok: false, reason: "unavailable" };

  let serialized: string;
  try {
    serialized = JSON.stringify(notes);
  } catch {
    return { ok: false, reason: "invalid_data" };
  }

  if (parseNotesRaw(serialized).status !== "valid") {
    return { ok: false, reason: "invalid_data" };
  }

  try {
    const currentRaw = window.localStorage.getItem(STORAGE_KEY);
    const currentParsed =
      currentRaw !== null
        ? parseNotesRaw(currentRaw)
        : ({ status: "valid", notes: [] } satisfies ParsedNotesResult);
    const pendingSave = readPendingSaveJournal();
    const pendingAlreadyCompleted = pendingSave && currentRaw === pendingSave.nextRaw;
    const activePendingSave =
      pendingSave && currentRaw === pendingSave.baseRaw ? pendingSave : null;
    const unresolvedPendingSave = pendingSave && !pendingAlreadyCompleted ? pendingSave : null;

    if (pendingAlreadyCompleted && pendingSave) {
      // 前回は primary まで成功して cleanup だけ残った。今回の保存前に可能な範囲で整える。
      repairCompletedPendingSave(pendingSave);
    }

    if (currentRaw !== null && currentParsed.status !== "valid") {
      preserveCorruptRaw(currentRaw);
      // 破損状態を通常保存で黙って置換しない。復元内容を確認した force のみ許可する。
      if (!options.force) return { ok: false, reason: "conflict" };
    }

    const sameWriterOwnsPending =
      Boolean(options.writerId) && activePendingSave?.writerId === options.writerId;

    if (!options.force && unresolvedPendingSave) {
      if (!activePendingSave) {
        // primary が journal の base / next のどちらとも一致しない。
        // journal を新しい保存で上書きせず、ユーザーの解決判断を求める。
        return { ok: false, reason: "conflict" };
      }

      if (activePendingSave.nextRaw !== serialized && !sameWriterOwnsPending) {
        // 別画面の保存が journal だけ残して中断している。primary が同じでも、その候補を黙って消さない。
        return { ok: false, reason: "conflict" };
      }
    }

    if (!options.force && options.expectedNotes) {
      if (
        currentParsed.status !== "valid" ||
        !notesMatch(currentParsed.notes, options.expectedNotes)
      ) {
        return { ok: false, reason: "conflict" };
      }
    }

    if (!options.force && currentParsed.status === "valid" && currentRaw === serialized) {
      if (unresolvedPendingSave && activePendingSave) {
        // 同じ画面自身の中断候補を、その後の Undo 等で primary と同じ状態へ戻したケース。
        // primary はすでに希望状態なので再書き込みせず、古い next を復元候補として残さないよう
        // backup を現在 primary へ戻してから journal を解消する。
        // 別 writer の active pending は上の競合判定ですでに止めている。
        try {
          window.localStorage.setItem(BACKUP_KEY, currentRaw);
          window.localStorage.removeItem(PENDING_SAVE_KEY);
        } catch (error) {
          return saveFailureFromError(error);
        }
      }

      // pending が無い完全な no-op は localStorage へ一切書かない。
      // 実体がすでに保存済みなら quota / unavailable を偽の保存失敗として出さない。
      return { ok: true };
    }

    if (options.force) {
      const pendingCandidateRaw =
        unresolvedPendingSave && unresolvedPendingSave.nextRaw !== serialized
          ? unresolvedPendingSave.nextRaw
          : null;
      const currentCandidateRaw =
        currentRaw !== null &&
        currentParsed.status === "valid" &&
        currentRaw !== serialized
          ? currentRaw
          : null;

      // pending の next が未採用なら最優先 conflict backup に残す。
      if (pendingCandidateRaw !== null) {
        try {
          window.localStorage.setItem(CONFLICT_BACKUP_KEY, pendingCandidateRaw);
        } catch (error) {
          return saveFailureFromError(error);
        }
      }

      if (currentCandidateRaw !== null) {
        const currentBackupKey =
          pendingCandidateRaw !== null && pendingCandidateRaw !== currentCandidateRaw
            ? SECONDARY_CONFLICT_BACKUP_KEY
            : CONFLICT_BACKUP_KEY;
        try {
          window.localStorage.setItem(currentBackupKey, currentCandidateRaw);
        } catch (error) {
          return saveFailureFromError(error);
        }
      }
    }

    const nextJournal = JSON.stringify({
      version: 1,
      baseRaw: currentRaw,
      nextRaw: serialized,
      writerId: options.writerId ?? null,
    });

    try {
      window.localStorage.setItem(PENDING_SAVE_KEY, nextJournal);
    } catch (error) {
      return saveFailureFromError(error);
    }

    // primary より先に復旧コピーを確定する。
    // 失敗しても journal が残るため、次回は next を中断保存候補として提示できる。
    try {
      window.localStorage.setItem(BACKUP_KEY, serialized);
    } catch (error) {
      return saveFailureFromError(error);
    }

    // primary が失敗しても journal + backup の next は残り、再起動後に復元候補として拾える。
    window.localStorage.setItem(STORAGE_KEY, serialized);
    clearPendingSaveJournal();
    return { ok: true };
  } catch (error) {
    return saveFailureFromError(error);
  }
}

export const STORAGE_KEY_FOR_TESTING = STORAGE_KEY;
export const BACKUP_KEY_FOR_TESTING = BACKUP_KEY;
export const CONFLICT_BACKUP_KEY_FOR_TESTING = CONFLICT_BACKUP_KEY;
export const SECONDARY_CONFLICT_BACKUP_KEY_FOR_TESTING = SECONDARY_CONFLICT_BACKUP_KEY;
export const PENDING_SAVE_KEY_FOR_TESTING = PENDING_SAVE_KEY;
export const CORRUPT_BACKUP_KEY_FOR_TESTING = CORRUPT_BACKUP_KEY;
