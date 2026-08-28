from pathlib import Path

app = Path("src/App.tsx")
text = app.read_text()

old = '''      localRecoveryCandidateRef.current = remoteSnapshot;\n      if (recoveryCandidateSourceRef.current === "local") {\n        latestNotesRef.current = remoteSnapshot;\n        setNotes(remoteSnapshot);\n        setRecoveryCandidateCount(remoteSnapshot.length);\n      }'''
new = '''      // 一度ユーザーへ提示した local 候補は、その後の storage event で自動置換しない。\n      // 候補を表示中にユーザーが編集していても、別タブの新しい recovery で上書きしないため。\n      // 新しい remote 世代自体は保存層に残り、force 確定時の conflict archive で保全される。\n      if (localRecoveryCandidateRef.current === null) {\n        localRecoveryCandidateRef.current = remoteSnapshot;\n        if (recoveryCandidateSourceRef.current === "local") {\n          latestNotesRef.current = remoteSnapshot;\n          setNotes(remoteSnapshot);\n          setRecoveryCandidateCount(remoteSnapshot.length);\n        }\n      }'''
if text.count(old) != 1:
    raise SystemExit(f"register dirty local marker: {text.count(old)}")
text = text.replace(old, new, 1)

old = '''      const current = loadNotes();\n      let latestLocalCandidate = localRecoveryCandidate;\n\n      if (!current.ok && hasRecoveryCandidate(current)) {\n        latestLocalCandidate = current.notes;\n        localRecoveryCandidateRef.current = current.notes;\n        if (recoveryCandidateSourceRef.current === "local") {\n          latestNotesRef.current = current.notes;\n          setNotes(current.notes);\n          setRecoveryCandidateCount(current.notes.length);\n        }\n      }\n\n      setCanLoadStoredNotes(canChooseStoredPrimary(current));'''
new = '''      const current = loadNotes();\n      const latestLocalCandidate = localRecoveryCandidate;\n      const currentStoredRecoveryCandidate =\n        !current.ok && hasRecoveryCandidate(current) ? current.notes : null;\n\n      // probe 中に保存層の recovery 世代が変わっても、すでに提示済みの local 候補を\n      // 自動置換しない。active local 候補へのユーザー編集を非同期 probe で失わないため。\n      setCanLoadStoredNotes(canChooseStoredPrimary(current));'''
if text.count(old) != 1:
    raise SystemExit(f"dirty probe local refresh marker: {text.count(old)}")
text = text.replace(old, new, 1)

old = '''          notesSnapshotMatches(nativeResult.notes, screenRecoveryCandidate) ||\n          notesSnapshotMatches(nativeResult.notes, latestLocalCandidate) ||\n          (current.ok && notesSnapshotMatches(nativeResult.notes, current.notes));'''
new = '''          notesSnapshotMatches(nativeResult.notes, screenRecoveryCandidate) ||\n          notesSnapshotMatches(nativeResult.notes, latestLocalCandidate) ||\n          (currentStoredRecoveryCandidate !== null &&\n            notesSnapshotMatches(nativeResult.notes, currentStoredRecoveryCandidate)) ||\n          (current.ok && notesSnapshotMatches(nativeResult.notes, current.notes));'''
if text.count(old) != 1:
    raise SystemExit(f"dirty probe duplicate marker: {text.count(old)}")
text = text.replace(old, new, 1)
app.write_text(text)

test = Path("src/__tests__/App.native-durable-snapshot.test.tsx")
t = test.read_text()
marker = '''  it("dirty三者競合でnative読込失敗中は候補を保持したままforce確定を出さない", async () => {'''
extra = r'''  it("表示中local候補を編集後に別remote recoveryが来ても自動上書きしない", async () => {
    const initial = [makeNote({ id: "shared", title: "同じメモ", body: "初期" })];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(initial);
    renderApp();
    await flushPromises();

    act(() => click(findButton(container, "同じメモ")));
    act(() => click(findButton(container, copy.editNote)));
    let textarea = container.querySelector("textarea");
    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("textarea not found");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    const initialTextarea = textarea;
    act(() => {
      setter?.call(initialTextarea, "screen dirty");
      initialTextarea.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const localOne = [makeNote({ id: "shared", title: "同じメモ", body: "local one" })];
    const nativeCandidate = [makeNote({ id: "shared", title: "同じメモ", body: "native" })];
    delete storage._store[STORAGE_KEY_FOR_TESTING];
    storage._store[BACKUP_KEY_FOR_TESTING] = JSON.stringify(localOne);
    durable.read.mockResolvedValue({ status: "available", notes: nativeCandidate });
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY_FOR_TESTING, newValue: null }));
    });
    await flushPromises();

    act(() => click(findButton(container, copy.dirtyRecoveryShowLocal)));
    textarea = container.querySelector("textarea");
    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("textarea not found");
    expect(textarea.value).toBe("local one");
    const localTextarea = textarea;
    act(() => {
      setter?.call(localTextarea, "local edited by user");
      localTextarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(container.querySelector("textarea")?.value).toBe("local edited by user");

    const localTwo = [makeNote({ id: "shared", title: "同じメモ", body: "local two from remote" })];
    storage._store[BACKUP_KEY_FOR_TESTING] = JSON.stringify(localTwo);
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY_FOR_TESTING, newValue: null }));
    });
    expect(container.querySelector("textarea")?.value).toBe("local edited by user");
    await flushPromises();
    expect(container.querySelector("textarea")?.value).toBe("local edited by user");

    act(() => click(findButton(container, copy.dirtyRecoveryShowScreen)));
    expect(container.querySelector("textarea")?.value).toBe("screen dirty");
    act(() => click(findButton(container, copy.dirtyRecoveryShowLocal)));
    expect(container.querySelector("textarea")?.value).toBe("local edited by user");
    expect(JSON.parse(storage._store[BACKUP_KEY_FOR_TESTING]) as Note[]).toEqual(localTwo);
  });

'''
if t.count(marker) != 1:
    raise SystemExit(f"test insertion marker: {t.count(marker)}")
t = t.replace(marker, extra + marker, 1)
test.write_text(t)
