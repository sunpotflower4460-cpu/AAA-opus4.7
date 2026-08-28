from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}")
    file.write_text(text.replace(old, new, 1))


replace_once(
    "src/App.tsx",
    '''    applyCleanRemoteNotes(remote.notes);\n  }, [applyCleanRemoteNotes, flagExternalConflict]);''',
    '''    applyCleanRemoteNotes(remote.notes);\n    // 正常な保存先を正式採用したら、native復旧層も同じ正本へ追従させる。\n    // recovery candidate は上の !remote.ok 分岐なので、未確定候補をここで保存することはない。\n    persistDurableSnapshot(remote.notes);\n  }, [applyCleanRemoteNotes, flagExternalConflict, persistDurableSnapshot]);''',
)

replace_once(
    "src/App.tsx",
    '''        } else {\n          // この画面が未編集なら、別タブの最新状態へ安全に追従する。\n          applyCleanRemoteNotes(remote.notes);\n        }\n      }''',
    '''        } else {\n          // この画面が未編集なら、別タブの最新状態へ安全に追従する。\n          applyCleanRemoteNotes(remote.notes);\n          persistDurableSnapshot(remote.notes);\n        }\n      }''',
)

replace_once(
    "src/App.tsx",
    '''    window.addEventListener("storage", handleStorage);\n    return () => window.removeEventListener("storage", handleStorage);\n  }, [applyCleanRemoteNotes, flagExternalConflict]);''',
    '''    window.addEventListener("storage", handleStorage);\n    return () => window.removeEventListener("storage", handleStorage);\n  }, [applyCleanRemoteNotes, flagExternalConflict, persistDurableSnapshot]);''',
)

replace_once(
    "src/App.tsx",
    '''    setRecoveryCandidateCount(0);\n    setLoadError(false);\n  }, [clearPersistTimer]);''',
    '''    setRecoveryCandidateCount(0);\n    setLoadError(false);\n    // ユーザーが保存済み版を正本として明示採用したので、古いnative候補を残さない。\n    persistDurableSnapshot(result.notes);\n  }, [clearPersistTimer, persistDurableSnapshot]);''',
)

path = Path("src/__tests__/App.native-durable-snapshot.test.tsx")
text = path.read_text()
marker = '''  it("native予備保存失敗を非致命warningとして表示し、retry成功で消す", async () => {'''
addition = '''  it("clean状態で正常な外部保存版へ追従したらnative耐久層も同じ正本へ更新する", async () => {\n    const existing = [makeNote()];\n    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(existing);\n    renderApp();\n    await flushPromises();\n    durable.persist.mockClear();\n\n    const remote = [makeNote({ title: "外部の正本", updatedAt: "2026-08-28T00:01:00.000Z" })];\n    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(remote);\n    act(() => {\n      window.dispatchEvent(\n        new StorageEvent("storage", { key: STORAGE_KEY_FOR_TESTING, newValue: JSON.stringify(remote) }),\n      );\n    });\n    await flushPromises();\n\n    expect(container.textContent).toContain("外部の正本");\n    expect(durable.persist).toHaveBeenCalledWith(remote);\n  });\n\n  it("競合で保存済み版を明示採用したら捨てたlocal版をnative復元候補に残さない", async () => {\n    const existing = [makeNote()];\n    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(existing);\n    renderApp();\n    await flushPromises();\n    durable.persist.mockClear();\n\n    act(() => click(findButton(container, "元のメモ")));\n    act(() => click(findButton(container, copy.editNote)));\n    const textarea = container.querySelector("textarea");\n    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("textarea not found");\n    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;\n    act(() => {\n      setter?.call(textarea, "捨てる未保存編集");\n      textarea.dispatchEvent(new Event("input", { bubbles: true }));\n    });\n\n    const remote = [makeNote({ title: "採用する保存済み版", updatedAt: "2026-08-28T00:02:00.000Z" })];\n    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(remote);\n    act(() => {\n      window.dispatchEvent(\n        new StorageEvent("storage", { key: STORAGE_KEY_FOR_TESTING, newValue: JSON.stringify(remote) }),\n      );\n    });\n    expect(container.textContent).toContain(copy.storageConflictTitle);\n    expect(durable.persist).not.toHaveBeenCalled();\n\n    act(() => click(findButton(container, copy.storageConflictLoad)));\n    await flushPromises();\n\n    expect(container.textContent).toContain("採用する保存済み版");\n    expect(durable.persist).toHaveBeenCalledWith(remote);\n  });\n\n'''
if text.count(marker) != 1:
    raise SystemExit(f"test marker count={text.count(marker)}")
path.write_text(text.replace(marker, addition + marker, 1))
