from pathlib import Path

app = Path("src/App.tsx")
text = app.read_text()
old = '''        if (!duplicatesKnownCandidate) {\n          nativeRecoveryAlternativeRef.current = nativeResult.notes;\n          setNativeRecoveryAlternativeCount(nativeResult.notes.length);\n        }'''
new = '''        if (\n          !duplicatesKnownCandidate &&\n          nativeRecoveryAlternativeRef.current === null\n        ) {\n          // 一度提示した native 候補は、後続 probe で自動置換しない。\n          // conflict 中にその候補をユーザーが編集していても非同期 read で失わないため。\n          nativeRecoveryAlternativeRef.current = nativeResult.notes;\n          setNativeRecoveryAlternativeCount(nativeResult.notes.length);\n        }'''
if text.count(old) != 1:
    raise SystemExit(f"dirty native candidate marker: {text.count(old)}")
app.write_text(text.replace(old, new, 1))

test = Path("src/__tests__/App.native-durable-snapshot.test.tsx")
t = test.read_text()
marker = '''  it("dirty三者競合でnative読込失敗中は候補を保持したままforce確定を出さない", async () => {'''
extra = r'''  it("表示中native候補を編集後に再probeされても自動上書きしない", async () => {
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
    const nativeOne = [makeNote({ id: "shared", title: "同じメモ", body: "native one" })];
    delete storage._store[STORAGE_KEY_FOR_TESTING];
    storage._store[BACKUP_KEY_FOR_TESTING] = JSON.stringify(localOne);
    durable.read.mockResolvedValue({ status: "available", notes: nativeOne });
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY_FOR_TESTING, newValue: null }));
    });
    await flushPromises();

    act(() => click(findButton(container, copy.nativeRecoveryShowAlternative)));
    textarea = container.querySelector("textarea");
    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("textarea not found");
    expect(textarea.value).toBe("native one");
    const nativeTextarea = textarea;
    act(() => {
      setter?.call(nativeTextarea, "native edited by user");
      nativeTextarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(container.querySelector("textarea")?.value).toBe("native edited by user");

    const localTwo = [makeNote({ id: "shared", title: "同じメモ", body: "local two" })];
    const nativeTwo = [makeNote({ id: "shared", title: "同じメモ", body: "native two from probe" })];
    storage._store[BACKUP_KEY_FOR_TESTING] = JSON.stringify(localTwo);
    durable.read.mockResolvedValue({ status: "available", notes: nativeTwo });
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY_FOR_TESTING, newValue: null }));
    });
    expect(container.querySelector("textarea")?.value).toBe("native edited by user");
    await flushPromises();
    expect(container.querySelector("textarea")?.value).toBe("native edited by user");

    act(() => click(findButton(container, copy.dirtyRecoveryShowScreen)));
    expect(container.querySelector("textarea")?.value).toBe("screen dirty");
    act(() => click(findButton(container, copy.nativeRecoveryShowAlternative)));
    expect(container.querySelector("textarea")?.value).toBe("native edited by user");
  });

'''
if t.count(marker) != 1:
    raise SystemExit(f"native test insertion marker: {t.count(marker)}")
test.write_text(t.replace(marker, extra + marker, 1))
