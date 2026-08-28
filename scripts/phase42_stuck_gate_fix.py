from pathlib import Path

app = Path("src/App.tsx")
text = app.read_text()
old = '''      if (!current.ok) {\n        flagExternalConflict(\n          canChooseStoredPrimary(current),\n          !hasRecoveryCandidate(current),\n          hasRecoveryCandidate(current) ? current.notes.length : 0,\n        );\n        return;\n      }'''
new = '''      if (!current.ok) {\n        if (hasRecoveryCandidate(current)) {\n          // primary health確認後に別タブ等がpending/recovery候補を追加した場合、\n          // mixed-timeの判定で解決せず候補を登録してnativeを再probeする。\n          // storage eventはnative gate中に抑止されるため、ここで明示的に拾う必要がある。\n          registerLocalRecoveryCandidate(current.notes);\n          return;\n        }\n\n        // 2回目のlocal readが失敗した場合も「checking」のまま固定しない。\n        // local/nativeの整合性を確定できないためfail closedでRetryへ送る。\n        nativeRecoveryGateRef.current = true;\n        saveGuardRef.current = true;\n        setNativeRecoveryStatus("error");\n        setNativeBackupRetryAllowed(false);\n        setLoadError(false);\n        return;\n      }'''
if text.count(old) != 1:
    raise SystemExit(f"second local read marker: {text.count(old)}")
text = text.replace(old, new, 1)
old_deps = '''  }, [\n    clearPersistTimer,\n    clearRecoveryCandidateSources,\n    flagExternalConflict,\n    persistDurableSnapshot,\n  ]);'''
new_deps = '''  }, [\n    clearPersistTimer,\n    clearRecoveryCandidateSources,\n    flagExternalConflict,\n    persistDurableSnapshot,\n    registerLocalRecoveryCandidate,\n  ]);'''
if text.count(old_deps) != 1:
    raise SystemExit(f"probe deps marker: {text.count(old_deps)}")
app.write_text(text.replace(old_deps, new_deps, 1))


test = Path("src/__tests__/App.native-durable-snapshot.test.tsx")
t = test.read_text()
old_import = '''import { BACKUP_KEY_FOR_TESTING, STORAGE_KEY_FOR_TESTING } from "../lib/storage";'''
new_import = '''import {\n  BACKUP_KEY_FOR_TESTING,\n  PENDING_SAVE_KEY_FOR_TESTING,\n  STORAGE_KEY_FOR_TESTING,\n} from "../lib/storage";'''
if t.count(old_import) != 1:
    raise SystemExit(f"storage import marker: {t.count(old_import)}")
t = t.replace(old_import, new_import, 1)
marker = '''  it("通常autosave成功後は最新snapshotをnative側にも保存する", async () => {'''
extra = '''  it("native待機中にvalid primaryへpending候補が追加されてもcheckingに固定せず再probeして競合を解放する", async () => {\n    const existing = [makeNote({ title: "元の保存済み版" })];\n    const pending = [\n      makeNote({\n        title: "native待機中の中断候補",\n        body: "別タブが追加した候補",\n        updatedAt: "2026-08-28T00:10:00.000Z",\n      }),\n    ];\n    const existingRaw = JSON.stringify(existing);\n    const pendingRaw = JSON.stringify(pending);\n    storage._store[STORAGE_KEY_FOR_TESTING] = existingRaw;\n\n    let resolveFirstRead!: (value: { status: "missing" }) => void;\n    durable.read\n      .mockReturnValueOnce(\n        new Promise((resolve) => {\n          resolveFirstRead = resolve;\n        }),\n      )\n      .mockResolvedValue({ status: "missing" });\n\n    renderApp();\n    await flushPromises();\n    expect(container.textContent).toContain(copy.nativeRecoveryChecking);\n\n    storage._store[PENDING_SAVE_KEY_FOR_TESTING] = JSON.stringify({\n      version: 1,\n      baseRaw: existingRaw,\n      nextRaw: pendingRaw,\n      writerId: "other-tab",\n    });\n\n    await act(async () => {\n      resolveFirstRead({ status: "missing" });\n      await Promise.resolve();\n      await Promise.resolve();\n      await Promise.resolve();\n    });\n    await flushPromises();\n\n    expect(durable.read).toHaveBeenCalledTimes(2);\n    expect(container.textContent).not.toContain(copy.nativeRecoveryChecking);\n    expect(container.textContent).not.toContain(copy.nativeRecoveryReadError);\n    expect(container.textContent).toContain(copy.storageConflictTitle);\n    expect(container.textContent).toContain("native待機中の中断候補");\n    expect(hasButton(container, copy.storageConflictLoad)).toBe(true);\n    expect(hasButton(container, copy.storageConflictOverwrite)).toBe(true);\n    expect(durable.persist).not.toHaveBeenCalled();\n  });\n\n'''
if t.count(marker) != 1:
    raise SystemExit(f"stuck gate test marker: {t.count(marker)}")
test.write_text(t.replace(marker, extra + marker, 1))
