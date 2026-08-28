from pathlib import Path

source = Path("src/lib/nativeDurableSnapshot.ts")
text = source.read_text()
old = '''      // 新しい primary に触る前に、直前の正常世代を確定する。\n      // 既存 backup に別の正常世代がある場合は secondary へ退避し、\n      // 未確認の世代を rotation だけで黙って消さない。\n      const existingBackup = await readRaw(BACKUP_PATH);\n      if (existingBackup.status === "error") {\n        throw new Error("native snapshot backup read failed");\n      }\n\n      if (\n        existingBackup.status === "ok" &&\n        existingBackup.raw !== current.raw &&\n        existingBackup.raw !== nextRaw &&\n        parseValidNotesSnapshot(existingBackup.raw) !== null\n      ) {\n        const secondaryBackup = await readRaw(SECONDARY_BACKUP_PATH);\n        if (secondaryBackup.status === "error") {\n          throw new Error("native snapshot secondary backup read failed");\n        }\n\n        if (secondaryBackup.status === "ok") {\n          const secondaryIsValid = parseValidNotesSnapshot(secondaryBackup.raw) !== null;\n          const secondaryAlreadyPreservesOldBackup =\n            secondaryIsValid && secondaryBackup.raw === existingBackup.raw;\n          const secondaryCanBeReplaced =\n            !secondaryIsValid ||\n            secondaryBackup.raw === current.raw ||\n            secondaryBackup.raw === nextRaw;\n\n          if (!secondaryAlreadyPreservesOldBackup && !secondaryCanBeReplaced) {\n            // primary / backup / secondary に3つの異なる正常世代がある。\n            // 4つ目への更新でどれかを捨てるより、保存を止めて既存世代を守る。\n            throw new Error("native snapshot recovery archive full");\n          }\n\n          if (!secondaryAlreadyPreservesOldBackup) {\n            await writeRaw(SECONDARY_BACKUP_PATH, existingBackup.raw);\n          }\n        } else {\n          await writeRaw(SECONDARY_BACKUP_PATH, existingBackup.raw);\n        }\n      } else if (\n        existingBackup.status === "ok" &&\n        parseValidNotesSnapshot(existingBackup.raw) === null\n      ) {'''
new = '''      // native 層は primary / backup / secondary の「最新3世代ローリング」とする。\n      // recovery/conflict 中の自動保存は App 側で停止しているため、通常保存で最古secondaryを\n      // 永久保存し続ける必要はない。そうしないと4世代目から保存不能になる。\n      const existingBackup = await readRaw(BACKUP_PATH);\n      if (existingBackup.status === "error") {\n        throw new Error("native snapshot backup read failed");\n      }\n\n      if (\n        existingBackup.status === "ok" &&\n        existingBackup.raw !== current.raw &&\n        existingBackup.raw !== nextRaw &&\n        parseValidNotesSnapshot(existingBackup.raw) !== null\n      ) {\n        // backupを更新する前に旧backupをsecondaryへ確定する。\n        // secondary書込が失敗した場合はprimary/backupへ進まず、直前2世代をそのまま守る。\n        await writeRaw(SECONDARY_BACKUP_PATH, existingBackup.raw);\n      } else if (\n        existingBackup.status === "ok" &&\n        parseValidNotesSnapshot(existingBackup.raw) === null\n      ) {'''
if text.count(old) != 1:
    raise SystemExit(f"native rotation marker: {text.count(old)}")
source.write_text(text.replace(old, new, 1))

test = Path("src/lib/__tests__/nativeDurableSnapshot.test.ts")
t = test.read_text()
old_test = r'''  it("nativeの3世代archiveが別々に埋まっていれば4世代目を捨てず保存を中止する", async () => {
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
  });'''
new_test = r'''  it("3世代が埋まっていても4世代目をローリング保存して最新3世代を保つ", async () => {
    const current = [makeNote("current", 3)];
    const backup = [makeNote("backup", 2)];
    const secondary = [makeNote("secondary", 1)];
    const next = [makeNote("next", 4)];
    files.set(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary, JSON.stringify(current));
    files.set(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.backup, JSON.stringify(backup));
    files.set(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.secondaryBackup, JSON.stringify(secondary));

    expect(await persistNativeDurableSnapshot(next)).toBe(true);
    expect(files.get(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary)).toBe(JSON.stringify(next));
    expect(files.get(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.backup)).toBe(JSON.stringify(current));
    expect(files.get(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.secondaryBackup)).toBe(
      JSON.stringify(backup),
    );
  });'''
if t.count(old_test) != 1:
    raise SystemExit(f"archive full test marker: {t.count(old_test)}")
t = t.replace(old_test, new_test, 1)

old_test = r'''  it("secondary backupを読めない時も既存backupを上書きせず保存を中止する", async () => {
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
  });'''
new_test = r'''  it("secondaryへの退避書込が失敗したらprimary/backupを進めず保存を中止する", async () => {
    const current = [makeNote("current", 2)];
    const backup = [makeNote("backup", 1)];
    const next = [makeNote("next", 3)];
    const currentRaw = JSON.stringify(current);
    const backupRaw = JSON.stringify(backup);
    files.set(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary, currentRaw);
    files.set(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.backup, backupRaw);
    mocks.writeFile.mockImplementation(async ({ path, data }: { path: string; data: string }) => {
      if (path === NATIVE_SNAPSHOT_PATHS_FOR_TESTING.secondaryBackup) {
        throw new Error("secondary write failure");
      }
      files.set(path, data);
      return { uri: path };
    });

    expect(await persistNativeDurableSnapshot(next)).toBe(false);
    expect(files.get(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary)).toBe(currentRaw);
    expect(files.get(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.backup)).toBe(backupRaw);
  });'''
if t.count(old_test) != 1:
    raise SystemExit(f"secondary failure test marker: {t.count(old_test)}")
t = t.replace(old_test, new_test, 1)
test.write_text(t)
