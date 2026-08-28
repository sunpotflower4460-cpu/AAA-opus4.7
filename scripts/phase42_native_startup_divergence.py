from pathlib import Path

app = Path("src/App.tsx")
text = app.read_text()

old = '''  const [nativeRecoveryInitiallyRequired] = useState(
    () =>
      isNativeDurableSnapshotAvailable() &&
      (initialLoad.loadFailed ||
        initialLoad.primaryHealth === "missing" ||
        initialLoad.primaryHealth === "invalid" ||
        initialLoad.primaryHealth === "unavailable"),
  );'''
new = '''  // native環境では localStorage が正常でも、端末内耐久層との不一致を確認するまで
  // 編集・保存を開始しない。localだけを信頼してnativeを即上書きすると、古いlocalで
  // より新しいnative snapshotを世代送りする可能性があるため。
  const [nativeRecoveryInitiallyRequired] = useState(
    () => isNativeDurableSnapshotAvailable(),
  );'''
if text.count(old) != 1:
    raise SystemExit(f"initial native gate marker: {text.count(old)}")
text = text.replace(old, new, 1)

old = '''      if (current.ok) {
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

      if (hasRecoveryCandidate(current)) {'''
new = '''      if (current.ok) {
        // probe中にlocal primaryが正常へ戻っても、native結果との比較を飛ばさない。
        // 下の通常primary/native判定へ合流し、異なる世代を自動上書きしない。
        localRecoveryCandidateRef.current = null;
      }

      if (hasRecoveryCandidate(current)) {'''
if text.count(old) != 1:
    raise SystemExit(f"recovered valid local marker: {text.count(old)}")
text = text.replace(old, new, 1)

old = '''    // probe中に別タブ等から正常primaryが到着した場合は、その現在値を正本として採用する。
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
    }'''
new = '''    // 正常local primaryがある場合も、native safety probeの結果を比較してから正本を確定する。
    // localとnativeのどちらが新しいかをupdatedAt等から推測せず、不一致は明示選択へ送る。
    if (primaryHealth === "valid") {
      const current = loadNotes();
      if (!current.ok) {
        flagExternalConflict(
          canChooseStoredPrimary(current),
          !hasRecoveryCandidate(current),
          hasRecoveryCandidate(current) ? current.notes.length : 0,
        );
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
    }'''
if text.count(old) != 1:
    raise SystemExit(f"valid primary comparison marker: {text.count(old)}")
text = text.replace(old, new, 1)

old = '''  useEffect(() => {
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
  ]);'''
new = '''  useEffect(() => {
    if (!nativeRecoveryInitiallyRequired) return undefined;

    // native環境はlocal primaryの健康状態に関係なく、起動時に一度だけnativeと比較する。
    // 初期state/refですでに編集・保存はgate済み。probeのstate通知はeffect本体の外で開始する。
    queueMicrotask(() => {
      void probeNativeRecovery();
    });
    return () => {
      nativeRecoveryProbeIdRef.current += 1;
    };
  }, [nativeRecoveryInitiallyRequired, probeNativeRecovery]);'''
if text.count(old) != 1:
    raise SystemExit(f"startup effect marker: {text.count(old)}")
text = text.replace(old, new, 1)
app.write_text(text)


test = Path("src/__tests__/App.native-durable-snapshot.test.tsx")
t = test.read_text()
old = '''  it("既存の正常localStorageは初回起動時にnative耐久層へ移行する", async () => {
    const existing = [makeNote()];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(existing);
    renderApp();
    await flushPromises();
    expect(durable.persist).toHaveBeenCalledWith(existing);
  });'''
new = '''  it("既存の正常localStorageもnative missing確認後にだけ耐久層へ移行する", async () => {
    const existing = [makeNote()];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(existing);
    renderApp();
    await flushPromises();

    expect(durable.read).toHaveBeenCalledTimes(1);
    expect(durable.persist).toHaveBeenCalledWith(existing);
    expect(durable.read.mock.invocationCallOrder[0]).toBeLessThan(
      durable.persist.mock.invocationCallOrder[0],
    );
    expect(container.textContent).not.toContain(copy.nativeRecoveryReadError);
  });

  it("正常localと異なるnative snapshotは起動だけで上書きせず別候補として保持する", async () => {
    const local = [makeNote({ title: "localの正本" })];
    const native = [
      makeNote({
        title: "nativeの別世代",
        body: "localにはない内容",
        updatedAt: "2026-08-28T00:05:00.000Z",
      }),
    ];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(local);
    durable.read.mockResolvedValue({ status: "available", notes: native });

    renderApp();
    await flushPromises();

    expect(container.textContent).toContain("localの正本");
    expect(container.textContent).toContain(copy.storageConflictTitle);
    expect(container.textContent).toContain(copy.nativeRecoveryAlternativeNotice(native.length));
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBe(JSON.stringify(local));
    expect(durable.persist).not.toHaveBeenCalled();

    act(() => click(findButton(container, copy.nativeRecoveryShowAlternative)));
    expect(container.textContent).toContain("nativeの別世代");
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBe(JSON.stringify(local));
    expect(durable.persist).not.toHaveBeenCalled();

    act(() => click(findButton(container, copy.storageConflictOverwrite)));
    await flushPromises();

    expect(JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[]).toEqual(native);
    expect(durable.persist).toHaveBeenCalledWith(native);
    expect(container.textContent).not.toContain(copy.storageConflictTitle);
  });

  it("正常localとnativeが異なる起動競合で保存済みlocalを明示採用できる", async () => {
    const local = [makeNote({ title: "採用するlocal" })];
    const native = [makeNote({ title: "採用しないnative" })];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(local);
    durable.read.mockResolvedValue({ status: "available", notes: native });

    renderApp();
    await flushPromises();
    expect(durable.persist).not.toHaveBeenCalled();

    act(() => click(findButton(container, copy.storageConflictLoad)));
    await flushPromises();

    expect(JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[]).toEqual(local);
    expect(durable.persist).toHaveBeenCalledWith(local);
    expect(container.textContent).not.toContain(copy.storageConflictTitle);
  });

  it("正常localがあってもnative読込障害中はlocalでnativeを上書きせずretryまでgateする", async () => {
    const local = [makeNote({ title: "読めるlocal" })];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(local);
    durable.read
      .mockResolvedValueOnce({ status: "error" })
      .mockResolvedValue({ status: "missing" });

    renderApp();
    await flushPromises();

    expect(container.textContent).toContain(copy.nativeRecoveryReadError);
    expect(durable.persist).not.toHaveBeenCalled();
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBe(JSON.stringify(local));

    act(() => click(findButton(container, copy.nativeRecoveryRetry)));
    await flushPromises();

    expect(container.textContent).not.toContain(copy.nativeRecoveryReadError);
    expect(durable.persist).toHaveBeenCalledWith(local);
  });'''
if t.count(old) != 1:
    raise SystemExit(f"startup migration test marker: {t.count(old)}")
test.write_text(t.replace(old, new, 1))
