from pathlib import Path

source = Path("src/lib/nativeDurableSnapshot.ts")
text = source.read_text()

old = '''const PRIMARY_PATH = "zanshin/notes.snapshot.v1.json";\nconst BACKUP_PATH = "zanshin/notes.snapshot.backup.v1.json";\nconst CORRUPT_PATH = "zanshin/notes.snapshot.corrupt.v1.json";'''
new = '''const PRIMARY_PATH = "zanshin/notes.snapshot.v1.json";\nconst BACKUP_PATH = "zanshin/notes.snapshot.backup.v1.json";\nconst SECONDARY_BACKUP_PATH = "zanshin/notes.snapshot.backup.secondary.v1.json";\nconst CORRUPT_PATH = "zanshin/notes.snapshot.corrupt.v1.json";'''
if text.count(old) != 1:
    raise SystemExit(f"path marker: {text.count(old)}")
text = text.replace(old, new, 1)

old = '''    if (parseValidNotesSnapshot(current.raw) !== null) {\n      // 新しい primary に触る前に、直前の正常世代を確定する。\n      // ここが失敗した場合は current primary を残し、新版へ進まない。\n      await writeRaw(BACKUP_PATH, current.raw);\n    } else {'''
new = '''    if (parseValidNotesSnapshot(current.raw) !== null) {\n      // 新しい primary に触る前に、直前の正常世代を確定する。\n      // 既存 backup に別の正常世代がある場合は secondary へ退避し、\n      // 未確認の世代を rotation だけで黙って消さない。\n      const existingBackup = await readRaw(BACKUP_PATH);\n      if (existingBackup.status === "error") {\n        throw new Error("native snapshot backup read failed");\n      }\n\n      if (\n        existingBackup.status === "ok" &&\n        existingBackup.raw !== current.raw &&\n        existingBackup.raw !== nextRaw &&\n        parseValidNotesSnapshot(existingBackup.raw) !== null\n      ) {\n        const secondaryBackup = await readRaw(SECONDARY_BACKUP_PATH);\n        if (secondaryBackup.status === "error") {\n          throw new Error("native snapshot secondary backup read failed");\n        }\n\n        if (secondaryBackup.status === "ok") {\n          const secondaryIsValid = parseValidNotesSnapshot(secondaryBackup.raw) !== null;\n          const secondaryAlreadyPreservesOldBackup =\n            secondaryIsValid && secondaryBackup.raw === existingBackup.raw;\n          const secondaryCanBeReplaced =\n            !secondaryIsValid ||\n            secondaryBackup.raw === current.raw ||\n            secondaryBackup.raw === nextRaw;\n\n          if (!secondaryAlreadyPreservesOldBackup && !secondaryCanBeReplaced) {\n            // primary / backup / secondary に3つの異なる正常世代がある。\n            // 4つ目への更新でどれかを捨てるより、保存を止めて既存世代を守る。\n            throw new Error("native snapshot recovery archive full");\n          }\n\n          if (!secondaryAlreadyPreservesOldBackup) {\n            await writeRaw(SECONDARY_BACKUP_PATH, existingBackup.raw);\n          }\n        } else {\n          await writeRaw(SECONDARY_BACKUP_PATH, existingBackup.raw);\n        }\n      } else if (\n        existingBackup.status === "ok" &&\n        parseValidNotesSnapshot(existingBackup.raw) === null\n      ) {\n        // 壊れた backup は診断余地だけ best-effort で残し、正常 current の確定を優先する。\n        try {\n          await writeRaw(CORRUPT_PATH, existingBackup.raw);\n        } catch {\n          // best effort\n        }\n      }\n\n      // secondary 退避が必要なら完了した後で初めて backup を更新する。\n      // ここが失敗した場合も current primary はまだ旧正本のまま残る。\n      await writeRaw(BACKUP_PATH, current.raw);\n    } else {'''
if text.count(old) != 1:
    raise SystemExit(f"rotation block marker: {text.count(old)}")
text = text.replace(old, new, 1)

old = '''  backup: BACKUP_PATH,\n  corrupt: CORRUPT_PATH,'''
new = '''  backup: BACKUP_PATH,\n  secondaryBackup: SECONDARY_BACKUP_PATH,\n  corrupt: CORRUPT_PATH,'''
if text.count(old) != 1:
    raise SystemExit(f"testing paths marker: {text.count(old)}")
text = text.replace(old, new, 1)
source.write_text(text)

test = Path("src/lib/__tests__/nativeDurableSnapshot.test.ts")
t = test.read_text()
marker = '''  it("同一snapshotならfilesystem書込を行わない", async () => {'''
extra = r'''  it("既存backupが別の正常世代ならsecondaryへ残してからrotationする", async () => {
    const current = [makeNote("current", 2)];
    const olderBackup = [makeNote("older-backup", 1)];
    const next = [makeNote("next", 3)];
    files.set(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary, JSON.stringify(current));
    files.set(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.backup, JSON.stringify(olderBackup));

    expect(await persistNativeDurableSnapshot(next)).toBe(true);
    expect(files.get(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary)).toBe(JSON.stringify(next));
    expect(files.get(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.backup)).toBe(JSON.stringify(current));
    expect(files.get(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.secondaryBackup)).toBe(
      JSON.stringify(olderBackup),
    );
  });

  it("nativeの3世代archiveが別々に埋まっていれば4世代目を捨てず保存を中止する", async () => {
    const current = [makeNote("current", 3)];
    const backup = [makeNote("backup", 2)];
    const secondary = [makeNote("secondary", 1)];
    const next = [makeNote("next", 4)];
    const currentRaw = JSON.stringify(current);
    const backupRaw = JSON.stringify(backup);
    const secondaryRaw = JSON.stringify(secondary);
    files.set(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary, currentRaw);
    files.set(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.backup, backupRaw);
    files.set(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.secondaryBackup, secondaryRaw);

    expect(await persistNativeDurableSnapshot(next)).toBe(false);
    expect(files.get(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary)).toBe(currentRaw);
    expect(files.get(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.backup)).toBe(backupRaw);
    expect(files.get(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.secondaryBackup)).toBe(secondaryRaw);
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });

  it("既存backupを読めない時は世代を上書きせずnative保存を中止する", async () => {
    const current = [makeNote("current", 1)];
    const next = [makeNote("next", 2)];
    const currentRaw = JSON.stringify(current);
    files.set(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary, currentRaw);
    mocks.readFile.mockImplementation(async ({ path }: { path: string }) => {
      if (path === NATIVE_SNAPSHOT_PATHS_FOR_TESTING.backup) {
        throw { code: "OS-PLUG-FILE-0013" };
      }
      const data = files.get(path);
      if (data === undefined) throw FILE_NOT_FOUND;
      return { data };
    });

    expect(await persistNativeDurableSnapshot(next)).toBe(false);
    expect(files.get(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary)).toBe(currentRaw);
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });

  it("secondary backupを読めない時も既存backupを上書きせず保存を中止する", async () => {
    const current = [makeNote("current", 2)];
    const backup = [makeNote("backup", 1)];
    const next = [makeNote("next", 3)];
    const currentRaw = JSON.stringify(current);
    const backupRaw = JSON.stringify(backup);
    files.set(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary, currentRaw);
    files.set(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.backup, backupRaw);
    mocks.readFile.mockImplementation(async ({ path }: { path: string }) => {
      if (path === NATIVE_SNAPSHOT_PATHS_FOR_TESTING.secondaryBackup) {
        throw { code: "OS-PLUG-FILE-0013" };
      }
      const data = files.get(path);
      if (data === undefined) throw FILE_NOT_FOUND;
      return { data };
    });

    expect(await persistNativeDurableSnapshot(next)).toBe(false);
    expect(files.get(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary)).toBe(currentRaw);
    expect(files.get(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.backup)).toBe(backupRaw);
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });

'''
if t.count(marker) != 1:
    raise SystemExit(f"test insertion marker: {t.count(marker)}")
t = t.replace(marker, extra + marker, 1)
test.write_text(t)
