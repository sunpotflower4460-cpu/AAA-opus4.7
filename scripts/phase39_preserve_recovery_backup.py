from pathlib import Path

storage = Path("src/lib/storage.ts")
text = storage.read_text()
old = '''const SECONDARY_CONFLICT_BACKUP_KEY = "zanshin.notes.conflict.secondary.backup.v1";\n// localStorage は複数キーを原子的に更新できないため、base -> next を記録して中断保存を判定する。'''
new = '''const SECONDARY_CONFLICT_BACKUP_KEY = "zanshin.notes.conflict.secondary.backup.v1";\n// force-save 直前の通常 recovery backup が current/pending と別世代なら、見えていない候補として別退避する。\nconst RECOVERY_CONFLICT_BACKUP_KEY = "zanshin.notes.recovery.conflict.backup.v1";\n// localStorage は複数キーを原子的に更新できないため、base -> next を記録して中断保存を判定する。'''
if text.count(old) != 1:
    raise SystemExit(f"storage constant marker: expected 1, found {text.count(old)}")
text = text.replace(old, new, 1)

old = '''      const currentCandidateRaw =\n        currentRaw !== null &&\n        currentParsed.status === "valid" &&\n        currentRaw !== serialized\n          ? currentRaw\n          : null;\n\n      // pending の next が未採用なら最優先 conflict backup に残す。'''
new = '''      const currentCandidateRaw =\n        currentRaw !== null &&\n        currentParsed.status === "valid" &&\n        currentRaw !== serialized\n          ? currentRaw\n          : null;\n      const existingRecoveryBackupRaw = window.localStorage.getItem(BACKUP_KEY);\n      const recoveryBackupCandidateRaw =\n        existingRecoveryBackupRaw !== null &&\n        parseNotesRaw(existingRecoveryBackupRaw).status === "valid" &&\n        existingRecoveryBackupRaw !== serialized &&\n        existingRecoveryBackupRaw !== pendingCandidateRaw &&\n        existingRecoveryBackupRaw !== currentCandidateRaw\n          ? existingRecoveryBackupRaw\n          : null;\n\n      // pending の next が未採用なら最優先 conflict backup に残す。'''
if text.count(old) != 1:
    raise SystemExit(f"force candidate marker: expected 1, found {text.count(old)}")
text = text.replace(old, new, 1)

old = '''      if (currentCandidateRaw !== null) {\n        const currentBackupKey =\n          pendingCandidateRaw !== null && pendingCandidateRaw !== currentCandidateRaw\n            ? SECONDARY_CONFLICT_BACKUP_KEY\n            : CONFLICT_BACKUP_KEY;\n        try {\n          window.localStorage.setItem(currentBackupKey, currentCandidateRaw);\n        } catch (error) {\n          return saveFailureFromError(error);\n        }\n      }\n    }\n\n    const nextJournal = JSON.stringify({'''
new = '''      if (currentCandidateRaw !== null) {\n        const currentBackupKey =\n          pendingCandidateRaw !== null && pendingCandidateRaw !== currentCandidateRaw\n            ? SECONDARY_CONFLICT_BACKUP_KEY\n            : CONFLICT_BACKUP_KEY;\n        try {\n          window.localStorage.setItem(currentBackupKey, currentCandidateRaw);\n        } catch (error) {\n          return saveFailureFromError(error);\n        }\n      }\n\n      // primary が壊れている/消えている時は BACKUP_KEY が唯一の正常候補になり得る。\n      // force-save で BACKUP_KEY を新版へ更新する前に、別世代なら専用退避へ確定する。\n      if (recoveryBackupCandidateRaw !== null) {\n        try {\n          window.localStorage.setItem(RECOVERY_CONFLICT_BACKUP_KEY, recoveryBackupCandidateRaw);\n        } catch (error) {\n          return saveFailureFromError(error);\n        }\n      }\n    }\n\n    const nextJournal = JSON.stringify({'''
if text.count(old) != 1:
    raise SystemExit(f"force preservation marker: expected 1, found {text.count(old)}")
text = text.replace(old, new, 1)

old = '''export const SECONDARY_CONFLICT_BACKUP_KEY_FOR_TESTING = SECONDARY_CONFLICT_BACKUP_KEY;\nexport const PENDING_SAVE_KEY_FOR_TESTING = PENDING_SAVE_KEY;'''
new = '''export const SECONDARY_CONFLICT_BACKUP_KEY_FOR_TESTING = SECONDARY_CONFLICT_BACKUP_KEY;\nexport const RECOVERY_CONFLICT_BACKUP_KEY_FOR_TESTING = RECOVERY_CONFLICT_BACKUP_KEY;\nexport const PENDING_SAVE_KEY_FOR_TESTING = PENDING_SAVE_KEY;'''
if text.count(old) != 1:
    raise SystemExit(f"storage export marker: expected 1, found {text.count(old)}")
storage.write_text(text.replace(old, new, 1))

test = Path("src/lib/__tests__/storage.test.ts")
t = test.read_text()
old = '''  CONFLICT_BACKUP_KEY_FOR_TESTING,\n  PENDING_SAVE_KEY_FOR_TESTING,'''
new = '''  CONFLICT_BACKUP_KEY_FOR_TESTING,\n  RECOVERY_CONFLICT_BACKUP_KEY_FOR_TESTING,\n  PENDING_SAVE_KEY_FOR_TESTING,'''
if t.count(old) != 1:
    raise SystemExit(f"test import marker: expected 1, found {t.count(old)}")
t = t.replace(old, new, 1)

marker = '''  it("force 保存で conflict backup の退避に失敗したら別画面版を上書きしない", () => {'''
extra = '''  it("force 保存は BACKUP_KEY だけに残る別世代の正常復元候補も専用退避してから上書きする", () => {\n    const hiddenRecovery = [makeNote({ id: "hidden-recovery", title: "見えていない復元候補" })];\n    const forced = [makeNote({ id: "forced", title: "この画面を確定" })];\n    const corruptRaw = "{ broken primary before force";\n    storage.setItem(STORAGE_KEY_FOR_TESTING, corruptRaw);\n    storage.setItem(BACKUP_KEY_FOR_TESTING, JSON.stringify(hiddenRecovery));\n\n    const result = saveNotes(forced, { force: true });\n\n    expect(result).toEqual({ ok: true });\n    expect(JSON.parse(storage._store[RECOVERY_CONFLICT_BACKUP_KEY_FOR_TESTING]) as Note[]).toEqual(hiddenRecovery);\n    expect(JSON.parse(storage._store[BACKUP_KEY_FOR_TESTING]) as Note[]).toEqual(forced);\n    expect(JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[]).toEqual(forced);\n    expect(storage._store[CORRUPT_BACKUP_KEY_FOR_TESTING]).toBe(corruptRaw);\n  });\n\n  it("force 保存で hidden recovery backup の退避に失敗したら元候補とprimaryを上書きしない", () => {\n    const hiddenRecovery = [makeNote({ id: "hidden-recovery", title: "守る復元候補" })];\n    const forced = [makeNote({ id: "forced", title: "この画面" })];\n    const hiddenRaw = JSON.stringify(hiddenRecovery);\n    const corruptRaw = "{ broken primary before failed force";\n    storage.setItem(STORAGE_KEY_FOR_TESTING, corruptRaw);\n    storage.setItem(BACKUP_KEY_FOR_TESTING, hiddenRaw);\n\n    storage.setItem.mockImplementation((key: string, value: string) => {\n      if (key === RECOVERY_CONFLICT_BACKUP_KEY_FOR_TESTING) {\n        throw new DOMException("quota", "QuotaExceededError");\n      }\n      storage._store[key] = value;\n    });\n\n    const result = saveNotes(forced, { force: true });\n\n    expect(result).toEqual({ ok: false, reason: "quota" });\n    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBe(corruptRaw);\n    expect(storage._store[BACKUP_KEY_FOR_TESTING]).toBe(hiddenRaw);\n    expect(storage._store[PENDING_SAVE_KEY_FOR_TESTING]).toBeUndefined();\n  });\n\n'''
if t.count(marker) != 1:
    raise SystemExit(f"force test marker: expected 1, found {t.count(marker)}")
test.write_text(t.replace(marker, extra + marker, 1))
