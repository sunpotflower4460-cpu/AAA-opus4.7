from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}")
    file.write_text(text.replace(old, new, 1))


# storage.ts: expose safe snapshot validation + primary health without weakening existing save rules.
replace_once(
    "src/lib/storage.ts",
    '''function parseNotesRaw(raw: string): ParsedNotesResult {''',
    '''function parseNotesRaw(raw: string): ParsedNotesResult {''',
)

anchor = '''function notesMatch(left: readonly Note[], right: readonly Note[]): boolean {'''
insert = '''export function parseValidNotesSnapshot(raw: string): Note[] | null {\n  const parsed = parseNotesRaw(raw);\n  return parsed.status === "valid" ? parsed.notes : null;\n}\n\nexport type NotesPrimaryHealth = "missing" | "valid" | "invalid" | "unavailable";\n\nexport function getNotesPrimaryHealth(): NotesPrimaryHealth {\n  if (typeof window === "undefined") return "unavailable";\n  try {\n    const raw = window.localStorage.getItem(STORAGE_KEY);\n    if (raw === null) return "missing";\n    return parseNotesRaw(raw).status === "valid" ? "valid" : "invalid";\n  } catch {\n    return "unavailable";\n  }\n}\n\n'''
replace_once("src/lib/storage.ts", anchor, insert + anchor)

# New native durable snapshot layer.
Path("src/lib/nativeDurableSnapshot.ts").write_text('''import { Capacitor } from "@capacitor/core";\nimport { Directory, Encoding, Filesystem } from "@capacitor/filesystem";\nimport type { Note } from "../types/note";\nimport { parseValidNotesSnapshot } from "./storage";\n\nconst PRIMARY_PATH = "zanshin/notes.snapshot.v1.json";\nconst BACKUP_PATH = "zanshin/notes.snapshot.backup.v1.json";\nconst CORRUPT_PATH = "zanshin/notes.snapshot.corrupt.v1.json";\nconst DIRECTORY = Directory.LibraryNoCloud;\n\nlet writeChain: Promise<void> = Promise.resolve();\n\nfunction isNativeRuntime(): boolean {\n  return Capacitor.isNativePlatform();\n}\n\nasync function readRaw(path: string): Promise<string | null> {\n  try {\n    const result = await Filesystem.readFile({ path, directory: DIRECTORY, encoding: Encoding.UTF8 });\n    return typeof result.data === "string" ? result.data : null;\n  } catch {\n    return null;\n  }\n}\n\nasync function writeRaw(path: string, data: string): Promise<void> {\n  await Filesystem.writeFile({\n    path,\n    data,\n    directory: DIRECTORY,\n    encoding: Encoding.UTF8,\n    recursive: true,\n  });\n}\n\nasync function writeSnapshotRaw(nextRaw: string): Promise<void> {\n  const currentRaw = await readRaw(PRIMARY_PATH);\n  if (currentRaw === nextRaw) return;\n\n  if (currentRaw !== null) {\n    if (parseValidNotesSnapshot(currentRaw) !== null) {\n      // 新しい primary に触る前に、直前の正常世代を確定する。\n      // ここが失敗した場合は current primary を残し、新版へ進まない。\n      await writeRaw(BACKUP_PATH, currentRaw);\n    } else {\n      // 破損した native snapshot も診断・救済余地を残すが、退避失敗は新版保存を妨げない。\n      try {\n        await writeRaw(CORRUPT_PATH, currentRaw);\n      } catch {\n        // best effort\n      }\n    }\n  }\n\n  await writeRaw(PRIMARY_PATH, nextRaw);\n}\n\n/**\n * localStorage の同期保存を置き換えず、native 側に耐久スナップショットを直列保存する。\n * 呼び出し順を Promise chain で固定し、古い非同期 write が新しい内容を後から巻き戻すのを防ぐ。\n */\nexport function persistNativeDurableSnapshot(notes: readonly Note[]): Promise<boolean> {\n  if (!isNativeRuntime()) return Promise.resolve(true);\n\n  let raw: string;\n  try {\n    raw = JSON.stringify(notes);\n  } catch {\n    return Promise.resolve(false);\n  }\n  if (parseValidNotesSnapshot(raw) === null) return Promise.resolve(false);\n\n  const operation = writeChain\n    .catch(() => {\n      // 前回失敗が次回のretryを永久に止めないようchainだけ回復する。\n    })\n    .then(() => writeSnapshotRaw(raw));\n\n  writeChain = operation.catch(() => {\n    // 次回保存を継続可能にするため内部chainでは吸収する。\n  });\n\n  return operation.then(\n    () => true,\n    () => false,\n  );\n}\n\n/** localStorage 消失/破損時の復元候補。primary が壊れていれば1世代前へフォールバックする。 */\nexport async function readNativeDurableSnapshot(): Promise<Note[] | null> {\n  if (!isNativeRuntime()) return null;\n\n  await writeChain.catch(() => {});\n\n  const primaryRaw = await readRaw(PRIMARY_PATH);\n  if (primaryRaw !== null) {\n    const primary = parseValidNotesSnapshot(primaryRaw);\n    if (primary !== null) return primary;\n  }\n\n  const backupRaw = await readRaw(BACKUP_PATH);\n  return backupRaw === null ? null : parseValidNotesSnapshot(backupRaw);\n}\n\nexport function resetNativeDurableSnapshotQueueForTesting(): void {\n  writeChain = Promise.resolve();\n}\n\nexport const NATIVE_SNAPSHOT_PATHS_FOR_TESTING = {\n  primary: PRIMARY_PATH,\n  backup: BACKUP_PATH,\n  corrupt: CORRUPT_PATH,\n} as const;\n''')

# App imports.
replace_once(
    "src/App.tsx",
    '''  isRetryableSaveFailure,\n  loadNotes,\n  NOTES_STORAGE_KEY,\n  saveNotes,\n} from "./lib/storage";''',
    '''  getNotesPrimaryHealth,\n  isRetryableSaveFailure,\n  loadNotes,\n  NOTES_STORAGE_KEY,\n  saveNotes,\n} from "./lib/storage";''',
)
replace_once(
    "src/App.tsx",
    '''import { subscribeToNativeAppState } from "./lib/nativeAppLifecycle";\n''',
    '''import { subscribeToNativeAppState } from "./lib/nativeAppLifecycle";\nimport {\n  persistNativeDurableSnapshot,\n  readNativeDurableSnapshot,\n} from "./lib/nativeDurableSnapshot";\n''',
)

# App state.
replace_once(
    "src/App.tsx",
    '''  const [recoveryCandidateCount, setRecoveryCandidateCount] = useState(\n    initialLoad.recoveredCount,\n  );\n''',
    '''  const [recoveryCandidateCount, setRecoveryCandidateCount] = useState(\n    initialLoad.recoveredCount,\n  );\n  const [nativeBackupError, setNativeBackupError] = useState(false);\n''',
)

# Add mounted guard and durable persistence helper before clearPersistTimer.
replace_once(
    "src/App.tsx",
    '''  const externalConflictRef = useRef(initialLoad.recoveryPending);\n\n  // pagehide は非常に早く来ることがあるため、paint 前に flush 用 snapshot を更新する。''',
    '''  const externalConflictRef = useRef(initialLoad.recoveryPending);\n  const mountedRef = useRef(true);\n\n  useEffect(() => {\n    mountedRef.current = true;\n    return () => {\n      mountedRef.current = false;\n    };\n  }, []);\n\n  const persistDurableSnapshot = useCallback((snapshot: readonly Note[]) => {\n    void persistNativeDurableSnapshot(snapshot).then((ok) => {\n      if (mountedRef.current) setNativeBackupError(!ok);\n    });\n  }, []);\n\n  // pagehide は非常に早く来ることがあるため、paint 前に flush 用 snapshot を更新する。''',
)

# Successful local save also updates native durable snapshot.
replace_once(
    "src/App.tsx",
    '''        setRecoveryCandidateCount(0);\n        setLoadError(false);\n        return;''',
    '''        setRecoveryCandidateCount(0);\n        setLoadError(false);\n        persistDurableSnapshot(snapshot);\n        return;''',
)
replace_once(
    "src/App.tsx",
    '''    [flagExternalConflict],\n  );\n\n  useEffect(() => {\n    clearPersistTimer();''',
    '''    [flagExternalConflict, persistDurableSnapshot],\n  );\n\n  useEffect(() => {\n    clearPersistTimer();''',
)

# Startup native migration/recovery effect before autosave effect.
marker = '''  useEffect(() => {\n    clearPersistTimer();\n\n    if (\n      saveGuardRef.current ||'''
startup_effect = '''  useEffect(() => {\n    let cancelled = false;\n\n    void readNativeDurableSnapshot().then((nativeSnapshot) => {\n      if (cancelled) return;\n\n      const primaryHealth = getNotesPrimaryHealth();\n      const canAdoptNativeRecovery =\n        nativeSnapshot !== null &&\n        nativeSnapshot.length > 0 &&\n        (primaryHealth === "missing" || primaryHealth === "invalid") &&\n        !notesDirtyRef.current &&\n        !externalConflictRef.current;\n\n      if (canAdoptNativeRecovery && nativeSnapshot) {\n        clearPersistTimer();\n        saveGuardRef.current = true;\n        externalConflictRef.current = true;\n        dirtySinceRef.current = null;\n        baselineNotesRef.current = nativeSnapshot;\n        latestNotesRef.current = nativeSnapshot;\n        setNotes(nativeSnapshot);\n        setLastSaveResult({ ok: false, reason: "conflict" });\n        setExternalConflict(true);\n        setCanLoadStoredNotes(false);\n        setRecoveryCandidateCount(nativeSnapshot.length);\n        setLoadError(false);\n        setNativeBackupError(false);\n        return;\n      }\n\n      // 既存ユーザーは最初のPhase38起動で、正常localStorageをnative耐久層へ移行する。\n      if (primaryHealth === "valid" && !initialLoad.loadFailed) {\n        persistDurableSnapshot(baselineNotesRef.current);\n      }\n    });\n\n    return () => {\n      cancelled = true;\n    };\n  }, [clearPersistTimer, initialLoad.loadFailed, persistDurableSnapshot]);\n\n'''
replace_once("src/App.tsx", marker, startup_effect + marker)

# Native backup retry callback before openNote.
replace_once(
    "src/App.tsx",
    '''  const openNote = useCallback((id: string) => {''',
    '''  const retryNativeBackup = useCallback(() => {\n    if (\n      notesDirtyRef.current ||\n      saveGuardRef.current ||\n      externalConflictRef.current\n    ) {\n      return;\n    }\n    persistDurableSnapshot(baselineNotesRef.current);\n  }, [persistDurableSnapshot]);\n\n  const openNote = useCallback((id: string) => {''',
)

# Render flags.
replace_once(
    "src/App.tsx",
    '''  const canRetryGlobalSave =\n    showGlobalSaveFailure &&\n    !externalConflict &&\n    isRetryableSaveFailure(lastSaveResult);\n''',
    '''  const canRetryGlobalSave =\n    showGlobalSaveFailure &&\n    !externalConflict &&\n    isRetryableSaveFailure(lastSaveResult);\n  const canRetryNativeBackup =\n    nativeBackupError &&\n    !notesDirtyRef.current &&\n    !saveGuardRef.current &&\n    !externalConflictRef.current;\n''',
)
replace_once(
    "src/App.tsx",
    '''      {(loadError || externalConflict || showGlobalSaveFailure) && (''',
    '''      {(loadError || externalConflict || showGlobalSaveFailure || nativeBackupError) && (''',
)

# Native backup warning banner before global save failure.
replace_once(
    "src/App.tsx",
    '''\n\n          {showGlobalSaveFailure && globalSaveFailureMessage && (''',
    '''\n\n          {nativeBackupError && (\n            <div\n              data-testid="native-backup-failure"\n              role="alert"\n              aria-live="polite"\n              className="pointer-events-auto flex flex-wrap items-center justify-between gap-gr-3 border border-gold/35 bg-paper px-gr-4 py-gr-3 text-sumi shadow-paper-hover animate-fadeIn"\n              style={{ borderRadius: "7px 13px 8px 11px" }}\n            >\n              <span className="font-mincho text-[12px] leading-ample jp-text-discipline">\n                {copy.nativeBackupError}\n              </span>\n              {canRetryNativeBackup && (\n                <button\n                  type="button"\n                  onClick={retryNativeBackup}\n                  className="min-h-[44px] shrink-0 rounded-full border border-gold/35 px-gr-3 py-gr-2 font-mincho text-[11px] tracking-mincho text-sumi transition-soft hover:bg-washi active:scale-[0.98]"\n                >\n                  {copy.nativeBackupRetry}\n                </button>\n              )}\n            </div>\n          )}\n\n          {showGlobalSaveFailure && globalSaveFailureMessage && (''',
)

# Copy.
replace_once(
    "src/lib/i18n.ts",
    '''  retrySaveEn: "Try saving again",\n''',
    '''  retrySaveEn: "Try saving again",\n  nativeBackupError:\n    "メモ本体は保存されていますが、端末内の予備保存を更新できませんでした。",\n  nativeBackupRetry: "予備保存をもう一度作る",\n''',
)

# Storage primary health tests.
Path("src/lib/__tests__/storage.primaryHealth.test.ts").write_text('''import { beforeEach, describe, expect, it, vi } from "vitest";\nimport { getNotesPrimaryHealth, STORAGE_KEY_FOR_TESTING } from "../storage";\nimport type { Note } from "../../types/note";\n\nconst note: Note = {\n  id: "one",\n  title: "保存済み",\n  body: "本文",\n  createdAt: "2026-08-28T00:00:00.000Z",\n  updatedAt: "2026-08-28T00:00:00.000Z",\n  isFavorite: false,\n  locale: "ja",\n};\n\ndescribe("notes primary health", () => {\n  const store: Record<string, string> = {};\n\n  beforeEach(() => {\n    Object.keys(store).forEach((key) => delete store[key]);\n    Object.defineProperty(window, "localStorage", {\n      configurable: true,\n      value: {\n        getItem: vi.fn((key: string) => store[key] ?? null),\n      },\n    });\n  });\n\n  it("primary未作成はmissing", () => {\n    expect(getNotesPrimaryHealth()).toBe("missing");\n  });\n\n  it("正常primaryはvalid", () => {\n    store[STORAGE_KEY_FOR_TESTING] = JSON.stringify([note]);\n    expect(getNotesPrimaryHealth()).toBe("valid");\n  });\n\n  it("破損primaryはinvalid", () => {\n    store[STORAGE_KEY_FOR_TESTING] = "{broken";\n    expect(getNotesPrimaryHealth()).toBe("invalid");\n  });\n\n  it("localStorage読込不能はunavailable", () => {\n    Object.defineProperty(window, "localStorage", {\n      configurable: true,\n      value: {\n        getItem: vi.fn(() => {\n          throw new DOMException("blocked", "SecurityError");\n        }),\n      },\n    });\n    expect(getNotesPrimaryHealth()).toBe("unavailable");\n  });\n});\n''')

# Durable snapshot module tests.
Path("src/lib/__tests__/nativeDurableSnapshot.test.ts").write_text('''import { beforeEach, describe, expect, it, vi } from "vitest";\nimport type { Note } from "../../types/note";\n\nconst mocks = vi.hoisted(() => ({\n  isNativePlatform: vi.fn(),\n  readFile: vi.fn(),\n  writeFile: vi.fn(),\n}));\n\nvi.mock("@capacitor/core", () => ({\n  Capacitor: { isNativePlatform: mocks.isNativePlatform },\n}));\n\nvi.mock("@capacitor/filesystem", () => ({\n  Directory: { LibraryNoCloud: "LIBRARY_NO_CLOUD" },\n  Encoding: { UTF8: "utf8" },\n  Filesystem: { readFile: mocks.readFile, writeFile: mocks.writeFile },\n}));\n\nimport {\n  NATIVE_SNAPSHOT_PATHS_FOR_TESTING,\n  persistNativeDurableSnapshot,\n  readNativeDurableSnapshot,\n  resetNativeDurableSnapshotQueueForTesting,\n} from "../nativeDurableSnapshot";\n\nfunction makeNote(title: string, minute = 0): Note {\n  return {\n    id: "one",\n    title,\n    body: "本文",\n    createdAt: "2026-08-28T00:00:00.000Z",\n    updatedAt: `2026-08-28T00:${String(minute).padStart(2, "0")}:00.000Z`,\n    isFavorite: false,\n    locale: "ja",\n  };\n}\n\ndescribe("native durable snapshot", () => {\n  const files = new Map<string, string>();\n\n  beforeEach(() => {\n    files.clear();\n    resetNativeDurableSnapshotQueueForTesting();\n    mocks.isNativePlatform.mockReset();\n    mocks.readFile.mockReset();\n    mocks.writeFile.mockReset();\n    mocks.isNativePlatform.mockReturnValue(true);\n    mocks.readFile.mockImplementation(async ({ path }: { path: string }) => {\n      const data = files.get(path);\n      if (data === undefined) throw new Error("not found");\n      return { data };\n    });\n    mocks.writeFile.mockImplementation(async ({ path, data }: { path: string; data: string }) => {\n      files.set(path, data);\n      return { uri: path };\n    });\n  });\n\n  it("webではnative filesystemへ触れず成功扱い", async () => {\n    mocks.isNativePlatform.mockReturnValue(false);\n    expect(await persistNativeDurableSnapshot([makeNote("web")])).toBe(true);\n    expect(mocks.readFile).not.toHaveBeenCalled();\n    expect(mocks.writeFile).not.toHaveBeenCalled();\n    expect(await readNativeDurableSnapshot()).toBeNull();\n  });\n\n  it("初回はprimary snapshotを書き込む", async () => {\n    const notes = [makeNote("初回")];\n    expect(await persistNativeDurableSnapshot(notes)).toBe(true);\n    expect(files.get(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary)).toBe(JSON.stringify(notes));\n  });\n\n  it("更新時は旧primaryをbackupへ確定してから新版を書く", async () => {\n    const oldNotes = [makeNote("旧版")];\n    const newNotes = [makeNote("新版", 1)];\n    files.set(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary, JSON.stringify(oldNotes));\n\n    expect(await persistNativeDurableSnapshot(newNotes)).toBe(true);\n    expect(files.get(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.backup)).toBe(JSON.stringify(oldNotes));\n    expect(files.get(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary)).toBe(JSON.stringify(newNotes));\n  });\n\n  it("同一snapshotならfilesystem書込を行わない", async () => {\n    const notes = [makeNote("同一")];\n    files.set(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary, JSON.stringify(notes));\n    expect(await persistNativeDurableSnapshot(notes)).toBe(true);\n    expect(mocks.writeFile).not.toHaveBeenCalled();\n  });\n\n  it("primary破損時は正常backupを復元候補として返す", async () => {\n    const backup = [makeNote("backup")];\n    files.set(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary, "{broken");\n    files.set(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.backup, JSON.stringify(backup));\n    expect(await readNativeDurableSnapshot()).toEqual(backup);\n  });\n\n  it("新版primary書込失敗時も旧世代backupを残して失敗を返す", async () => {\n    const oldNotes = [makeNote("旧版")];\n    const newNotes = [makeNote("新版", 1)];\n    files.set(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary, JSON.stringify(oldNotes));\n    mocks.writeFile.mockImplementation(async ({ path, data }: { path: string; data: string }) => {\n      if (path === NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary) throw new Error("disk failure");\n      files.set(path, data);\n      return { uri: path };\n    });\n\n    expect(await persistNativeDurableSnapshot(newNotes)).toBe(false);\n    expect(files.get(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.backup)).toBe(JSON.stringify(oldNotes));\n    expect(files.get(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary)).toBe(JSON.stringify(oldNotes));\n  });\n\n  it("非同期保存は呼出順に直列化され、旧版が新版を後から巻き戻さない", async () => {\n    const first = [makeNote("first")];\n    const second = [makeNote("second", 1)];\n    let releaseFirst!: () => void;\n    const gate = new Promise<void>((resolve) => {\n      releaseFirst = resolve;\n    });\n    let primaryWrites = 0;\n    mocks.writeFile.mockImplementation(async ({ path, data }: { path: string; data: string }) => {\n      if (path === NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary) {\n        primaryWrites += 1;\n        if (primaryWrites === 1) await gate;\n      }\n      files.set(path, data);\n      return { uri: path };\n    });\n\n    const firstSave = persistNativeDurableSnapshot(first);\n    const secondSave = persistNativeDurableSnapshot(second);\n    await Promise.resolve();\n    expect(primaryWrites).toBe(1);\n\n    releaseFirst();\n    expect(await firstSave).toBe(true);\n    expect(await secondSave).toBe(true);\n    expect(files.get(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary)).toBe(JSON.stringify(second));\n  });\n});\n''')

# App-level native durable snapshot behavior.
Path("src/__tests__/App.native-durable-snapshot.test.tsx").write_text('''import { act } from "react";\nimport { createRoot, type Root } from "react-dom/client";\nimport { afterEach, beforeEach, describe, expect, it, vi } from "vitest";\nimport type { Note } from "../types/note";\nimport { copy } from "../lib/i18n";\nimport { STORAGE_KEY_FOR_TESTING } from "../lib/storage";\n\nconst durable = vi.hoisted(() => ({\n  read: vi.fn(),\n  persist: vi.fn(),\n}));\n\nvi.mock("../lib/nativeDurableSnapshot", () => ({\n  readNativeDurableSnapshot: durable.read,\n  persistNativeDurableSnapshot: durable.persist,\n}));\n\nimport App from "../App";\n\n(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;\n\nfunction makeNote(overrides: Partial<Note> = {}): Note {\n  return {\n    id: "note-1",\n    title: "元のメモ",\n    body: "本文",\n    createdAt: "2026-08-28T00:00:00.000Z",\n    updatedAt: "2026-08-28T00:00:00.000Z",\n    isFavorite: false,\n    locale: "ja",\n    ...overrides,\n  };\n}\n\nfunction mockLocalStorage() {\n  const store: Record<string, string> = {};\n  return {\n    getItem: vi.fn((key: string) => store[key] ?? null),\n    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),\n    removeItem: vi.fn((key: string) => { delete store[key]; }),\n    clear: vi.fn(() => { Object.keys(store).forEach((key) => delete store[key]); }),\n    get _store() { return store; },\n  };\n}\n\nfunction click(element: Element) {\n  element.dispatchEvent(new MouseEvent("click", { bubbles: true }));\n}\n\nfunction findButton(container: HTMLElement, text: string): HTMLButtonElement {\n  const button = Array.from(container.querySelectorAll("button")).find((candidate) =>\n    candidate.textContent?.includes(text),\n  );\n  if (!(button instanceof HTMLButtonElement)) throw new Error(`Button not found: ${text}`);\n  return button;\n}\n\nasync function flushPromises() {\n  await act(async () => {\n    await Promise.resolve();\n    await Promise.resolve();\n  });\n}\n\ndescribe("App native durable snapshot", () => {\n  let storage: ReturnType<typeof mockLocalStorage>;\n  let container: HTMLDivElement;\n  let root: Root | null = null;\n\n  beforeEach(() => {\n    vi.useFakeTimers();\n    durable.read.mockReset();\n    durable.persist.mockReset();\n    durable.read.mockResolvedValue(null);\n    durable.persist.mockResolvedValue(true);\n    storage = mockLocalStorage();\n    Object.defineProperty(window, "localStorage", { value: storage, configurable: true });\n    container = document.createElement("div");\n    document.body.appendChild(container);\n  });\n\n  afterEach(() => {\n    if (root) act(() => root?.unmount());\n    container.remove();\n    vi.useRealTimers();\n  });\n\n  function renderApp() {\n    root = createRoot(container);\n    act(() => root?.render(<App />));\n  }\n\n  it("localStorage primary消失時はnative snapshotを画面に復元候補として表示し自動上書きしない", async () => {\n    const recovered = [makeNote({ title: "nativeから救出" })];\n    durable.read.mockResolvedValue(recovered);\n    renderApp();\n    await flushPromises();\n\n    expect(container.textContent).toContain("nativeから救出");\n    expect(container.textContent).toContain(copy.storageRecoveryTitle);\n    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBeUndefined();\n    expect(durable.persist).not.toHaveBeenCalled();\n\n    act(() => click(findButton(container, copy.storageRecoverySave)));\n    await flushPromises();\n\n    expect(JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[]).toEqual(recovered);\n    expect(durable.persist).toHaveBeenCalledWith(recovered);\n  });\n\n  it("既存の正常localStorageは初回起動時にnative耐久層へ移行する", async () => {\n    const existing = [makeNote()];\n    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(existing);\n    renderApp();\n    await flushPromises();\n    expect(durable.persist).toHaveBeenCalledWith(existing);\n  });\n\n  it("通常autosave成功後は最新snapshotをnative側にも保存する", async () => {\n    const existing = [makeNote()];\n    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(existing);\n    renderApp();\n    await flushPromises();\n    durable.persist.mockClear();\n\n    act(() => click(findButton(container, "元のメモ")));\n    act(() => click(findButton(container, copy.editNote)));\n    const textarea = container.querySelector("textarea");\n    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("textarea not found");\n    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;\n    act(() => {\n      setter?.call(textarea, "nativeにも残す本文");\n      textarea.dispatchEvent(new Event("input", { bubbles: true }));\n    });\n    act(() => vi.advanceTimersByTime(500));\n    await flushPromises();\n\n    const latest = JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[];\n    expect(latest[0].body).toBe("nativeにも残す本文");\n    expect(durable.persist).toHaveBeenCalledWith(latest);\n  });\n\n  it("native予備保存失敗を非致命warningとして表示し、retry成功で消す", async () => {\n    const existing = [makeNote()];\n    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(existing);\n    durable.persist.mockResolvedValueOnce(false).mockResolvedValue(true);\n    renderApp();\n    await flushPromises();\n\n    expect(container.querySelector('[data-testid="native-backup-failure"]')).not.toBeNull();\n    expect(container.textContent).toContain(copy.nativeBackupError);\n\n    act(() => click(findButton(container, copy.nativeBackupRetry)));\n    await flushPromises();\n\n    expect(container.querySelector('[data-testid="native-backup-failure"]')).toBeNull();\n  });\n});\n''')

# Privacy manifest required by Filesystem plugin.
Path("ios/App/App/PrivacyInfo.xcprivacy").write_text('''<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n\t<key>NSPrivacyTracking</key>\n\t<false/>\n\t<key>NSPrivacyTrackingDomains</key>\n\t<array/>\n\t<key>NSPrivacyCollectedDataTypes</key>\n\t<array/>\n\t<key>NSPrivacyAccessedAPITypes</key>\n\t<array>\n\t\t<dict>\n\t\t\t<key>NSPrivacyAccessedAPIType</key>\n\t\t\t<string>NSPrivacyAccessedAPICategoryFileTimestamp</string>\n\t\t\t<key>NSPrivacyAccessedAPITypeReasons</key>\n\t\t\t<array>\n\t\t\t\t<string>C617.1</string>\n\t\t\t</array>\n\t\t</dict>\n\t</array>\n</dict>\n</plist>\n''')

# Explicitly add PrivacyInfo.xcprivacy to the App target resources.
pbx = "ios/App/App.xcodeproj/project.pbxproj"
replace_once(
    pbx,
    '''\t\t504EC30F1FED79650016851F /* Assets.xcassets in Resources */ = {isa = PBXBuildFile; fileRef = 504EC30E1FED79650016851F /* Assets.xcassets */; };''',
    '''\t\t504EC30F1FED79650016851F /* Assets.xcassets in Resources */ = {isa = PBXBuildFile; fileRef = 504EC30E1FED79650016851F /* Assets.xcassets */; };\n\t\tA38B00000000000000000001 /* PrivacyInfo.xcprivacy in Resources */ = {isa = PBXBuildFile; fileRef = A38F00000000000000000001 /* PrivacyInfo.xcprivacy */; };''',
)
replace_once(
    pbx,
    '''\t\t504EC3131FED79650016851F /* Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>"; };''',
    '''\t\t504EC3131FED79650016851F /* Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>"; };\n\t\tA38F00000000000000000001 /* PrivacyInfo.xcprivacy */ = {isa = PBXFileReference; lastKnownFileType = text.xml; path = PrivacyInfo.xcprivacy; sourceTree = "<group>"; };''',
)
replace_once(
    pbx,
    '''\t\t\t\t504EC3131FED79650016851F /* Info.plist */,''',
    '''\t\t\t\t504EC3131FED79650016851F /* Info.plist */,\n\t\t\t\tA38F00000000000000000001 /* PrivacyInfo.xcprivacy */,''',
)
replace_once(
    pbx,
    '''\t\t\t\t504EC30F1FED79650016851F /* Assets.xcassets in Resources */,''',
    '''\t\t\t\t504EC30F1FED79650016851F /* Assets.xcassets in Resources */,\n\t\t\t\tA38B00000000000000000001 /* PrivacyInfo.xcprivacy in Resources */,''',
)
