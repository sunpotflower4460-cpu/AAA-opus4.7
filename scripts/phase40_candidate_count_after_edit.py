from pathlib import Path

app = Path("src/App.tsx")
text = app.read_text()
old = '''    if (\n      recoveryCandidateSourceRef.current === "screen" &&\n      screenRecoveryCandidateRef.current !== null\n    ) {\n      screenRecoveryCandidateRef.current = notes;\n      setScreenRecoveryCandidateCount(notes.length);\n    } else if (\n      recoveryCandidateSourceRef.current === "local" &&\n      localRecoveryCandidateRef.current !== null\n    ) {\n      localRecoveryCandidateRef.current = notes;\n    } else if (\n      recoveryCandidateSourceRef.current === "native" &&\n      nativeRecoveryAlternativeRef.current !== null\n    ) {\n      nativeRecoveryAlternativeRef.current = notes;\n    }'''
new = '''    if (\n      recoveryCandidateSourceRef.current === "screen" &&\n      screenRecoveryCandidateRef.current !== null\n    ) {\n      screenRecoveryCandidateRef.current = notes;\n      setScreenRecoveryCandidateCount(notes.length);\n      setRecoveryCandidateCount(notes.length);\n    } else if (\n      recoveryCandidateSourceRef.current === "local" &&\n      localRecoveryCandidateRef.current !== null\n    ) {\n      localRecoveryCandidateRef.current = notes;\n      setRecoveryCandidateCount(notes.length);\n    } else if (\n      recoveryCandidateSourceRef.current === "native" &&\n      nativeRecoveryAlternativeRef.current !== null\n    ) {\n      nativeRecoveryAlternativeRef.current = notes;\n      setNativeRecoveryAlternativeCount(notes.length);\n      setRecoveryCandidateCount(notes.length);\n    }'''
if text.count(old) != 1:
    raise SystemExit(f"candidate count layout marker: {text.count(old)}")
app.write_text(text.replace(old, new, 1))

test = Path("src/__tests__/App.native-durable-snapshot.test.tsx")
t = test.read_text()
marker = '''  it("dirty三者競合でnative読込失敗中は候補を保持したままforce確定を出さない", async () => {'''
extra = r'''  it("表示中native候補の件数を編集すると候補件数表示も追従する", async () => {
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
      setter?.call(textarea, "screen dirty");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const localCandidate = [makeNote({ id: "shared", title: "同じメモ", body: "local" })];
    const nativeCandidate = [makeNote({ id: "shared", title: "同じメモ", body: "native" })];
    delete storage._store[STORAGE_KEY_FOR_TESTING];
    storage._store[BACKUP_KEY_FOR_TESTING] = JSON.stringify(localCandidate);
    durable.read.mockResolvedValue({ status: "available", notes: nativeCandidate });
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY_FOR_TESTING, newValue: null }));
    });
    await flushPromises();

    act(() => click(findButton(container, copy.nativeRecoveryShowAlternative)));
    expect(container.textContent).toContain(copy.nativeRecoveryAlternativeNotice(1));

    act(() => click(findButton(container, copy.back)));
    act(() => click(findButton(container, copy.newNote)));

    expect(container.textContent).toContain(copy.nativeRecoveryAlternativeNotice(2));
    expect(container.textContent).not.toContain(copy.nativeRecoveryAlternativeNotice(1));
  });

'''
if t.count(marker) != 1:
    raise SystemExit(f"candidate count test marker: {t.count(marker)}")
test.write_text(t.replace(marker, extra + marker, 1))
