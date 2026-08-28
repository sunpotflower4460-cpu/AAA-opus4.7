from pathlib import Path

storage = Path("src/lib/storage.ts")
text = storage.read_text()

old = '''const RECOVERY_CONFLICT_BACKUP_KEY = "zanshin.notes.recovery.conflict.backup.v1";\n// localStorage は複数キーを原子的に更新できないため、base -> next を記録して中断保存を判定する。'''
new = '''const RECOVERY_CONFLICT_BACKUP_KEY = "zanshin.notes.recovery.conflict.backup.v1";\n// recovery conflict backup 自体にも未確認世代が残っている場合、その既存世代をもう1段退避する。\nconst RECOVERY_CONFLICT_SECONDARY_BACKUP_KEY =\n  "zanshin.notes.recovery.conflict.secondary.backup.v1";\n// localStorage は複数キーを原子的に更新できないため、base -> next を記録して中断保存を判定する。'''
if text.count(old) != 1:
    raise SystemExit(f"recovery secondary constant marker: {text.count(old)}")
text = text.replace(old, new, 1)

old = '''      if (backupNotes) {\n        if (backupNotes.length === 0) return { ok: true, notes: [] };\n        return {\n          ok: false,\n          notes: backupNotes,\n          reason: "missing_primary",\n          recoveredFromBackup: true,\n          recoveryCandidate: true,\n        };\n      }'''
new = '''      if (backupNotes) {\n        // backup key が存在する時点で過去に保存済み状態があった。\n        // [] も「全削除を保存した」正当な世代なので fresh install と同一視しない。\n        return {\n          ok: false,\n          notes: backupNotes,\n          reason: "missing_primary",\n          recoveredFromBackup: true,\n          recoveryCandidate: true,\n        };\n      }'''
if text.count(old) != 1:
    raise SystemExit(f"empty backup recovery marker: {text.count(old)}")
text = text.replace(old, new, 1)

old = '''      // primary が壊れている/消えている時は BACKUP_KEY が唯一の正常候補になり得る。\n      // force-save で BACKUP_KEY を新版へ更新する前に、別世代なら専用退避へ確定する。\n      if (recoveryBackupCandidateRaw !== null) {\n        try {\n          window.localStorage.setItem(RECOVERY_CONFLICT_BACKUP_KEY, recoveryBackupCandidateRaw);\n        } catch (error) {\n          return saveFailureFromError(error);\n        }\n      }'''
new = '''      // primary が壊れている/消えている時は BACKUP_KEY が唯一の正常候補になり得る。\n      // force-save で BACKUP_KEY を新版へ更新する前に、別世代なら専用退避へ確定する。\n      if (recoveryBackupCandidateRaw !== null) {\n        try {\n          const existingRecoveryArchiveRaw = window.localStorage.getItem(\n            RECOVERY_CONFLICT_BACKUP_KEY,\n          );\n          let shouldWritePrimaryRecoveryArchive =\n            existingRecoveryArchiveRaw !== recoveryBackupCandidateRaw;\n\n          if (\n            existingRecoveryArchiveRaw !== null &&\n            existingRecoveryArchiveRaw !== recoveryBackupCandidateRaw &&\n            parseNotesRaw(existingRecoveryArchiveRaw).status === "valid"\n          ) {\n            const secondaryRecoveryArchiveRaw = window.localStorage.getItem(\n              RECOVERY_CONFLICT_SECONDARY_BACKUP_KEY,\n            );\n\n            if (secondaryRecoveryArchiveRaw === recoveryBackupCandidateRaw) {\n              // 新候補はすでにsecondaryに残っている。既存primary archiveを上書きしない。\n              shouldWritePrimaryRecoveryArchive = false;\n            } else if (\n              secondaryRecoveryArchiveRaw === null ||\n              secondaryRecoveryArchiveRaw === existingRecoveryArchiveRaw ||\n              parseNotesRaw(secondaryRecoveryArchiveRaw).status !== "valid"\n            ) {\n              // 既存の未確認archiveをsecondaryへ退避できてから、新候補をprimary archiveへ置く。\n              window.localStorage.setItem(\n                RECOVERY_CONFLICT_SECONDARY_BACKUP_KEY,\n                existingRecoveryArchiveRaw,\n              );\n            } else {\n              // primary/secondary archive の両方に別世代が残っている。\n              // 3世代目を落とさず、現在の BACKUP_KEY も残したまま force-save を止める。\n              return { ok: false, reason: "conflict" };\n            }\n          }\n\n          if (shouldWritePrimaryRecoveryArchive) {\n            window.localStorage.setItem(\n              RECOVERY_CONFLICT_BACKUP_KEY,\n              recoveryBackupCandidateRaw,\n            );\n          }\n        } catch (error) {\n          return saveFailureFromError(error);\n        }\n      }'''
if text.count(old) != 1:
    raise SystemExit(f"recovery archive force marker: {text.count(old)}")
text = text.replace(old, new, 1)

old = '''export const RECOVERY_CONFLICT_BACKUP_KEY_FOR_TESTING = RECOVERY_CONFLICT_BACKUP_KEY;\nexport const PENDING_SAVE_KEY_FOR_TESTING = PENDING_SAVE_KEY;'''
new = '''export const RECOVERY_CONFLICT_BACKUP_KEY_FOR_TESTING = RECOVERY_CONFLICT_BACKUP_KEY;\nexport const RECOVERY_CONFLICT_SECONDARY_BACKUP_KEY_FOR_TESTING =\n  RECOVERY_CONFLICT_SECONDARY_BACKUP_KEY;\nexport const PENDING_SAVE_KEY_FOR_TESTING = PENDING_SAVE_KEY;'''
if text.count(old) != 1:
    raise SystemExit(f"recovery secondary export marker: {text.count(old)}")
text = text.replace(old, new, 1)
storage.write_text(text)

storage_test = Path("src/lib/__tests__/storage.test.ts")
t = storage_test.read_text()
old = '''  RECOVERY_CONFLICT_BACKUP_KEY_FOR_TESTING,\n  PENDING_SAVE_KEY_FOR_TESTING,'''
new = '''  RECOVERY_CONFLICT_BACKUP_KEY_FOR_TESTING,\n  RECOVERY_CONFLICT_SECONDARY_BACKUP_KEY_FOR_TESTING,\n  PENDING_SAVE_KEY_FOR_TESTING,'''
if t.count(old) != 1:
    raise SystemExit(f"storage test import marker: {t.count(old)}")
t = t.replace(old, new, 1)

old = '''  it("primary が無くても backup が空なら初回状態として空配列を返す", () => {\n    storage.setItem(BACKUP_KEY_FOR_TESTING, JSON.stringify([]));\n\n    expect(loadNotes()).toEqual({ ok: true, notes: [] });\n  });'''
new = '''  it("primary が無く backup が空配列なら全削除済みの復元候補として返す", () => {\n    storage.setItem(BACKUP_KEY_FOR_TESTING, JSON.stringify([]));\n\n    const result = loadNotes();\n\n    expect(result.ok).toBe(false);\n    expect(result.notes).toEqual([]);\n    if (!result.ok) {\n      expect(result.reason).toBe("missing_primary");\n      expect(result.recoveredFromBackup).toBe(true);\n      expect(result.recoveryCandidate).toBe(true);\n    }\n  });'''
if t.count(old) != 1:
    raise SystemExit(f"empty backup test marker: {t.count(old)}")
t = t.replace(old, new, 1)

marker = '''  it("force 保存で hidden recovery backup の退避に失敗したら元候補とprimaryを上書きしない", () => {'''
extra = r'''  it("force 保存は既存のrecovery archiveをsecondaryへ残して新候補を退避する", () => {
    const olderArchive = [makeNote({ id: "older-archive", title: "先に退避済み" })];
    const hiddenRecovery = [makeNote({ id: "hidden-recovery", title: "今回の復元候補" })];
    const forced = [makeNote({ id: "forced", title: "この画面" })];
    const corruptRaw = "{ broken primary before second recovery force";
    storage.setItem(STORAGE_KEY_FOR_TESTING, corruptRaw);
    storage.setItem(BACKUP_KEY_FOR_TESTING, JSON.stringify(hiddenRecovery));
    storage.setItem(RECOVERY_CONFLICT_BACKUP_KEY_FOR_TESTING, JSON.stringify(olderArchive));

    const result = saveNotes(forced, { force: true });

    expect(result).toEqual({ ok: true });
    expect(
      JSON.parse(storage._store[RECOVERY_CONFLICT_BACKUP_KEY_FOR_TESTING]) as Note[],
    ).toEqual(hiddenRecovery);
    expect(
      JSON.parse(storage._store[RECOVERY_CONFLICT_SECONDARY_BACKUP_KEY_FOR_TESTING]) as Note[],
    ).toEqual(olderArchive);
    expect(JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[]).toEqual(forced);
  });

  it("recovery archiveが2枠とも別世代なら3世代目を捨てずforce保存を止める", () => {
    const archive1 = [makeNote({ id: "archive-1", title: "退避1" })];
    const archive2 = [makeNote({ id: "archive-2", title: "退避2" })];
    const hiddenRecovery = [makeNote({ id: "archive-3", title: "今回の復元候補" })];
    const forced = [makeNote({ id: "forced", title: "この画面" })];
    const corruptRaw = "{ broken primary before full archive force";
    const hiddenRaw = JSON.stringify(hiddenRecovery);
    const archive1Raw = JSON.stringify(archive1);
    const archive2Raw = JSON.stringify(archive2);
    storage.setItem(STORAGE_KEY_FOR_TESTING, corruptRaw);
    storage.setItem(BACKUP_KEY_FOR_TESTING, hiddenRaw);
    storage.setItem(RECOVERY_CONFLICT_BACKUP_KEY_FOR_TESTING, archive1Raw);
    storage.setItem(RECOVERY_CONFLICT_SECONDARY_BACKUP_KEY_FOR_TESTING, archive2Raw);

    const result = saveNotes(forced, { force: true });

    expect(result).toEqual({ ok: false, reason: "conflict" });
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBe(corruptRaw);
    expect(storage._store[BACKUP_KEY_FOR_TESTING]).toBe(hiddenRaw);
    expect(storage._store[RECOVERY_CONFLICT_BACKUP_KEY_FOR_TESTING]).toBe(archive1Raw);
    expect(storage._store[RECOVERY_CONFLICT_SECONDARY_BACKUP_KEY_FOR_TESTING]).toBe(archive2Raw);
    expect(storage._store[PENDING_SAVE_KEY_FOR_TESTING]).toBeUndefined();
  });

'''
if t.count(marker) != 1:
    raise SystemExit(f"recovery archive tests marker: {t.count(marker)}")
t = t.replace(marker, extra + marker, 1)
storage_test.write_text(t)

app_test = Path("src/__tests__/App.native-durable-snapshot.test.tsx")
a = app_test.read_text()
marker = '''  it("local復元候補があってもnativeを確認し、異なる別世代を隠さず明示的に切り替えられる", async () => {'''
extra = r'''  it("localの空backupも全削除済み候補としてnative別世代と切り替えて選べる", async () => {
    const nativeCandidate = [makeNote({ id: "native-existing", title: "nativeに残るメモ" })];
    storage._store[BACKUP_KEY_FOR_TESTING] = JSON.stringify([]);
    durable.read.mockResolvedValue({ status: "available", notes: nativeCandidate });

    renderApp();
    expect(container.querySelector('[data-testid="native-recovery-checking"]')).not.toBeNull();
    await flushPromises();

    expect(container.textContent).toContain(copy.storageRecoveryTitle);
    expect(container.textContent).not.toContain("nativeに残るメモ");
    expect(hasButton(container, copy.nativeRecoveryShowAlternative)).toBe(true);
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBeUndefined();

    act(() => click(findButton(container, copy.nativeRecoveryShowAlternative)));
    expect(container.textContent).toContain("nativeに残るメモ");
    expect(hasButton(container, copy.nativeRecoveryShowLocal)).toBe(true);

    act(() => click(findButton(container, copy.nativeRecoveryShowLocal)));
    expect(container.textContent).not.toContain("nativeに残るメモ");

    act(() => click(findButton(container, copy.storageRecoverySave)));
    await flushPromises();

    expect(JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[]).toEqual([]);
    expect(durable.persist).toHaveBeenCalledWith([]);
  });

'''
if a.count(marker) != 1:
    raise SystemExit(f"native empty local candidate test marker: {a.count(marker)}")
a = a.replace(marker, extra + marker, 1)
app_test.write_text(a)
