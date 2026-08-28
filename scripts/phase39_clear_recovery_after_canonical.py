from pathlib import Path

app = Path("src/App.tsx")
text = app.read_text()
old = '''      if (current.ok) {\n        nativeRecoveryGateRef.current = false;\n        setNativeRecoveryStatus("idle");\n        saveGuardRef.current = false;\n        clearRecoveryCandidateSources();\n        applyCleanRemoteNotes(current.notes);\n        setLoadError(false);\n        persistDurableSnapshot(current.notes);\n        return;\n      }'''
new = '''      if (current.ok) {\n        nativeRecoveryGateRef.current = false;\n        setNativeRecoveryStatus("idle");\n        saveGuardRef.current = false;\n        notesDirtyRef.current = false;\n        dirtySinceRef.current = null;\n        baselineNotesRef.current = current.notes;\n        latestNotesRef.current = current.notes;\n        externalConflictRef.current = false;\n        clearRecoveryCandidateSources();\n        setNotes(current.notes);\n        setLastSaveResult(null);\n        setExternalConflict(false);\n        setCanLoadStoredNotes(true);\n        setRecoveryCandidateCount(0);\n        setLoadError(false);\n        persistDurableSnapshot(current.notes);\n        return;\n      }'''
if text.count(old) != 1:
    raise SystemExit(f"canonical adoption branch: expected 1, found {text.count(old)}")
app.write_text(text.replace(old, new, 1))

test = Path("src/__tests__/App.native-durable-snapshot.test.tsx")
t = test.read_text()
marker = '''  it("local復元候補があってもnativeを確認し、異なる別世代を隠さず明示的に切り替えられる", async () => {'''
extra = r'''  it("local復元確認中にprimaryが正常化したら候補と同一内容でもrecovery状態を完全解除する", async () => {
    const candidate = [makeNote({ id: "recovered", title: "復旧候補と同じ正本" })];
    storage._store[BACKUP_KEY_FOR_TESTING] = JSON.stringify(candidate);
    let resolveNative: ((value: { status: "missing" }) => void) | undefined;
    durable.read.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveNative = resolve;
        }),
    );

    renderApp();
    expect(container.querySelector('[data-testid="native-recovery-checking"]')).not.toBeNull();
    expect(container.textContent).toContain("復旧候補と同じ正本");

    // probe本体はqueueMicrotaskで開始される。resolver生成前にresolveするとテストだけが
    // 永久pendingになるため、実際にnative readが始まったことを確認してから競合を再現する。
    await flushPromises();
    expect(durable.read).toHaveBeenCalledTimes(1);
    expect(resolveNative).toBeDefined();

    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(candidate);
    await act(async () => {
      resolveNative?.({ status: "missing" });
      await Promise.resolve();
    });
    await flushPromises();

    expect(container.querySelector('[data-testid="native-recovery-checking"]')).toBeNull();
    expect(container.textContent).not.toContain(copy.storageRecoveryTitle);
    expect(hasButton(container, copy.storageRecoverySave)).toBe(false);
    expect(durable.persist).toHaveBeenCalledWith(candidate);

    act(() => click(findButton(container, "復旧候補と同じ正本")));
    act(() => click(findButton(container, copy.editNote)));
    const textarea = container.querySelector("textarea");
    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("textarea not found");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    act(() => {
      setter?.call(textarea, "正常化後に編集できる");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      vi.advanceTimersByTime(500);
    });
    await flushPromises();

    const saved = JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[];
    expect(saved[0]?.body).toBe("正常化後に編集できる");
  });

'''
if t.count(marker) != 1:
    raise SystemExit(f"test insertion marker: expected 1, found {t.count(marker)}")
test.write_text(t.replace(marker, extra + marker, 1))
