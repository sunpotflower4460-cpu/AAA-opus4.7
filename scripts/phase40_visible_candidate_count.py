from pathlib import Path

app = Path("src/App.tsx")
text = app.read_text()
old = '''            const screenCount =\n              screenRecoveryCandidateRef.current?.length ?? latestNotesRef.current.length;\n            registerDirtyRecoveryCandidate(remote.notes);\n            flagExternalConflict(\n              canChooseStoredPrimary(remote),\n              false,\n              screenCount,\n            );'''
new = '''            // 件数表示は現在ユーザーが見ている候補に合わせる。\n            // 3-way開始後にlocal/nativeへ切り替えていても、screen件数へ巻き戻さない。\n            const visibleCandidateCount = latestNotesRef.current.length;\n            registerDirtyRecoveryCandidate(remote.notes);\n            flagExternalConflict(\n              canChooseStoredPrimary(remote),\n              false,\n              visibleCandidateCount,\n            );'''
if text.count(old) != 1:
    raise SystemExit(f"visible candidate count marker: {text.count(old)}")
app.write_text(text.replace(old, new, 1))

test = Path("src/__tests__/App.native-durable-snapshot.test.tsx")
t = test.read_text()
old = '''    const localOne = [makeNote({ id: "shared", title: "同じメモ", body: "local one" })];\n    const nativeCandidate = [makeNote({ id: "shared", title: "同じメモ", body: "native" })];'''
new = '''    const localOne = [\n      makeNote({ id: "shared", title: "同じメモ", body: "local one" }),\n      makeNote({ id: "local-extra", title: "local extra", body: "second" }),\n    ];\n    const nativeCandidate = [makeNote({ id: "shared", title: "同じメモ", body: "native" })];'''
if t.count(old) != 1:
    raise SystemExit(f"localOne marker: {t.count(old)}")
t = t.replace(old, new, 1)
old = '''    await flushPromises();\n    expect(container.querySelector("textarea")?.value).toBe("local edited by user");\n\n    act(() => click(findButton(container, copy.dirtyRecoveryShowScreen)));'''
new = '''    await flushPromises();\n    expect(container.querySelector("textarea")?.value).toBe("local edited by user");\n    expect(container.textContent).toContain(copy.storageRecoveryCandidateCount(2));\n\n    act(() => click(findButton(container, copy.dirtyRecoveryShowScreen)));'''
if t.count(old) != 1:
    raise SystemExit(f"count assertion marker: {t.count(old)}")
t = t.replace(old, new, 1)
test.write_text(t)
