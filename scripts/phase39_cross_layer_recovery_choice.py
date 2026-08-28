from pathlib import Path

app = Path("src/App.tsx")
text = app.read_text()

old = '''  const [nativeRecoveryInitiallyRequired] = useState(\n    () =>\n      isNativeDurableSnapshotAvailable() &&\n      !initialLoad.recoveryPending &&\n      (initialLoad.loadFailed ||\n        initialLoad.primaryHealth === "missing" ||\n        initialLoad.primaryHealth === "invalid" ||\n        initialLoad.primaryHealth === "unavailable"),\n  );'''
new = '''  const [nativeRecoveryInitiallyRequired] = useState(\n    () =>\n      isNativeDurableSnapshotAvailable() &&\n      (initialLoad.loadFailed ||\n        initialLoad.primaryHealth === "missing" ||\n        initialLoad.primaryHealth === "invalid" ||\n        initialLoad.primaryHealth === "unavailable"),\n  );'''
if text.count(old) != 1:
    raise SystemExit(f"initial native gate marker: {text.count(old)}")
text = text.replace(old, new, 1)

old = '''  const [nativeRecoveryStatus, setNativeRecoveryStatus] = useState<\n    "idle" | "checking" | "error"\n  >(nativeRecoveryInitiallyRequired ? "checking" : "idle");\n\n  const undoTimerRef = useRef<number | null>(null);'''
new = '''  const [nativeRecoveryStatus, setNativeRecoveryStatus] = useState<\n    "idle" | "checking" | "error"\n  >(nativeRecoveryInitiallyRequired ? "checking" : "idle");\n  const [nativeRecoveryAlternativeCount, setNativeRecoveryAlternativeCount] = useState<\n    number | null\n  >(null);\n  const [recoveryCandidateSource, setRecoveryCandidateSource] = useState<"local" | "native">(\n    "local",\n  );\n  const [runtimeRecoveryProbeVersion, setRuntimeRecoveryProbeVersion] = useState(0);\n\n  const undoTimerRef = useRef<number | null>(null);'''
if text.count(old) != 1:
    raise SystemExit(f"native recovery state marker: {text.count(old)}")
text = text.replace(old, new, 1)

old = '''  const externalConflictRef = useRef(initialLoad.recoveryPending);\n  const nativeRecoveryGateRef = useRef(nativeRecoveryInitiallyRequired);\n  const nativeRecoveryProbeIdRef = useRef(0);\n  const mountedRef = useRef(true);'''
new = '''  const externalConflictRef = useRef(initialLoad.recoveryPending);\n  const nativeRecoveryGateRef = useRef(nativeRecoveryInitiallyRequired);\n  const nativeRecoveryProbeIdRef = useRef(0);\n  const localRecoveryCandidateRef = useRef<Note[] | null>(\n    initialLoad.recoveryPending ? initialLoad.notes : null,\n  );\n  const nativeRecoveryAlternativeRef = useRef<Note[] | null>(null);\n  const recoveryCandidateSourceRef = useRef<"local" | "native">("local");\n  const mountedRef = useRef(true);'''
if text.count(old) != 1:
    raise SystemExit(f"recovery refs marker: {text.count(old)}")
text = text.replace(old, new, 1)

old = '''  useLayoutEffect(() => {\n    latestNotesRef.current = notes;\n  }, [notes]);'''
new = '''  useLayoutEffect(() => {\n    latestNotesRef.current = notes;\n    if (!externalConflictRef.current) return;\n\n    if (\n      recoveryCandidateSourceRef.current === "local" &&\n      localRecoveryCandidateRef.current !== null\n    ) {\n      localRecoveryCandidateRef.current = notes;\n    } else if (\n      recoveryCandidateSourceRef.current === "native" &&\n      nativeRecoveryAlternativeRef.current !== null\n    ) {\n      nativeRecoveryAlternativeRef.current = notes;\n    }\n  }, [notes]);'''
if text.count(old) != 1:
    raise SystemExit(f"layout effect marker: {text.count(old)}")
text = text.replace(old, new, 1)

marker = '''  const refreshCleanNotesFromStorage = useCallback(() => {'''
helper = '''  const clearRecoveryCandidateSources = useCallback(() => {\n    localRecoveryCandidateRef.current = null;\n    nativeRecoveryAlternativeRef.current = null;\n    recoveryCandidateSourceRef.current = "local";\n    setRecoveryCandidateSource("local");\n    setNativeRecoveryAlternativeCount(null);\n  }, []);\n\n  const registerLocalRecoveryCandidate = useCallback((snapshot: Note[]) => {\n    localRecoveryCandidateRef.current = snapshot;\n    nativeRecoveryAlternativeRef.current = null;\n    recoveryCandidateSourceRef.current = "local";\n    setRecoveryCandidateSource("local");\n    setNativeRecoveryAlternativeCount(null);\n\n    if (!isNativeDurableSnapshotAvailable()) return;\n    nativeRecoveryGateRef.current = true;\n    saveGuardRef.current = true;\n    clearPersistTimer();\n    setNativeRecoveryStatus("checking");\n    setRuntimeRecoveryProbeVersion((version) => version + 1);\n  }, [clearPersistTimer]);\n\n'''
if text.count(marker) != 1:
    raise SystemExit(f"refresh marker: {text.count(marker)}")
text = text.replace(marker, helper + marker, 1)

old = '''      if (hasRecoveryCandidate(remote)) {\n        // 空配列を含む中断保存も候補になり得るため、件数ではなく明示フラグで判定する。\n        applyCleanRemoteNotes(remote.notes);\n        flagExternalConflict('''
new = '''      if (hasRecoveryCandidate(remote)) {\n        // 空配列を含む中断保存も候補になり得るため、件数ではなく明示フラグで判定する。\n        registerLocalRecoveryCandidate(remote.notes);\n        applyCleanRemoteNotes(remote.notes);\n        flagExternalConflict('''
if text.count(old) != 1:
    raise SystemExit(f"refresh recovery registration marker: {text.count(old)}")
text = text.replace(old, new, 1)

old = '''  }, [applyCleanRemoteNotes, flagExternalConflict, persistDurableSnapshot]);'''
new = '''  }, [\n    applyCleanRemoteNotes,\n    flagExternalConflict,\n    persistDurableSnapshot,\n    registerLocalRecoveryCandidate,\n  ]);'''
# first occurrence belongs refreshCleanNotesFromStorage
if text.count(old) < 2:
    raise SystemExit(f"expected shared dependency marker >=2, found {text.count(old)}")
text = text.replace(old, new, 1)

old = '''        setRecoveryCandidateCount(0);\n        setLoadError(false);\n        persistDurableSnapshot(snapshot);\n        return;'''
new = '''        setRecoveryCandidateCount(0);\n        setLoadError(false);\n        clearRecoveryCandidateSources();\n        persistDurableSnapshot(snapshot);\n        return;'''
if text.count(old) != 1:
    raise SystemExit(f"save success clear marker: {text.count(old)}")
text = text.replace(old, new, 1)

old = '''    [flagExternalConflict, persistDurableSnapshot],\n  );'''
new = '''    [clearRecoveryCandidateSources, flagExternalConflict, persistDurableSnapshot],\n  );'''
if text.count(old) != 1:
    raise SystemExit(f"applySaveResult deps marker: {text.count(old)}")
text = text.replace(old, new, 1)

old = '''    const primaryHealth = getNotesPrimaryHealth();\n\n    // probe中に別タブ等から正常primaryが到着した場合は、その現在値を正本として採用する。'''
new = '''    const primaryHealth = getNotesPrimaryHealth();\n    const localRecoveryCandidate = localRecoveryCandidateRef.current;\n\n    // localStorage 側にも復元候補がある時は native を自動採用・自動mergeしない。\n    // 現在の local 候補を再確認し、異なる native 世代があれば別候補として保持する。\n    if (localRecoveryCandidate !== null) {\n      const current = loadNotes();\n      if (current.ok) {\n        nativeRecoveryGateRef.current = false;\n        setNativeRecoveryStatus("idle");\n        saveGuardRef.current = false;\n        clearRecoveryCandidateSources();\n        applyCleanRemoteNotes(current.notes);\n        setLoadError(false);\n        persistDurableSnapshot(current.notes);\n        return;\n      }\n\n      if (hasRecoveryCandidate(current)) {\n        const currentCandidate = current.notes;\n        localRecoveryCandidateRef.current = currentCandidate;\n        if (recoveryCandidateSourceRef.current === "local") {\n          baselineNotesRef.current = currentCandidate;\n          latestNotesRef.current = currentCandidate;\n          setNotes(currentCandidate);\n          setRecoveryCandidateCount(currentCandidate.length);\n        }\n        setCanLoadStoredNotes(canChooseStoredPrimary(current));\n\n        if (primaryHealth === "unavailable" || nativeResult.status === "error") {\n          nativeRecoveryGateRef.current = true;\n          saveGuardRef.current = true;\n          setNativeRecoveryStatus("error");\n          setNativeBackupRetryAllowed(false);\n          setLoadError(false);\n          return;\n        }\n\n        if (\n          nativeResult.status === "available" &&\n          !notesSnapshotMatches(nativeResult.notes, currentCandidate)\n        ) {\n          nativeRecoveryAlternativeRef.current = nativeResult.notes;\n          setNativeRecoveryAlternativeCount(nativeResult.notes.length);\n        } else {\n          nativeRecoveryAlternativeRef.current = null;\n          setNativeRecoveryAlternativeCount(null);\n          if (recoveryCandidateSourceRef.current === "native") {\n            recoveryCandidateSourceRef.current = "local";\n            setRecoveryCandidateSource("local");\n          }\n        }\n\n        nativeRecoveryGateRef.current = false;\n        setNativeRecoveryStatus("idle");\n        saveGuardRef.current = true;\n        externalConflictRef.current = true;\n        setExternalConflict(true);\n        setLoadError(false);\n        return;\n      }\n\n      // local candidate が外部要因で消えた場合は通常の primary/native 判定へ戻す。\n      localRecoveryCandidateRef.current = null;\n    }\n\n    // probe中に別タブ等から正常primaryが到着した場合は、その現在値を正本として採用する。'''
if text.count(old) != 1:
    raise SystemExit(f"probe insertion marker: {text.count(old)}")
text = text.replace(old, new, 1)

old = '''    applyCleanRemoteNotes,\n    clearPersistTimer,\n    flagExternalConflict,\n    persistDurableSnapshot,\n  ]);'''
new = '''    applyCleanRemoteNotes,\n    clearPersistTimer,\n    clearRecoveryCandidateSources,\n    flagExternalConflict,\n    persistDurableSnapshot,\n  ]);'''
if text.count(old) != 1:
    raise SystemExit(f"probe deps marker: {text.count(old)}")
text = text.replace(old, new, 1)

marker = '''  const retryNativeRecovery = useCallback(() => {\n    void probeNativeRecovery();\n  }, [probeNativeRecovery]);'''
extra = '''  useEffect(() => {\n    if (runtimeRecoveryProbeVersion === 0) return undefined;\n    if (!isNativeDurableSnapshotAvailable()) return undefined;\n    if (localRecoveryCandidateRef.current === null) return undefined;\n\n    queueMicrotask(() => {\n      void probeNativeRecovery();\n    });\n    return () => {\n      nativeRecoveryProbeIdRef.current += 1;\n    };\n  }, [probeNativeRecovery, runtimeRecoveryProbeVersion]);\n\n'''
if text.count(marker) != 1:
    raise SystemExit(f"retry marker: {text.count(marker)}")
text = text.replace(marker, extra + marker, 1)

marker = '''  const retryNativeBackup = useCallback(() => {'''
chooser = '''  const showRecoveryCandidateSource = useCallback((source: "local" | "native") => {\n    const snapshot =\n      source === "local"\n        ? localRecoveryCandidateRef.current\n        : nativeRecoveryAlternativeRef.current;\n    if (snapshot === null) return;\n\n    recoveryCandidateSourceRef.current = source;\n    baselineNotesRef.current = snapshot;\n    latestNotesRef.current = snapshot;\n    setRecoveryCandidateSource(source);\n    setNotes(snapshot);\n    setRecoveryCandidateCount(snapshot.length);\n    setLastSaveResult({ ok: false, reason: "conflict" });\n  }, []);\n\n'''
if text.count(marker) != 1:
    raise SystemExit(f"native backup marker: {text.count(marker)}")
text = text.replace(marker, chooser + marker, 1)

old = '''    setRecoveryCandidateCount(0);\n    setLoadError(false);\n    // ユーザーが保存済み版を正本として明示採用したので、古いnative候補を残さない。\n    persistDurableSnapshot(result.notes);\n  }, [clearPersistTimer, persistDurableSnapshot]);'''
new = '''    setRecoveryCandidateCount(0);\n    setLoadError(false);\n    clearRecoveryCandidateSources();\n    // ユーザーが保存済み版を正本として明示採用したので、古いnative候補を残さない。\n    persistDurableSnapshot(result.notes);\n  }, [clearPersistTimer, clearRecoveryCandidateSources, persistDurableSnapshot]);'''
if text.count(old) != 1:
    raise SystemExit(f"load stored clear marker: {text.count(old)}")
text = text.replace(old, new, 1)

old = '''          if (locallyClean && remoteHasRecoveryCandidate) {\n            applyCleanRemoteNotes(remote.notes);\n            flagExternalConflict('''
new = '''          if (locallyClean && remoteHasRecoveryCandidate) {\n            registerLocalRecoveryCandidate(remote.notes);\n            applyCleanRemoteNotes(remote.notes);\n            flagExternalConflict('''
if text.count(old) != 1:
    raise SystemExit(f"storage event recovery registration marker: {text.count(old)}")
text = text.replace(old, new, 1)

# second shared dependency marker belongs storage listener
old = '''  }, [applyCleanRemoteNotes, flagExternalConflict, persistDurableSnapshot]);'''
new = '''  }, [\n    applyCleanRemoteNotes,\n    flagExternalConflict,\n    persistDurableSnapshot,\n    registerLocalRecoveryCandidate,\n  ]);'''
if text.count(old) != 1:
    raise SystemExit(f"storage listener deps remaining marker: {text.count(old)}")
text = text.replace(old, new, 1)

old = '''          {externalConflict && (\n            <div'''
new = '''          {externalConflict && nativeRecoveryStatus === "idle" && (\n            <div'''
if text.count(old) != 1:
    raise SystemExit(f"conflict render gate marker: {text.count(old)}")
text = text.replace(old, new, 1)

old = '''                {canLoadStoredNotes\n                  ? copy.storageConflictBody\n                  : copy.storageConflictRecoveryBody}\n              </p>\n              <div className="mt-gr-3 flex flex-wrap justify-end gap-gr-2">'''
new = '''                {canLoadStoredNotes\n                  ? copy.storageConflictBody\n                  : copy.storageConflictRecoveryBody}\n                {nativeRecoveryAlternativeCount !== null && (\n                  <span\n                    data-testid="native-recovery-alternative"\n                    className="mt-gr-2 block text-sumi/80"\n                  >\n                    {copy.nativeRecoveryAlternativeNotice(nativeRecoveryAlternativeCount)}\n                    {recoveryCandidateSource === "native" && (\n                      <span className="mt-gr-1 block">\n                        {copy.nativeRecoveryAlternativeActive}\n                      </span>\n                    )}\n                  </span>\n                )}\n              </p>\n              <div className="mt-gr-3 flex flex-wrap justify-end gap-gr-2">\n                {nativeRecoveryAlternativeCount !== null && (\n                  <button\n                    type="button"\n                    onClick={() =>\n                      showRecoveryCandidateSource(\n                        recoveryCandidateSource === "native" ? "local" : "native",\n                      )\n                    }\n                    className="min-h-[44px] border border-gold/35 px-gr-3 py-gr-2 font-mincho text-[12px] text-sumi transition-soft hover:bg-washi active:scale-[0.98]"\n                    style={{ borderRadius: "6px 10px 7px 9px" }}\n                  >\n                    {recoveryCandidateSource === "native"\n                      ? copy.nativeRecoveryShowLocal\n                      : copy.nativeRecoveryShowAlternative}\n                  </button>\n                )}'''
if text.count(old) != 1:
    raise SystemExit(f"recovery UI marker: {text.count(old)}")
text = text.replace(old, new, 1)

app.write_text(text)

i18n = Path("src/lib/i18n.ts")
i = i18n.read_text()
old = '''  nativeRecoveryRetry: "もう一度確認する",\n  saveConflict: "別の変更と重なったため、保存を止めています",'''
new = '''  nativeRecoveryRetry: "もう一度確認する",\n  nativeRecoveryAlternativeNotice: (count: number) =>\n    count === 0\n      ? "端末内にも、すべて削除済みの別の復元候補があります。自動では混ぜません。"\n      : `端末内にも別の復元候補が${count}件あります。自動では混ぜません。`,\n  nativeRecoveryAlternativeActive: "端末内の別候補を表示しています。",\n  nativeRecoveryShowAlternative: "端末内の別候補を見る",\n  nativeRecoveryShowLocal: "元の復元候補に戻す",\n  saveConflict: "別の変更と重なったため、保存を止めています",'''
if i.count(old) != 1:
    raise SystemExit(f"i18n marker: {i.count(old)}")
i18n.write_text(i.replace(old, new, 1))

test = Path("src/__tests__/App.native-durable-snapshot.test.tsx")
t = test.read_text()
old = '''import { STORAGE_KEY_FOR_TESTING } from "../lib/storage";'''
new = '''import { BACKUP_KEY_FOR_TESTING, STORAGE_KEY_FOR_TESTING } from "../lib/storage";'''
if t.count(old) != 1:
    raise SystemExit(f"test storage import marker: {t.count(old)}")
t = t.replace(old, new, 1)

marker = '''  it("初回loadNotesだけ一時失敗して直後にprimaryが読めてもnative safety probeで現在正本へ収束する", async () => {'''
extra = '''  it("local復元候補があってもnativeを確認し、異なる別世代を隠さず明示的に切り替えられる", async () => {\n    const localCandidate = [makeNote({ id: "local-recovery", title: "local復元候補" })];\n    const nativeCandidate = [makeNote({ id: "native-recovery", title: "native別候補" })];\n    storage._store[BACKUP_KEY_FOR_TESTING] = JSON.stringify(localCandidate);\n    durable.read.mockResolvedValue({ status: "available", notes: nativeCandidate });\n\n    renderApp();\n    expect(container.querySelector('[data-testid="native-recovery-checking"]')).not.toBeNull();\n    expect(hasButton(container, copy.storageRecoverySave)).toBe(false);\n    await flushPromises();\n\n    expect(container.textContent).toContain("local復元候補");\n    expect(container.querySelector('[data-testid="native-recovery-alternative"]')).not.toBeNull();\n    expect(hasButton(container, copy.nativeRecoveryShowAlternative)).toBe(true);\n    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBeUndefined();\n    expect(durable.persist).not.toHaveBeenCalled();\n\n    act(() => click(findButton(container, copy.nativeRecoveryShowAlternative)));\n    expect(container.textContent).toContain("native別候補");\n    expect(hasButton(container, copy.nativeRecoveryShowLocal)).toBe(true);\n\n    act(() => click(findButton(container, copy.nativeRecoveryShowLocal)));\n    expect(container.textContent).toContain("local復元候補");\n\n    act(() => click(findButton(container, copy.nativeRecoveryShowAlternative)));\n    act(() => click(findButton(container, copy.storageRecoverySave)));\n    await flushPromises();\n\n    expect(JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[]).toEqual(nativeCandidate);\n    expect(durable.persist).toHaveBeenCalledWith(nativeCandidate);\n  });\n\n  it("local復元候補がある状態でnative読込に失敗したらforce確定を出さず、retry完了後だけ解放する", async () => {\n    const localCandidate = [makeNote({ id: "local-recovery", title: "守るlocal候補" })];\n    storage._store[BACKUP_KEY_FOR_TESTING] = JSON.stringify(localCandidate);\n    durable.read\n      .mockResolvedValueOnce({ status: "error" })\n      .mockResolvedValue({ status: "missing" });\n\n    renderApp();\n    await flushPromises();\n\n    expect(container.textContent).toContain(copy.nativeRecoveryReadError);\n    expect(hasButton(container, copy.storageRecoverySave)).toBe(false);\n    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBeUndefined();\n\n    act(() => click(findButton(container, copy.nativeRecoveryRetry)));\n    await flushPromises();\n\n    expect(container.textContent).not.toContain(copy.nativeRecoveryReadError);\n    expect(container.textContent).toContain("守るlocal候補");\n    expect(hasButton(container, copy.storageRecoverySave)).toBe(true);\n  });\n\n  it("runtimeでlocal復元候補へ遷移した場合もnative別世代を再確認して隠さない", async () => {\n    const existing = [makeNote({ id: "existing", title: "起動時正本" })];\n    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(existing);\n    renderApp();\n    await flushPromises();\n    durable.persist.mockClear();\n\n    const localCandidate = [makeNote({ id: "runtime-local", title: "runtime local候補" })];\n    const nativeCandidate = [makeNote({ id: "runtime-native", title: "runtime native候補" })];\n    delete storage._store[STORAGE_KEY_FOR_TESTING];\n    storage._store[BACKUP_KEY_FOR_TESTING] = JSON.stringify(localCandidate);\n    durable.read.mockResolvedValue({ status: "available", notes: nativeCandidate });\n\n    act(() => {\n      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY_FOR_TESTING, newValue: null }));\n    });\n    expect(container.querySelector('[data-testid="native-recovery-checking"]')).not.toBeNull();\n    await flushPromises();\n\n    expect(container.textContent).toContain("runtime local候補");\n    expect(container.querySelector('[data-testid="native-recovery-alternative"]')).not.toBeNull();\n    expect(hasButton(container, copy.nativeRecoveryShowAlternative)).toBe(true);\n    expect(durable.persist).not.toHaveBeenCalled();\n  });\n\n'''
if t.count(marker) != 1:
    raise SystemExit(f"test insertion marker: {t.count(marker)}")
test.write_text(t.replace(marker, extra + marker, 1))
