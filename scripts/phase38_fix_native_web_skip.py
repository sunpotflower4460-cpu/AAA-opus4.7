from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}")
    file.write_text(text.replace(old, new, 1))


# Expose one runtime gate so App can avoid creating native async state work in normal web tests/runtime.
replace_once(
    "src/lib/nativeDurableSnapshot.ts",
    '''function isNativeRuntime(): boolean {\n  return Capacitor.isNativePlatform();\n}\n''',
    '''export function isNativeDurableSnapshotAvailable(): boolean {\n  return Capacitor.isNativePlatform();\n}\n''',
)
replace_once(
    "src/lib/nativeDurableSnapshot.ts",
    '''  if (!isNativeRuntime()) return Promise.resolve(true);''',
    '''  if (!isNativeDurableSnapshotAvailable()) return Promise.resolve(true);''',
)
replace_once(
    "src/lib/nativeDurableSnapshot.ts",
    '''  if (!isNativeRuntime()) return null;''',
    '''  if (!isNativeDurableSnapshotAvailable()) return null;''',
)

# App uses the native-runtime gate before creating any Promise callback that can schedule React state updates.
replace_once(
    "src/App.tsx",
    '''import {\n  persistNativeDurableSnapshot,\n  readNativeDurableSnapshot,\n} from "./lib/nativeDurableSnapshot";''',
    '''import {\n  isNativeDurableSnapshotAvailable,\n  persistNativeDurableSnapshot,\n  readNativeDurableSnapshot,\n} from "./lib/nativeDurableSnapshot";''',
)
replace_once(
    "src/App.tsx",
    '''  const persistDurableSnapshot = useCallback((snapshot: readonly Note[]) => {\n    void persistNativeDurableSnapshot(snapshot).then((ok) => {''',
    '''  const persistDurableSnapshot = useCallback((snapshot: readonly Note[]) => {\n    if (!isNativeDurableSnapshotAvailable()) return;\n\n    void persistNativeDurableSnapshot(snapshot).then((ok) => {''',
)
replace_once(
    "src/App.tsx",
    '''  useEffect(() => {\n    let cancelled = false;\n\n    void readNativeDurableSnapshot().then((nativeSnapshot) => {''',
    '''  useEffect(() => {\n    if (!isNativeDurableSnapshotAvailable()) return undefined;\n\n    let cancelled = false;\n\n    void readNativeDurableSnapshot().then((nativeSnapshot) => {''',
)

# The App integration suite explicitly opts into native durability while all unrelated web suites remain synchronous.
replace_once(
    "src/__tests__/App.native-durable-snapshot.test.tsx",
    '''const durable = vi.hoisted(() => ({\n  read: vi.fn(),\n  persist: vi.fn(),\n}));''',
    '''const durable = vi.hoisted(() => ({\n  available: vi.fn(),\n  read: vi.fn(),\n  persist: vi.fn(),\n}));''',
)
replace_once(
    "src/__tests__/App.native-durable-snapshot.test.tsx",
    '''vi.mock("../lib/nativeDurableSnapshot", () => ({\n  readNativeDurableSnapshot: durable.read,\n  persistNativeDurableSnapshot: durable.persist,\n}));''',
    '''vi.mock("../lib/nativeDurableSnapshot", () => ({\n  isNativeDurableSnapshotAvailable: durable.available,\n  readNativeDurableSnapshot: durable.read,\n  persistNativeDurableSnapshot: durable.persist,\n}));''',
)
replace_once(
    "src/__tests__/App.native-durable-snapshot.test.tsx",
    '''    durable.read.mockReset();\n    durable.persist.mockReset();\n    durable.read.mockResolvedValue(null);''',
    '''    durable.available.mockReset();\n    durable.read.mockReset();\n    durable.persist.mockReset();\n    durable.available.mockReturnValue(true);\n    durable.read.mockResolvedValue(null);''',
)

# Synchronize the serialization regression on the actual first primary-write arrival rather than arbitrary microtask count.
replace_once(
    "src/lib/__tests__/nativeDurableSnapshot.test.ts",
    '''    let releaseFirst!: () => void;\n    const gate = new Promise<void>((resolve) => {\n      releaseFirst = resolve;\n    });\n    let primaryWrites = 0;\n    mocks.writeFile.mockImplementation(async ({ path, data }: { path: string; data: string }) => {\n      if (path === NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary) {\n        primaryWrites += 1;\n        if (primaryWrites === 1) await gate;\n      }\n      files.set(path, data);\n      return { uri: path };\n    });\n\n    const firstSave = persistNativeDurableSnapshot(first);\n    const secondSave = persistNativeDurableSnapshot(second);\n    await Promise.resolve();\n    expect(primaryWrites).toBe(1);\n\n    releaseFirst();''',
    '''    let releaseFirst!: () => void;\n    const gate = new Promise<void>((resolve) => {\n      releaseFirst = resolve;\n    });\n    let markFirstPrimaryStarted!: () => void;\n    const firstPrimaryStarted = new Promise<void>((resolve) => {\n      markFirstPrimaryStarted = resolve;\n    });\n    let primaryWrites = 0;\n    mocks.writeFile.mockImplementation(async ({ path, data }: { path: string; data: string }) => {\n      if (path === NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary) {\n        primaryWrites += 1;\n        if (primaryWrites === 1) {\n          markFirstPrimaryStarted();\n          await gate;\n        }\n      }\n      files.set(path, data);\n      return { uri: path };\n    });\n\n    const firstSave = persistNativeDurableSnapshot(first);\n    const secondSave = persistNativeDurableSnapshot(second);\n    await firstPrimaryStarted;\n    expect(primaryWrites).toBe(1);\n\n    releaseFirst();''',
)

# Cover the availability gate directly.
replace_once(
    "src/lib/__tests__/nativeDurableSnapshot.test.ts",
    '''import {\n  NATIVE_SNAPSHOT_PATHS_FOR_TESTING,\n  persistNativeDurableSnapshot,''',
    '''import {\n  isNativeDurableSnapshotAvailable,\n  NATIVE_SNAPSHOT_PATHS_FOR_TESTING,\n  persistNativeDurableSnapshot,''',
)
replace_once(
    "src/lib/__tests__/nativeDurableSnapshot.test.ts",
    '''  it("webではnative filesystemへ触れず成功扱い", async () => {\n    mocks.isNativePlatform.mockReturnValue(false);\n    expect(await persistNativeDurableSnapshot([makeNote("web")])).toBe(true);''',
    '''  it("webではnative filesystemへ触れず成功扱い", async () => {\n    mocks.isNativePlatform.mockReturnValue(false);\n    expect(isNativeDurableSnapshotAvailable()).toBe(false);\n    expect(await persistNativeDurableSnapshot([makeNote("web")])).toBe(true);''',
)
replace_once(
    "src/lib/__tests__/nativeDurableSnapshot.test.ts",
    '''  it("初回はprimary snapshotを書き込む", async () => {\n    const notes = [makeNote("初回")];''',
    '''  it("初回はprimary snapshotを書き込む", async () => {\n    expect(isNativeDurableSnapshotAvailable()).toBe(true);\n    const notes = [makeNote("初回")];''',
)
