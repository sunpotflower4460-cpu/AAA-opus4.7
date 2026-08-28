from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}")
    file.write_text(text.replace(old, new, 1))


Path("src/lib/nativeDurableSnapshot.ts").write_text(r'''import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import type { Note } from "../types/note";
import { parseValidNotesSnapshot } from "./storage";

const PRIMARY_PATH = "zanshin/notes.snapshot.v1.json";
const BACKUP_PATH = "zanshin/notes.snapshot.backup.v1.json";
const CORRUPT_PATH = "zanshin/notes.snapshot.corrupt.v1.json";
const DIRECTORY = Directory.LibraryNoCloud;
const FILE_NOT_FOUND_CODE = "OS-PLUG-FILE-0008";

let writeChain: Promise<void> = Promise.resolve();

type NativeReadResult =
  | { status: "ok"; raw: string }
  | { status: "missing" }
  | { status: "error" };

export type NativeDurableSnapshotReadResult =
  | { status: "available"; notes: Note[] }
  | { status: "missing" }
  | { status: "error" };

export function isNativeDurableSnapshotAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

function nativeErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

async function readRaw(path: string): Promise<NativeReadResult> {
  try {
    const result = await Filesystem.readFile({
      path,
      directory: DIRECTORY,
      encoding: Encoding.UTF8,
    });
    return typeof result.data === "string"
      ? { status: "ok", raw: result.data }
      : { status: "error" };
  } catch (error) {
    return nativeErrorCode(error) === FILE_NOT_FOUND_CODE
      ? { status: "missing" }
      : { status: "error" };
  }
}

async function writeRaw(path: string, data: string): Promise<void> {
  await Filesystem.writeFile({
    path,
    data,
    directory: DIRECTORY,
    encoding: Encoding.UTF8,
    recursive: true,
  });
}

async function writeSnapshotRaw(nextRaw: string): Promise<void> {
  const current = await readRaw(PRIMARY_PATH);

  // 「存在しない」と「読めない」を混同しない。読込障害時にprimaryへ触ると、
  // 既存の正常世代をbackupへ確定できないまま上書きする恐れがあるため中止する。
  if (current.status === "error") {
    throw new Error("native snapshot primary read failed");
  }

  if (current.status === "ok") {
    if (current.raw === nextRaw) return;

    if (parseValidNotesSnapshot(current.raw) !== null) {
      // 新しい primary に触る前に、直前の正常世代を確定する。
      // ここが失敗した場合は current primary を残し、新版へ進まない。
      await writeRaw(BACKUP_PATH, current.raw);
    } else {
      // 破損した native snapshot も診断・救済余地を残すが、退避失敗は新版保存を妨げない。
      try {
        await writeRaw(CORRUPT_PATH, current.raw);
      } catch {
        // best effort
      }
    }
  }

  await writeRaw(PRIMARY_PATH, nextRaw);
}

/**
 * localStorage の同期保存を置き換えず、native 側に耐久スナップショットを直列保存する。
 * 呼び出し順を Promise chain で固定し、古い非同期 write が新しい内容を後から巻き戻すのを防ぐ。
 */
export function persistNativeDurableSnapshot(notes: readonly Note[]): Promise<boolean> {
  if (!isNativeDurableSnapshotAvailable()) return Promise.resolve(true);

  let raw: string;
  try {
    raw = JSON.stringify(notes);
  } catch {
    return Promise.resolve(false);
  }
  if (parseValidNotesSnapshot(raw) === null) return Promise.resolve(false);

  const operation = writeChain
    .catch(() => {
      // 前回失敗が次回のretryを永久に止めないようchainだけ回復する。
    })
    .then(() => writeSnapshotRaw(raw));

  writeChain = operation.catch(() => {
    // 次回保存を継続可能にするため内部chainでは吸収する。
  });

  return operation.then(
    () => true,
    () => false,
  );
}

/**
 * localStorage 消失/破損時の native 復元候補を読む。
 * `missing` と I/O 失敗を区別し、読み取り不能を「新規インストール」と誤認させない。
 */
export async function readNativeDurableSnapshot(): Promise<NativeDurableSnapshotReadResult> {
  if (!isNativeDurableSnapshotAvailable()) return { status: "missing" };

  await writeChain.catch(() => {});

  const primary = await readRaw(PRIMARY_PATH);
  if (primary.status === "ok") {
    const parsedPrimary = parseValidNotesSnapshot(primary.raw);
    if (parsedPrimary !== null) return { status: "available", notes: parsedPrimary };
  }

  // primary が missing / corrupt / read error の場合でも backup は独立に読める可能性がある。
  // ただし両方から正常候補を得られなければ、read error / corrupt の痕跡は error として保持する。
  const backup = await readRaw(BACKUP_PATH);
  if (backup.status === "ok") {
    const parsedBackup = parseValidNotesSnapshot(backup.raw);
    if (parsedBackup !== null) return { status: "available", notes: parsedBackup };
    return { status: "error" };
  }

  if (primary.status === "error" || backup.status === "error") {
    return { status: "error" };
  }

  // primary が読めたが構造破損していたのに backup が無い場合も、fresh install ではない。
  if (primary.status === "ok") return { status: "error" };

  return { status: "missing" };
}

export function resetNativeDurableSnapshotQueueForTesting(): void {
  writeChain = Promise.resolve();
}

export const NATIVE_SNAPSHOT_PATHS_FOR_TESTING = {
  primary: PRIMARY_PATH,
  backup: BACKUP_PATH,
  corrupt: CORRUPT_PATH,
} as const;
''')

Path("src/lib/__tests__/nativeDurableSnapshot.test.ts").write_text(r'''import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Note } from "../../types/note";

const mocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: mocks.isNativePlatform },
}));

vi.mock("@capacitor/filesystem", () => ({
  Directory: { LibraryNoCloud: "LIBRARY_NO_CLOUD" },
  Encoding: { UTF8: "utf8" },
  Filesystem: { readFile: mocks.readFile, writeFile: mocks.writeFile },
}));

import {
  isNativeDurableSnapshotAvailable,
  NATIVE_SNAPSHOT_PATHS_FOR_TESTING,
  persistNativeDurableSnapshot,
  readNativeDurableSnapshot,
  resetNativeDurableSnapshotQueueForTesting,
} from "../nativeDurableSnapshot";

const FILE_NOT_FOUND = { code: "OS-PLUG-FILE-0008" };

function makeNote(title: string, minute = 0): Note {
  return {
    id: "one",
    title,
    body: "本文",
    createdAt: "2026-08-28T00:00:00.000Z",
    updatedAt: `2026-08-28T00:${String(minute).padStart(2, "0")}:00.000Z`,
    isFavorite: false,
    locale: "ja",
  };
}

describe("native durable snapshot", () => {
  const files = new Map<string, string>();

  beforeEach(() => {
    files.clear();
    resetNativeDurableSnapshotQueueForTesting();
    mocks.isNativePlatform.mockReset();
    mocks.readFile.mockReset();
    mocks.writeFile.mockReset();
    mocks.isNativePlatform.mockReturnValue(true);
    mocks.readFile.mockImplementation(async ({ path }: { path: string }) => {
      const data = files.get(path);
      if (data === undefined) throw FILE_NOT_FOUND;
      return { data };
    });
    mocks.writeFile.mockImplementation(async ({ path, data }: { path: string; data: string }) => {
      files.set(path, data);
      return { uri: path };
    });
  });

  it("webではnative filesystemへ触れずmissingを返す", async () => {
    mocks.isNativePlatform.mockReturnValue(false);
    expect(isNativeDurableSnapshotAvailable()).toBe(false);
    expect(await persistNativeDurableSnapshot([makeNote("web")])).toBe(true);
    expect(mocks.readFile).not.toHaveBeenCalled();
    expect(mocks.writeFile).not.toHaveBeenCalled();
    expect(await readNativeDurableSnapshot()).toEqual({ status: "missing" });
  });

  it("初回はprimary snapshotを書き込む", async () => {
    expect(isNativeDurableSnapshotAvailable()).toBe(true);
    const notes = [makeNote("初回")];
    expect(await persistNativeDurableSnapshot(notes)).toBe(true);
    expect(files.get(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary)).toBe(JSON.stringify(notes));
  });

  it("更新時は旧primaryをbackupへ確定してから新版を書く", async () => {
    const oldNotes = [makeNote("旧版")];
    const newNotes = [makeNote("新版", 1)];
    files.set(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary, JSON.stringify(oldNotes));

    expect(await persistNativeDurableSnapshot(newNotes)).toBe(true);
    expect(files.get(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.backup)).toBe(JSON.stringify(oldNotes));
    expect(files.get(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary)).toBe(JSON.stringify(newNotes));
  });

  it("同一snapshotならfilesystem書込を行わない", async () => {
    const notes = [makeNote("同一")];
    files.set(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary, JSON.stringify(notes));
    expect(await persistNativeDurableSnapshot(notes)).toBe(true);
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });

  it("primary破損時は正常backupを復元候補として返す", async () => {
    const backup = [makeNote("backup")];
    files.set(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary, "{broken");
    files.set(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.backup, JSON.stringify(backup));
    expect(await readNativeDurableSnapshot()).toEqual({ status: "available", notes: backup });
  });

  it("primary読込が一時失敗しても正常backupは読み取り専用の復元候補として返す", async () => {
    const backup = [makeNote("backup")];
    files.set(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.backup, JSON.stringify(backup));
    mocks.readFile.mockImplementation(async ({ path }: { path: string }) => {
      if (path === NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary) {
        throw { code: "OS-PLUG-FILE-0013" };
      }
      const data = files.get(path);
      if (data === undefined) throw FILE_NOT_FOUND;
      return { data };
    });

    expect(await readNativeDurableSnapshot()).toEqual({ status: "available", notes: backup });
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });

  it("primary読込失敗かつbackup不存在はfresh installではなくerror", async () => {
    mocks.readFile.mockImplementation(async ({ path }: { path: string }) => {
      if (path === NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary) {
        throw { code: "OS-PLUG-FILE-0013" };
      }
      throw FILE_NOT_FOUND;
    });
    expect(await readNativeDurableSnapshot()).toEqual({ status: "error" });
  });

  it("primary不存在でもbackup読込失敗ならfresh installではなくerror", async () => {
    mocks.readFile.mockImplementation(async ({ path }: { path: string }) => {
      if (path === NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary) throw FILE_NOT_FOUND;
      throw { code: "OS-PLUG-FILE-0013" };
    });
    expect(await readNativeDurableSnapshot()).toEqual({ status: "error" });
  });

  it("破損primaryしかない場合もfresh installではなくerror", async () => {
    files.set(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary, "{broken");
    expect(await readNativeDurableSnapshot()).toEqual({ status: "error" });
  });

  it("primaryとbackupがどちらも不存在ならmissing", async () => {
    expect(await readNativeDurableSnapshot()).toEqual({ status: "missing" });
  });

  it("primary読込が不存在以外の理由で失敗したら既存世代へ触れず保存を中止する", async () => {
    const next = [makeNote("新版")];
    mocks.readFile.mockRejectedValue({ code: "OS-PLUG-FILE-0013" });

    expect(await persistNativeDurableSnapshot(next)).toBe(false);
    expect(mocks.writeFile).not.toHaveBeenCalled();
    expect(files.size).toBe(0);
  });

  it("不存在コードは初回保存として扱いprimaryを書ける", async () => {
    const notes = [makeNote("初回")];
    mocks.readFile.mockRejectedValue(FILE_NOT_FOUND);

    expect(await persistNativeDurableSnapshot(notes)).toBe(true);
    expect(mocks.writeFile).toHaveBeenCalledTimes(1);
    expect(files.get(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary)).toBe(JSON.stringify(notes));
  });

  it("新版primary書込失敗時も旧世代backupを残して失敗を返す", async () => {
    const oldNotes = [makeNote("旧版")];
    const newNotes = [makeNote("新版", 1)];
    files.set(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary, JSON.stringify(oldNotes));
    mocks.writeFile.mockImplementation(async ({ path, data }: { path: string; data: string }) => {
      if (path === NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary) throw new Error("disk failure");
      files.set(path, data);
      return { uri: path };
    });

    expect(await persistNativeDurableSnapshot(newNotes)).toBe(false);
    expect(files.get(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.backup)).toBe(JSON.stringify(oldNotes));
    expect(files.get(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary)).toBe(JSON.stringify(oldNotes));
  });

  it("非同期保存は呼出順に直列化され、旧版が新版を後から巻き戻さない", async () => {
    const first = [makeNote("first")];
    const second = [makeNote("second", 1)];
    let releaseFirst!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let markFirstPrimaryStarted!: () => void;
    const firstPrimaryStarted = new Promise<void>((resolve) => {
      markFirstPrimaryStarted = resolve;
    });
    let primaryWrites = 0;
    mocks.writeFile.mockImplementation(async ({ path, data }: { path: string; data: string }) => {
      if (path === NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary) {
        primaryWrites += 1;
        if (primaryWrites === 1) {
          markFirstPrimaryStarted();
          await gate;
        }
      }
      files.set(path, data);
      return { uri: path };
    });

    const firstSave = persistNativeDurableSnapshot(first);
    const secondSave = persistNativeDurableSnapshot(second);
    await firstPrimaryStarted;
    expect(primaryWrites).toBe(1);

    releaseFirst();
    expect(await firstSave).toBe(true);
    expect(await secondSave).toBe(true);
    expect(files.get(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary)).toBe(JSON.stringify(second));
  });
});
''')

replace_once(
    "src/App.tsx",
    '''      recoveredCount: recoveryPending ? result.notes.length : 0,\n    };''',
    '''      recoveredCount: recoveryPending ? result.notes.length : 0,\n      primaryHealth: getNotesPrimaryHealth(),\n    };''',
)

replace_once(
    "src/App.tsx",
    '''  const [persistenceWriterId] = useState(() => createId());\n\n  const [notes, setNotes] = useState<Note[]>(initialLoad.notes);''',
    '''  const [persistenceWriterId] = useState(() => createId());\n  const [nativeRecoveryInitiallyRequired] = useState(\n    () =>\n      isNativeDurableSnapshotAvailable() &&\n      !initialLoad.recoveryPending &&\n      (initialLoad.primaryHealth === "missing" || initialLoad.primaryHealth === "invalid"),\n  );\n\n  const [notes, setNotes] = useState<Note[]>(initialLoad.notes);''',
)

replace_once(
    "src/App.tsx",
    '''  const [nativeBackupError, setNativeBackupError] = useState(false);\n  const [nativeBackupRetryAllowed, setNativeBackupRetryAllowed] = useState(false);''',
    '''  const [nativeBackupError, setNativeBackupError] = useState(false);\n  const [nativeBackupRetryAllowed, setNativeBackupRetryAllowed] = useState(false);\n  const [nativeRecoveryStatus, setNativeRecoveryStatus] = useState<\n    "idle" | "checking" | "error"\n  >(nativeRecoveryInitiallyRequired ? "checking" : "idle");''',
)

replace_once(
    "src/App.tsx",
    '''  const saveGuardRef = useRef<boolean>(initialLoad.loadFailed);''',
    '''  const saveGuardRef = useRef<boolean>(\n    initialLoad.loadFailed || nativeRecoveryInitiallyRequired,\n  );''',
)

replace_once(
    "src/App.tsx",
    '''  const externalConflictRef = useRef(initialLoad.recoveryPending);\n  const mountedRef = useRef(true);''',
    '''  const externalConflictRef = useRef(initialLoad.recoveryPending);\n  const nativeRecoveryGateRef = useRef(nativeRecoveryInitiallyRequired);\n  const nativeRecoveryProbeIdRef = useRef(0);\n  const mountedRef = useRef(true);''',
)

replace_once(
    "src/App.tsx",
    '''  const markNotesDirty = useCallback(() => {\n    if (externalConflictRef.current) {''',
    '''  const markNotesDirty = useCallback(() => {\n    // native復旧の確認中/読込障害中は、旧データを上書きし得る編集自体を開始させない。\n    setNativeBackupRetryAllowed(false);\n    if (nativeRecoveryGateRef.current) return false;\n\n    if (externalConflictRef.current) {''',
)
replace_once(
    "src/App.tsx",
    '''    notesDirtyRef.current = true;\n  }, []);''',
    '''    notesDirtyRef.current = true;\n    return true;\n  }, []);''',
)

old_effect = '''  useEffect(() => {\n    if (!isNativeDurableSnapshotAvailable()) return undefined;\n\n    let cancelled = false;\n\n    void readNativeDurableSnapshot().then((nativeSnapshot) => {\n      if (cancelled) return;\n\n      const primaryHealth = getNotesPrimaryHealth();\n      const canAdoptNativeRecovery =\n        nativeSnapshot !== null &&\n        nativeSnapshot.length > 0 &&\n        (primaryHealth === "missing" || primaryHealth === "invalid") &&\n        !notesDirtyRef.current &&\n        !externalConflictRef.current;\n\n      if (canAdoptNativeRecovery && nativeSnapshot) {\n        clearPersistTimer();\n        saveGuardRef.current = true;\n        externalConflictRef.current = true;\n        dirtySinceRef.current = null;\n        baselineNotesRef.current = nativeSnapshot;\n        latestNotesRef.current = nativeSnapshot;\n        setNotes(nativeSnapshot);\n        setLastSaveResult({ ok: false, reason: "conflict" });\n        setExternalConflict(true);\n        setCanLoadStoredNotes(false);\n        setRecoveryCandidateCount(nativeSnapshot.length);\n        setLoadError(false);\n        setNativeBackupError(false);\n        setNativeBackupRetryAllowed(false);\n        return;\n      }\n\n      // 既存ユーザーは最初のPhase38起動で、正常localStorageをnative耐久層へ移行する。\n      if (primaryHealth === "valid" && !initialLoad.loadFailed) {\n        persistDurableSnapshot(baselineNotesRef.current);\n      }\n    });\n\n    return () => {\n      cancelled = true;\n    };\n  }, [clearPersistTimer, initialLoad.loadFailed, persistDurableSnapshot]);'''
new_effect = '''  const probeNativeRecovery = useCallback(async () => {\n    const probeId = nativeRecoveryProbeIdRef.current + 1;\n    nativeRecoveryProbeIdRef.current = probeId;\n    nativeRecoveryGateRef.current = true;\n    saveGuardRef.current = true;\n    clearPersistTimer();\n    setNativeRecoveryStatus("checking");\n\n    const nativeResult = await readNativeDurableSnapshot();\n    if (!mountedRef.current || nativeRecoveryProbeIdRef.current != probeId) return;\n\n    const primaryHealth = getNotesPrimaryHealth();\n\n    // probe中に別タブ等から正常primaryが到着した場合は、その現在値を正本として採用する。\n    if (primaryHealth === "valid") {\n      const current = loadNotes();\n      nativeRecoveryGateRef.current = false;\n      setNativeRecoveryStatus("idle");\n      if (current.ok) {\n        saveGuardRef.current = false;\n        applyCleanRemoteNotes(current.notes);\n        setLoadError(false);\n        persistDurableSnapshot(current.notes);\n      } else {\n        flagExternalConflict(\n          canChooseStoredPrimary(current),\n          !hasRecoveryCandidate(current),\n          hasRecoveryCandidate(current) ? current.notes.length : 0,\n        );\n      }\n      return;\n    }\n\n    // localStorage自体を読めない状態では、nativeの結果だけで上書き可否を決めない。\n    if (primaryHealth === "unavailable" || nativeResult.status === "error") {\n      nativeRecoveryGateRef.current = true;\n      saveGuardRef.current = true;\n      setNativeRecoveryStatus("error");\n      setNativeBackupRetryAllowed(false);\n      return;\n    }\n\n    if (nativeResult.status === "available") {\n      const nativeSnapshot = nativeResult.notes;\n      nativeRecoveryGateRef.current = false;\n      setNativeRecoveryStatus("idle");\n      saveGuardRef.current = true;\n      externalConflictRef.current = true;\n      dirtySinceRef.current = null;\n      baselineNotesRef.current = nativeSnapshot;\n      latestNotesRef.current = nativeSnapshot;\n      setNotes(nativeSnapshot);\n      setLastSaveResult({ ok: false, reason: "conflict" });\n      setExternalConflict(true);\n      setCanLoadStoredNotes(false);\n      setRecoveryCandidateCount(nativeSnapshot.length);\n      setLoadError(false);\n      setNativeBackupError(false);\n      setNativeBackupRetryAllowed(false);\n      return;\n    }\n\n    // primary/backupの不存在を正常に確認できた時だけfresh installとして編集を解放する。\n    nativeRecoveryGateRef.current = false;\n    setNativeRecoveryStatus("idle");\n    saveGuardRef.current = initialLoad.loadFailed;\n  }, [\n    applyCleanRemoteNotes,\n    clearPersistTimer,\n    flagExternalConflict,\n    initialLoad.loadFailed,\n    persistDurableSnapshot,\n  ]);\n\n  useEffect(() => {\n    if (!isNativeDurableSnapshotAvailable()) return undefined;\n\n    if (nativeRecoveryInitiallyRequired) {\n      void probeNativeRecovery();\n      return () => {\n        nativeRecoveryProbeIdRef.current += 1;\n      };\n    }\n\n    // 正常localStorageがある既存ユーザーは初回Phase38起動でnative耐久層へ移行する。\n    if (initialLoad.primaryHealth === "valid" && !initialLoad.loadFailed) {\n      persistDurableSnapshot(baselineNotesRef.current);\n    }\n    return undefined;\n  }, [\n    initialLoad.loadFailed,\n    initialLoad.primaryHealth,\n    nativeRecoveryInitiallyRequired,\n    persistDurableSnapshot,\n    probeNativeRecovery,\n  ]);\n\n  const retryNativeRecovery = useCallback(() => {\n    void probeNativeRecovery();\n  }, [probeNativeRecovery]);'''
replace_once("src/App.tsx", old_effect, new_effect)

replace_once(
    "src/App.tsx",
    '''      if (notesStorageChanged) {\n        const remote = loadNotes();''',
    '''      if (notesStorageChanged) {\n        // startup native probe中のstorage変更はprobe完了時に現在primaryを再評価する。\n        // ここで競合扱いにすると、ユーザー編集が無いのに不要なconflictへ昇格してしまう。\n        if (nativeRecoveryGateRef.current) return;\n\n        const remote = loadNotes();''',
)

replace_once(
    "src/App.tsx",
    '''  const createNote = useCallback(() => {\n    markNotesDirty();''',
    '''  const createNote = useCallback(() => {\n    if (!markNotesDirty()) return;''',
)
replace_once(
    "src/App.tsx",
    '''    (id: string, patch: Partial<Pick<Note, "title" | "body" | "isFavorite">>) => {\n      markNotesDirty();''',
    '''    (id: string, patch: Partial<Pick<Note, "title" | "body" | "isFavorite">>) => {\n      if (!markNotesDirty()) return;''',
)
replace_once(
    "src/App.tsx",
    '''      if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);\n      const deleted: DeletedNote = { ...target, deletedAt: nowIso() };\n\n      markNotesDirty();''',
    '''      if (!markNotesDirty()) return;\n\n      if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);\n      const deleted: DeletedNote = { ...target, deletedAt: nowIso() };''',
)
replace_once(
    "src/App.tsx",
    '''  const undoDelete = useCallback(() => {\n    if (!lastDeleted) return;\n\n    if (undoTimerRef.current) {''',
    '''  const undoDelete = useCallback(() => {\n    if (!lastDeleted || !markNotesDirty()) return;\n\n    if (undoTimerRef.current) {''',
)
replace_once(
    "src/App.tsx",
    '''    const { deletedAt: _, ...note } = lastDeleted;\n    markNotesDirty();\n    setNotes''',
    '''    const { deletedAt: _, ...note } = lastDeleted;\n    setNotes''',
)

replace_once(
    "src/App.tsx",
    '''      {(loadError || externalConflict || showGlobalSaveFailure || nativeBackupError) && (''',
    '''      {(loadError ||\n        externalConflict ||\n        showGlobalSaveFailure ||\n        nativeBackupError ||\n        nativeRecoveryStatus !== "idle") && (''',
)

banner_marker = '''          {loadError && ('''
banners = '''          {nativeRecoveryStatus === "checking" && (\n            <div\n              data-testid="native-recovery-checking"\n              role="status"\n              aria-live="polite"\n              className="pointer-events-auto border border-gold/25 bg-paper px-gr-4 py-gr-3 font-mincho text-[12px] leading-ample text-sumi shadow-paper-hover animate-fadeIn"\n              style={{ borderRadius: "7px 13px 8px 11px" }}\n            >\n              {copy.nativeRecoveryChecking}\n            </div>\n          )}\n\n          {nativeRecoveryStatus === "error" && (\n            <div\n              data-testid="native-recovery-error"\n              role="alert"\n              aria-live="assertive"\n              className="pointer-events-auto flex flex-wrap items-center justify-between gap-gr-3 border border-vermilion/30 bg-paper px-gr-4 py-gr-3 text-sumi shadow-paper-hover animate-fadeIn"\n              style={{ borderRadius: "7px 13px 8px 11px" }}\n            >\n              <span className="font-mincho text-[12px] leading-ample jp-text-discipline">\n                {copy.nativeRecoveryReadError}\n              </span>\n              <button\n                type="button"\n                onClick={retryNativeRecovery}\n                className="min-h-[44px] shrink-0 rounded-full border border-gold/35 px-gr-3 py-gr-2 font-mincho text-[11px] tracking-mincho text-sumi transition-soft hover:bg-washi active:scale-[0.98]"\n              >\n                {copy.nativeRecoveryRetry}\n              </button>\n            </div>\n          )}\n\n'''
replace_once("src/App.tsx", banner_marker, banners + banner_marker)

replace_once(
    "src/lib/i18n.ts",
    '''  nativeBackupRetry: "予備保存をもう一度作る",\n''',
    '''  nativeBackupRetry: "予備保存をもう一度作る",\n  nativeRecoveryChecking: "端末内の復元データを確認しています…",\n  nativeRecoveryReadError:\n    "端末内の復元データを確認できませんでした。上書きを防ぐため、編集と保存を止めています。",\n  nativeRecoveryRetry: "もう一度確認する",\n''',
)

Path("src/__tests__/App.native-durable-snapshot.test.tsx").write_text(r'''import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Note } from "../types/note";
import { copy } from "../lib/i18n";
import { STORAGE_KEY_FOR_TESTING } from "../lib/storage";

const durable = vi.hoisted(() => ({
  available: vi.fn(),
  read: vi.fn(),
  persist: vi.fn(),
}));

vi.mock("../lib/nativeDurableSnapshot", () => ({
  isNativeDurableSnapshotAvailable: durable.available,
  readNativeDurableSnapshot: durable.read,
  persistNativeDurableSnapshot: durable.persist,
}));

import App from "../App";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "note-1",
    title: "元のメモ",
    body: "本文",
    createdAt: "2026-08-28T00:00:00.000Z",
    updatedAt: "2026-08-28T00:00:00.000Z",
    isFavorite: false,
    locale: "ja",
    ...overrides,
  };
}

function mockLocalStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { Object.keys(store).forEach((key) => delete store[key]); }),
    get _store() { return store; },
  };
}

function click(element: Element) {
  element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function findButton(container: HTMLElement, text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
    candidate.textContent?.includes(text),
  );
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Button not found: ${text}`);
  return button;
}

function hasButton(container: HTMLElement, text: string): boolean {
  return Array.from(container.querySelectorAll("button")).some((candidate) =>
    candidate.textContent?.includes(text),
  );
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("App native durable snapshot", () => {
  let storage: ReturnType<typeof mockLocalStorage>;
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    durable.available.mockReset();
    durable.read.mockReset();
    durable.persist.mockReset();
    durable.available.mockReturnValue(true);
    durable.read.mockResolvedValue({ status: "missing" });
    durable.persist.mockResolvedValue(true);
    storage = mockLocalStorage();
    Object.defineProperty(window, "localStorage", { value: storage, configurable: true });
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container.remove();
    vi.useRealTimers();
  });

  function renderApp() {
    root = createRoot(container);
    act(() => root?.render(<App />));
  }

  it("localStorage primary消失時はnative snapshotを画面に復元候補として表示し自動上書きしない", async () => {
    const recovered = [makeNote({ title: "nativeから救出" })];
    durable.read.mockResolvedValue({ status: "available", notes: recovered });
    renderApp();
    await flushPromises();

    expect(container.textContent).toContain("nativeから救出");
    expect(container.textContent).toContain(copy.storageRecoveryTitle);
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBeUndefined();
    expect(durable.persist).not.toHaveBeenCalled();

    act(() => click(findButton(container, copy.storageRecoverySave)));
    await flushPromises();

    expect(JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[]).toEqual(recovered);
    expect(durable.persist).toHaveBeenCalledWith(recovered);
  });

  it("native復旧読込が遅くても確認完了前の新規編集とautosaveを開始しない", async () => {
    const recovered = [makeNote({ title: "遅れて見つかったnative" })];
    let resolveRead!: (value: { status: "available"; notes: Note[] }) => void;
    durable.read.mockReturnValue(
      new Promise((resolve) => {
        resolveRead = resolve;
      }),
    );

    renderApp();
    expect(container.textContent).toContain(copy.nativeRecoveryChecking);

    act(() => click(findButton(container, copy.emptyAction)));
    act(() => vi.advanceTimersByTime(1_000));
    await flushPromises();

    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBeUndefined();
    expect(container.querySelector("textarea")).toBeNull();
    expect(durable.persist).not.toHaveBeenCalled();

    await act(async () => {
      resolveRead({ status: "available", notes: recovered });
      await Promise.resolve();
    });
    await flushPromises();

    expect(container.textContent).toContain("遅れて見つかったnative");
    expect(container.textContent).toContain(copy.storageRecoveryTitle);
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBeUndefined();
  });

  it("native読込障害はfresh install扱いせず編集を止め、retryでmissing確認後に解放する", async () => {
    durable.read
      .mockResolvedValueOnce({ status: "error" })
      .mockResolvedValue({ status: "missing" });

    renderApp();
    await flushPromises();

    expect(container.textContent).toContain(copy.nativeRecoveryReadError);
    expect(hasButton(container, copy.nativeRecoveryRetry)).toBe(true);
    act(() => click(findButton(container, copy.emptyAction)));
    act(() => vi.advanceTimersByTime(1_000));
    await flushPromises();
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBeUndefined();
    expect(container.querySelector("textarea")).toBeNull();

    act(() => click(findButton(container, copy.nativeRecoveryRetry)));
    await flushPromises();
    expect(container.textContent).not.toContain(copy.nativeRecoveryReadError);

    act(() => click(findButton(container, copy.emptyAction)));
    expect(container.querySelector("textarea")).not.toBeNull();
    act(() => vi.advanceTimersByTime(500));
    await flushPromises();
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBeDefined();
  });

  it("native側の空配列も意図的な全削除状態として明示復旧候補にする", async () => {
    durable.read.mockResolvedValue({ status: "available", notes: [] });
    renderApp();
    await flushPromises();

    expect(container.textContent).toContain(copy.storageRecoveryTitle);
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBeUndefined();
    act(() => click(findButton(container, copy.storageRecoverySave)));
    await flushPromises();
    expect(JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[]).toEqual([]);
  });

  it("既存の正常localStorageは初回起動時にnative耐久層へ移行する", async () => {
    const existing = [makeNote()];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(existing);
    renderApp();
    await flushPromises();
    expect(durable.persist).toHaveBeenCalledWith(existing);
  });

  it("通常autosave成功後は最新snapshotをnative側にも保存する", async () => {
    const existing = [makeNote()];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(existing);
    renderApp();
    await flushPromises();
    durable.persist.mockClear();

    act(() => click(findButton(container, "元のメモ")));
    act(() => click(findButton(container, copy.editNote)));
    const textarea = container.querySelector("textarea");
    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("textarea not found");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    act(() => {
      setter?.call(textarea, "nativeにも残す本文");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => vi.advanceTimersByTime(500));
    await flushPromises();

    const latest = JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[];
    expect(latest[0].body).toBe("nativeにも残す本文");
    expect(durable.persist).toHaveBeenCalledWith(latest);
  });

  it("clean状態で正常な外部保存版へ追従したらnative耐久層も同じ正本へ更新する", async () => {
    const existing = [makeNote()];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(existing);
    renderApp();
    await flushPromises();
    durable.persist.mockClear();

    const remote = [makeNote({ title: "外部の正本", updatedAt: "2026-08-28T00:01:00.000Z" })];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(remote);
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: STORAGE_KEY_FOR_TESTING, newValue: JSON.stringify(remote) }),
      );
    });
    await flushPromises();

    expect(container.textContent).toContain("外部の正本");
    expect(durable.persist).toHaveBeenCalledWith(remote);
  });

  it("競合で保存済み版を明示採用したら捨てたlocal版をnative復元候補に残さない", async () => {
    const existing = [makeNote()];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(existing);
    renderApp();
    await flushPromises();
    durable.persist.mockClear();

    act(() => click(findButton(container, "元のメモ")));
    act(() => click(findButton(container, copy.editNote)));
    const textarea = container.querySelector("textarea");
    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("textarea not found");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    act(() => {
      setter?.call(textarea, "捨てる未保存編集");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const remote = [makeNote({ title: "採用する保存済み版", updatedAt: "2026-08-28T00:02:00.000Z" })];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(remote);
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: STORAGE_KEY_FOR_TESTING, newValue: JSON.stringify(remote) }),
      );
    });
    expect(container.textContent).toContain(copy.storageConflictTitle);
    expect(durable.persist).not.toHaveBeenCalled();

    act(() => click(findButton(container, copy.storageConflictLoad)));
    await flushPromises();

    expect(JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[]).toEqual(remote);
    expect(container.textContent).not.toContain(copy.storageConflictTitle);
    expect(durable.persist).toHaveBeenCalledWith(remote);
  });

  it("native予備保存失敗を非致命warningとして表示し、retry成功で消す", async () => {
    const existing = [makeNote()];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(existing);
    durable.persist.mockResolvedValueOnce(false).mockResolvedValue(true);
    renderApp();
    await flushPromises();

    expect(container.querySelector('[data-testid="native-backup-failure"]')).not.toBeNull();
    expect(container.textContent).toContain(copy.nativeBackupError);

    act(() => click(findButton(container, copy.nativeBackupRetry)));
    await flushPromises();

    expect(container.querySelector('[data-testid="native-backup-failure"]')).toBeNull();
  });

  it("native予備保存Retryは編集開始時に即座に無効化しinert buttonを残さない", async () => {
    const existing = [makeNote()];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(existing);
    durable.persist.mockResolvedValueOnce(false).mockResolvedValue(true);
    renderApp();
    await flushPromises();
    expect(hasButton(container, copy.nativeBackupRetry)).toBe(true);

    act(() => click(findButton(container, "元のメモ")));
    act(() => click(findButton(container, copy.editNote)));
    const textarea = container.querySelector("textarea");
    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("textarea not found");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    act(() => {
      setter?.call(textarea, "dirtyにする");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="native-backup-failure"]')).not.toBeNull();
    expect(hasButton(container, copy.nativeBackupRetry)).toBe(false);
  });
});
''')
