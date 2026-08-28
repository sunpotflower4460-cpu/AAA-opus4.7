from pathlib import Path

app = Path("src/App.tsx")
text = app.read_text()

old = '''type DeletedNote = Note & { deletedAt: string };\n\nconst AUTOSAVE_DEBOUNCE_MS = 500;'''
new = '''type DeletedNote = Note & { deletedAt: string };\ntype RecoveryCandidateSource = "screen" | "local" | "native";\n\nconst AUTOSAVE_DEBOUNCE_MS = 500;'''
if text.count(old) != 1:
    raise SystemExit(f"source type marker: {text.count(old)}")
text = text.replace(old, new, 1)

old = '''  const [recoveryCandidateSource, setRecoveryCandidateSource] = useState<"local" | "native">(\n    "local",\n  );\n  const [runtimeRecoveryProbeVersion, setRuntimeRecoveryProbeVersion] = useState(0);'''
new = '''  const [recoveryCandidateSource, setRecoveryCandidateSource] =\n    useState<RecoveryCandidateSource>("local");\n  // null は dirty screen 候補なし。0 は「全削除済みの dirty screen」という正当な候補。\n  const [screenRecoveryCandidateCount, setScreenRecoveryCandidateCount] = useState<\n    number | null\n  >(null);\n  const [runtimeRecoveryProbeVersion, setRuntimeRecoveryProbeVersion] = useState(0);'''
if text.count(old) != 1:
    raise SystemExit(f"source state marker: {text.count(old)}")
text = text.replace(old, new, 1)

old = '''  const localRecoveryCandidateRef = useRef<Note[] | null>(\n    initialLoad.recoveryPending ? initialLoad.notes : null,\n  );\n  const nativeRecoveryAlternativeRef = useRef<Note[] | null>(null);\n  const recoveryCandidateSourceRef = useRef<"local" | "native">("local");'''
new = '''  const screenRecoveryCandidateRef = useRef<Note[] | null>(null);\n  const localRecoveryCandidateRef = useRef<Note[] | null>(\n    initialLoad.recoveryPending ? initialLoad.notes : null,\n  );\n  const nativeRecoveryAlternativeRef = useRef<Note[] | null>(null);\n  const recoveryCandidateSourceRef = useRef<RecoveryCandidateSource>("local");'''
if text.count(old) != 1:
    raise SystemExit(f"candidate refs marker: {text.count(old)}")
text = text.replace(old, new, 1)

old = '''    if (\n      recoveryCandidateSourceRef.current === "local" &&\n      localRecoveryCandidateRef.current !== null\n    ) {\n      localRecoveryCandidateRef.current = notes;\n    } else if (\n      recoveryCandidateSourceRef.current === "native" &&\n      nativeRecoveryAlternativeRef.current !== null\n    ) {\n      nativeRecoveryAlternativeRef.current = notes;\n    }'''
new = '''    if (\n      recoveryCandidateSourceRef.current === "screen" &&\n      screenRecoveryCandidateRef.current !== null\n    ) {\n      screenRecoveryCandidateRef.current = notes;\n      setScreenRecoveryCandidateCount(notes.length);\n    } else if (\n      recoveryCandidateSourceRef.current === "local" &&\n      localRecoveryCandidateRef.current !== null\n    ) {\n      localRecoveryCandidateRef.current = notes;\n    } else if (\n      recoveryCandidateSourceRef.current === "native" &&\n      nativeRecoveryAlternativeRef.current !== null\n    ) {\n      nativeRecoveryAlternativeRef.current = notes;\n    }'''
if text.count(old) != 1:
    raise SystemExit(f"layout source marker: {text.count(old)}")
text = text.replace(old, new, 1)

old = '''  const clearRecoveryCandidateSources = useCallback(() => {\n    localRecoveryCandidateRef.current = null;\n    nativeRecoveryAlternativeRef.current = null;\n    recoveryCandidateSourceRef.current = "local";\n    setRecoveryCandidateSource("local");\n    setNativeRecoveryAlternativeCount(null);\n  }, []);'''
new = '''  const clearRecoveryCandidateSources = useCallback(() => {\n    screenRecoveryCandidateRef.current = null;\n    localRecoveryCandidateRef.current = null;\n    nativeRecoveryAlternativeRef.current = null;\n    recoveryCandidateSourceRef.current = "local";\n    setRecoveryCandidateSource("local");\n    setScreenRecoveryCandidateCount(null);\n    setNativeRecoveryAlternativeCount(null);\n  }, []);'''
if text.count(old) != 1:
    raise SystemExit(f"clear sources marker: {text.count(old)}")
text = text.replace(old, new, 1)

marker = '''  const refreshCleanNotesFromStorage = useCallback(() => {'''
helper = '''  const registerDirtyRecoveryCandidate = useCallback(\n    (remoteSnapshot: Note[]) => {\n      // dirty screen は remote candidate と絶対に同じ ref へ入れない。\n      // 既に三者競合中なら最初に捕捉した screen を維持し、表示中の local/native で上書きしない。\n      if (screenRecoveryCandidateRef.current === null) {\n        const screenSnapshot = latestNotesRef.current;\n        screenRecoveryCandidateRef.current = screenSnapshot;\n        recoveryCandidateSourceRef.current = "screen";\n        setRecoveryCandidateSource("screen");\n        setScreenRecoveryCandidateCount(screenSnapshot.length);\n      }\n\n      localRecoveryCandidateRef.current = remoteSnapshot;\n      if (recoveryCandidateSourceRef.current === "local") {\n        latestNotesRef.current = remoteSnapshot;\n        setNotes(remoteSnapshot);\n        setRecoveryCandidateCount(remoteSnapshot.length);\n      }\n\n      if (!isNativeDurableSnapshotAvailable()) return;\n      nativeRecoveryGateRef.current = true;\n      saveGuardRef.current = true;\n      clearPersistTimer();\n      setNativeRecoveryStatus("checking");\n      setRuntimeRecoveryProbeVersion((version) => version + 1);\n    },\n    [clearPersistTimer],\n  );\n\n'''
if text.count(marker) != 1:
    raise SystemExit(f"dirty helper insertion marker: {text.count(marker)}")
text = text.replace(marker, helper + marker, 1)

old = '''    const primaryHealth = getNotesPrimaryHealth();\n    const localRecoveryCandidate = localRecoveryCandidateRef.current;\n\n    // localStorage 側にも復元候補がある時は native を自動採用・自動mergeしない。'''
new = '''    const primaryHealth = getNotesPrimaryHealth();\n    const screenRecoveryCandidate = screenRecoveryCandidateRef.current;\n    const localRecoveryCandidate = localRecoveryCandidateRef.current;\n\n    // dirty screen と remote local recovery を両方捕捉済みなら、clean recovery 用分岐へ入れない。\n    // probe中に正常primaryが戻っても screen を自動破棄せず、保存先版は既存のload actionで選択可能にする。\n    if (screenRecoveryCandidate !== null && localRecoveryCandidate !== null) {\n      const current = loadNotes();\n      let latestLocalCandidate = localRecoveryCandidate;\n\n      if (!current.ok && hasRecoveryCandidate(current)) {\n        latestLocalCandidate = current.notes;\n        localRecoveryCandidateRef.current = current.notes;\n        if (recoveryCandidateSourceRef.current === "local") {\n          latestNotesRef.current = current.notes;\n          setNotes(current.notes);\n          setRecoveryCandidateCount(current.notes.length);\n        }\n      }\n\n      setCanLoadStoredNotes(canChooseStoredPrimary(current));\n\n      if (primaryHealth === "unavailable" || nativeResult.status === "error") {\n        nativeRecoveryGateRef.current = true;\n        saveGuardRef.current = true;\n        setNativeRecoveryStatus("error");\n        setNativeBackupRetryAllowed(false);\n        setLoadError(false);\n        return;\n      }\n\n      if (nativeResult.status === "available") {\n        const duplicatesKnownCandidate =\n          notesSnapshotMatches(nativeResult.notes, screenRecoveryCandidate) ||\n          notesSnapshotMatches(nativeResult.notes, latestLocalCandidate) ||\n          (current.ok && notesSnapshotMatches(nativeResult.notes, current.notes));\n\n        if (!duplicatesKnownCandidate) {\n          nativeRecoveryAlternativeRef.current = nativeResult.notes;\n          setNativeRecoveryAlternativeCount(nativeResult.notes.length);\n        }\n      }\n\n      nativeRecoveryGateRef.current = false;\n      setNativeRecoveryStatus("idle");\n      saveGuardRef.current = true;\n      externalConflictRef.current = true;\n      setExternalConflict(true);\n      setNativeBackupRetryAllowed(false);\n      setLoadError(false);\n      return;\n    }\n\n    // localStorage 側にも復元候補がある時は native を自動採用・自動mergeしない。'''
if text.count(old) != 1:
    raise SystemExit(f"dirty probe marker: {text.count(old)}")
text = text.replace(old, new, 1)

old = '''          if (locallyClean && remoteHasRecoveryCandidate) {\n            registerLocalRecoveryCandidate(remote.notes);\n            applyCleanRemoteNotes(remote.notes);\n            flagExternalConflict(\n              canChooseStoredPrimary(remote),\n              false,\n              remote.notes.length,\n            );\n          } else {\n            // dirty 中はローカル内容を守り、remote の復元候補を勝手に適用しない。\n            flagExternalConflict(\n              canChooseStoredPrimary(remote),\n              !remoteHasRecoveryCandidate,\n            );\n          }'''
new = '''          if (locallyClean && remoteHasRecoveryCandidate) {\n            registerLocalRecoveryCandidate(remote.notes);\n            applyCleanRemoteNotes(remote.notes);\n            flagExternalConflict(\n              canChooseStoredPrimary(remote),\n              false,\n              remote.notes.length,\n            );\n          } else if (notesDirtyRef.current && remoteHasRecoveryCandidate) {\n            // dirty screen / remote recovery / native を別候補として捕捉する。\n            // screen を remote で置換せず、native safety probe が完了するまで解決操作も止める。\n            const screenCount =\n              screenRecoveryCandidateRef.current?.length ?? latestNotesRef.current.length;\n            registerDirtyRecoveryCandidate(remote.notes);\n            flagExternalConflict(\n              canChooseStoredPrimary(remote),\n              false,\n              screenCount,\n            );\n          } else {\n            // recovery candidate が無い通常競合でも dirty screen は守る。\n            flagExternalConflict(\n              canChooseStoredPrimary(remote),\n              !remoteHasRecoveryCandidate,\n            );\n          }'''
if text.count(old) != 1:
    raise SystemExit(f"storage dirty branch marker: {text.count(old)}")
text = text.replace(old, new, 1)

old = '''    persistDurableSnapshot,\n    registerLocalRecoveryCandidate,\n  ]);'''
new = '''    persistDurableSnapshot,\n    registerDirtyRecoveryCandidate,\n    registerLocalRecoveryCandidate,\n  ]);'''
# only storage listener dependency block should remain with exact shape after prior refresh block also similar; use last occurrence
idx = text.rfind(old)
if idx == -1:
    raise SystemExit("storage deps marker not found")
text = text[:idx] + text[idx:].replace(old, new, 1)

old = '''  const showRecoveryCandidateSource = useCallback((source: "local" | "native") => {\n    const snapshot =\n      source === "local"\n        ? localRecoveryCandidateRef.current\n        : nativeRecoveryAlternativeRef.current;\n    if (snapshot === null) return;'''
new = '''  const showRecoveryCandidateSource = useCallback((source: RecoveryCandidateSource) => {\n    const snapshot =\n      source === "screen"\n        ? screenRecoveryCandidateRef.current\n        : source === "local"\n          ? localRecoveryCandidateRef.current\n          : nativeRecoveryAlternativeRef.current;\n    if (snapshot === null) return;'''
if text.count(old) != 1:
    raise SystemExit(f"show source marker: {text.count(old)}")
text = text.replace(old, new, 1)

old = '''                {nativeRecoveryAlternativeCount !== null && (\n                  <span\n                    data-testid="native-recovery-alternative"\n                    className="mt-gr-2 block text-sumi/80"\n                  >\n                    {copy.nativeRecoveryAlternativeNotice(nativeRecoveryAlternativeCount)}\n                    {recoveryCandidateSource === "native" && (\n                      <span className="mt-gr-1 block">\n                        {copy.nativeRecoveryAlternativeActive}\n                      </span>\n                    )}\n                  </span>\n                )}'''
new = '''                {screenRecoveryCandidateCount !== null && (\n                  <span\n                    data-testid="dirty-recovery-candidates"\n                    className="mt-gr-2 block text-sumi/80"\n                  >\n                    {copy.dirtyRecoveryCandidateNotice}\n                    <span className="mt-gr-1 block">\n                      {recoveryCandidateSource === "screen"\n                        ? copy.dirtyRecoveryScreenActive\n                        : recoveryCandidateSource === "local"\n                          ? copy.dirtyRecoveryLocalActive\n                          : copy.nativeRecoveryAlternativeActive}\n                    </span>\n                  </span>\n                )}\n                {nativeRecoveryAlternativeCount !== null && (\n                  <span\n                    data-testid="native-recovery-alternative"\n                    className="mt-gr-2 block text-sumi/80"\n                  >\n                    {copy.nativeRecoveryAlternativeNotice(nativeRecoveryAlternativeCount)}\n                    {screenRecoveryCandidateCount === null &&\n                      recoveryCandidateSource === "native" && (\n                        <span className="mt-gr-1 block">\n                          {copy.nativeRecoveryAlternativeActive}\n                        </span>\n                      )}\n                  </span>\n                )}'''
if text.count(old) != 1:
    raise SystemExit(f"ui notice marker: {text.count(old)}")
text = text.replace(old, new, 1)

old = '''                {nativeRecoveryAlternativeCount !== null && (\n                  <button\n                    type="button"\n                    onClick={() =>\n                      showRecoveryCandidateSource(\n                        recoveryCandidateSource === "native" ? "local" : "native",\n                      )\n                    }\n                    className="min-h-[44px] border border-gold/35 px-gr-3 py-gr-2 font-mincho text-[12px] text-sumi transition-soft hover:bg-washi active:scale-[0.98]"\n                    style={{ borderRadius: "6px 10px 7px 9px" }}\n                  >\n                    {recoveryCandidateSource === "native"\n                      ? copy.nativeRecoveryShowLocal\n                      : copy.nativeRecoveryShowAlternative}\n                  </button>\n                )}'''
new = '''                {screenRecoveryCandidateCount !== null ? (\n                  <>\n                    {recoveryCandidateSource !== "screen" && (\n                      <button\n                        type="button"\n                        onClick={() => showRecoveryCandidateSource("screen")}\n                        className="min-h-[44px] border border-gold/35 px-gr-3 py-gr-2 font-mincho text-[12px] text-sumi transition-soft hover:bg-washi active:scale-[0.98]"\n                        style={{ borderRadius: "6px 10px 7px 9px" }}\n                      >\n                        {copy.dirtyRecoveryShowScreen}\n                      </button>\n                    )}\n                    {recoveryCandidateSource !== "local" && (\n                      <button\n                        type="button"\n                        onClick={() => showRecoveryCandidateSource("local")}\n                        className="min-h-[44px] border border-gold/35 px-gr-3 py-gr-2 font-mincho text-[12px] text-sumi transition-soft hover:bg-washi active:scale-[0.98]"\n                        style={{ borderRadius: "6px 10px 7px 9px" }}\n                      >\n                        {copy.dirtyRecoveryShowLocal}\n                      </button>\n                    )}\n                    {nativeRecoveryAlternativeCount !== null &&\n                      recoveryCandidateSource !== "native" && (\n                        <button\n                          type="button"\n                          onClick={() => showRecoveryCandidateSource("native")}\n                          className="min-h-[44px] border border-gold/35 px-gr-3 py-gr-2 font-mincho text-[12px] text-sumi transition-soft hover:bg-washi active:scale-[0.98]"\n                          style={{ borderRadius: "6px 10px 7px 9px" }}\n                        >\n                          {copy.nativeRecoveryShowAlternative}\n                        </button>\n                      )}\n                  </>\n                ) : (\n                  nativeRecoveryAlternativeCount !== null && (\n                    <button\n                      type="button"\n                      onClick={() =>\n                        showRecoveryCandidateSource(\n                          recoveryCandidateSource === "native" ? "local" : "native",\n                        )\n                      }\n                      className="min-h-[44px] border border-gold/35 px-gr-3 py-gr-2 font-mincho text-[12px] text-sumi transition-soft hover:bg-washi active:scale-[0.98]"\n                      style={{ borderRadius: "6px 10px 7px 9px" }}\n                    >\n                      {recoveryCandidateSource === "native"\n                        ? copy.nativeRecoveryShowLocal\n                        : copy.nativeRecoveryShowAlternative}\n                    </button>\n                  )\n                )}'''
if text.count(old) != 1:
    raise SystemExit(f"ui buttons marker: {text.count(old)}")
text = text.replace(old, new, 1)
app.write_text(text)

i18n = Path("src/lib/i18n.ts")
t = i18n.read_text()
old = '''  nativeRecoveryShowAlternative: "端末内の別候補を見る",\n  nativeRecoveryShowLocal: "元の復元候補に戻す",\n  saveConflict: "別の変更と重なったため、保存を止めています",'''
new = '''  nativeRecoveryShowAlternative: "端末内の別候補を見る",\n  nativeRecoveryShowLocal: "元の復元候補に戻す",\n  dirtyRecoveryCandidateNotice:\n    "この画面の未保存編集・保存先の復元候補・端末内候補を別々に保持しています。自動では混ぜません。",\n  dirtyRecoveryScreenActive: "この画面の未保存編集を表示しています。",\n  dirtyRecoveryLocalActive: "保存先で見つかった復元候補を表示しています。",\n  dirtyRecoveryShowScreen: "未保存編集に戻る",\n  dirtyRecoveryShowLocal: "保存先の復元候補を見る",\n  saveConflict: "別の変更と重なったため、保存を止めています",'''
if t.count(old) != 1:
    raise SystemExit(f"i18n marker: {t.count(old)}")
t = t.replace(old, new, 1)
i18n.write_text(t)

test = Path("src/__tests__/App.native-durable-snapshot.test.tsx")
a = test.read_text()
marker = '''  it("初回loadNotesだけ一時失敗して直後にprimaryが読めてもnative safety probeで現在正本へ収束する", async () => {'''
extra = r'''  it("dirty screen・remote recovery・native別世代を混ぜず3候補として切り替えられる", async () => {
    const initial = [makeNote({ id: "shared", title: "同じメモ", body: "初期" })];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(initial);
    renderApp();
    await flushPromises();
    durable.persist.mockClear();

    act(() => click(findButton(container, "同じメモ")));
    act(() => click(findButton(container, copy.editNote)));
    let textarea = container.querySelector("textarea");
    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("textarea not found");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    act(() => {
      setter?.call(textarea, "screen dirty");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const localCandidate = [makeNote({ id: "shared", title: "同じメモ", body: "local recovery" })];
    const nativeCandidate = [makeNote({ id: "shared", title: "同じメモ", body: "native recovery" })];
    delete storage._store[STORAGE_KEY_FOR_TESTING];
    storage._store[BACKUP_KEY_FOR_TESTING] = JSON.stringify(localCandidate);
    durable.read.mockResolvedValue({ status: "available", notes: nativeCandidate });

    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY_FOR_TESTING, newValue: null }));
    });
    expect(container.querySelector('[data-testid="native-recovery-checking"]')).not.toBeNull();
    textarea = container.querySelector("textarea");
    expect(textarea?.value).toBe("screen dirty");
    await flushPromises();

    expect(container.querySelector('[data-testid="dirty-recovery-candidates"]')).not.toBeNull();
    expect(hasButton(container, copy.dirtyRecoveryShowLocal)).toBe(true);
    expect(hasButton(container, copy.nativeRecoveryShowAlternative)).toBe(true);

    act(() => click(findButton(container, copy.dirtyRecoveryShowLocal)));
    textarea = container.querySelector("textarea");
    expect(textarea?.value).toBe("local recovery");
    expect(hasButton(container, copy.dirtyRecoveryShowScreen)).toBe(true);

    act(() => click(findButton(container, copy.nativeRecoveryShowAlternative)));
    textarea = container.querySelector("textarea");
    expect(textarea?.value).toBe("native recovery");

    act(() => click(findButton(container, copy.dirtyRecoveryShowScreen)));
    textarea = container.querySelector("textarea");
    expect(textarea?.value).toBe("screen dirty");

    act(() => click(findButton(container, copy.storageRecoverySave)));
    await flushPromises();
    const saved = JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[];
    expect(saved[0]?.body).toBe("screen dirty");
    expect(durable.persist).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ body: "screen dirty" })]),
    );
  });

  it("dirty三者競合でnative読込失敗中は候補を保持したままforce確定を出さない", async () => {
    const initial = [makeNote({ id: "shared", title: "同じメモ", body: "初期" })];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(initial);
    renderApp();
    await flushPromises();

    act(() => click(findButton(container, "同じメモ")));
    act(() => click(findButton(container, copy.editNote)));
    const textarea = container.querySelector("textarea");
    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("textarea not found");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    act(() => {
      setter?.call(textarea, "絶対に守るdirty");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const localCandidate = [makeNote({ id: "shared", title: "同じメモ", body: "local" })];
    delete storage._store[STORAGE_KEY_FOR_TESTING];
    storage._store[BACKUP_KEY_FOR_TESTING] = JSON.stringify(localCandidate);
    durable.read.mockResolvedValue({ status: "error" });
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY_FOR_TESTING, newValue: null }));
    });
    await flushPromises();

    expect(container.textContent).toContain(copy.nativeRecoveryReadError);
    expect(hasButton(container, copy.storageRecoverySave)).toBe(false);
    expect(container.querySelector("textarea")?.value).toBe("絶対に守るdirty");
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBeUndefined();

    durable.read.mockResolvedValue({ status: "missing" });
    act(() => click(findButton(container, copy.nativeRecoveryRetry)));
    await flushPromises();

    expect(container.textContent).not.toContain(copy.nativeRecoveryReadError);
    expect(container.querySelector("textarea")?.value).toBe("絶対に守るdirty");
    expect(hasButton(container, copy.dirtyRecoveryShowLocal)).toBe(true);
    expect(hasButton(container, copy.storageRecoverySave)).toBe(true);
  });

  it("dirty三者probe中に正常primaryが戻っても未保存screenを自動破棄しない", async () => {
    const initial = [makeNote({ id: "shared", title: "同じメモ", body: "初期" })];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(initial);
    renderApp();
    await flushPromises();

    act(() => click(findButton(container, "同じメモ")));
    act(() => click(findButton(container, copy.editNote)));
    const textarea = container.querySelector("textarea");
    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("textarea not found");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    act(() => {
      setter?.call(textarea, "probe中も守るscreen");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });

    let resolveNative: ((value: { status: "available"; notes: Note[] }) => void) | undefined;
    durable.read.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveNative = resolve;
        }),
    );
    const localCandidate = [makeNote({ id: "shared", title: "同じメモ", body: "local recovery" })];
    delete storage._store[STORAGE_KEY_FOR_TESTING];
    storage._store[BACKUP_KEY_FOR_TESTING] = JSON.stringify(localCandidate);
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY_FOR_TESTING, newValue: null }));
    });
    await flushPromises();
    expect(resolveNative).toBeDefined();

    const returnedPrimary = [makeNote({ id: "shared", title: "同じメモ", body: "戻ったprimary" })];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(returnedPrimary);
    const nativeCandidate = [makeNote({ id: "shared", title: "同じメモ", body: "native別世代" })];
    await act(async () => {
      resolveNative?.({ status: "available", notes: nativeCandidate });
      await Promise.resolve();
    });
    await flushPromises();

    expect(container.querySelector("textarea")?.value).toBe("probe中も守るscreen");
    expect(container.querySelector('[data-testid="dirty-recovery-candidates"]')).not.toBeNull();
    expect(hasButton(container, copy.storageConflictLoad)).toBe(true);
    expect(hasButton(container, copy.dirtyRecoveryShowLocal)).toBe(true);
    expect(hasButton(container, copy.nativeRecoveryShowAlternative)).toBe(true);

    act(() => click(findButton(container, copy.storageConflictLoad)));
    await flushPromises();
    expect(container.querySelector("textarea")?.value).toBe("戻ったprimary");
  });

'''
if a.count(marker) != 1:
    raise SystemExit(f"test marker: {a.count(marker)}")
a = a.replace(marker, extra + marker, 1)
test.write_text(a)
