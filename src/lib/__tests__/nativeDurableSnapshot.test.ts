import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Note } from "../../types/note";

const mocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: mocks.isNativePlatform },
}));

vi.mock("@capacitor/filesystem", () => ({
  Directory: { LibraryNoCloud: "LIBRARY_NO_CLOUD" },
  Encoding: { UTF8: "utf8" },
  Filesystem: { readFile: mocks.readFile, writeFile: mocks.writeFile },
}));

import {
  isNativeDurableSnapshotAvailable,
  NATIVE_SNAPSHOT_PATHS_FOR_TESTING,
  persistNativeDurableSnapshot,
  readNativeDurableSnapshot,
  resetNativeDurableSnapshotQueueForTesting,
} from "../nativeDurableSnapshot";

const FILE_NOT_FOUND = { code: "OS-PLUG-FILE-0008" };

function makeNote(title: string, minute = 0): Note {
  return {
    id: "one",
    title,
    body: "本文",
    createdAt: "2026-08-28T00:00:00.000Z",
    updatedAt: `2026-08-28T00:${String(minute).padStart(2, "0")}:00.000Z`,
    isFavorite: false,
    locale: "ja",
  };
}

describe("native durable snapshot", () => {
  const files = new Map<string, string>();

  beforeEach(() => {
    files.clear();
    resetNativeDurableSnapshotQueueForTesting();
    mocks.isNativePlatform.mockReset();
    mocks.readFile.mockReset();
    mocks.writeFile.mockReset();
    mocks.isNativePlatform.mockReturnValue(true);
    mocks.readFile.mockImplementation(async ({ path }: { path: string }) => {
      const data = files.get(path);
      if (data === undefined) throw FILE_NOT_FOUND;
      return { data };
    });
    mocks.writeFile.mockImplementation(async ({ path, data }: { path: string; data: string }) => {
      files.set(path, data);
      return { uri: path };
    });
  });

  it("webではnative filesystemへ触れず成功扱い", async () => {
    mocks.isNativePlatform.mockReturnValue(false);
    expect(isNativeDurableSnapshotAvailable()).toBe(false);
    expect(await persistNativeDurableSnapshot([makeNote("web")])).toBe(true);
    expect(mocks.readFile).not.toHaveBeenCalled();
    expect(mocks.writeFile).not.toHaveBeenCalled();
    expect(await readNativeDurableSnapshot()).toBeNull();
  });

  it("初回はprimary snapshotを書き込む", async () => {
    expect(isNativeDurableSnapshotAvailable()).toBe(true);
    const notes = [makeNote("初回")];
    expect(await persistNativeDurableSnapshot(notes)).toBe(true);
    expect(files.get(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary)).toBe(JSON.stringify(notes));
  });

  it("更新時は旧primaryをbackupへ確定してから新版を書く", async () => {
    const oldNotes = [makeNote("旧版")];
    const newNotes = [makeNote("新版", 1)];
    files.set(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary, JSON.stringify(oldNotes));

    expect(await persistNativeDurableSnapshot(newNotes)).toBe(true);
    expect(files.get(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.backup)).toBe(JSON.stringify(oldNotes));
    expect(files.get(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary)).toBe(JSON.stringify(newNotes));
  });

  it("同一snapshotならfilesystem書込を行わない", async () => {
    const notes = [makeNote("同一")];
    files.set(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary, JSON.stringify(notes));
    expect(await persistNativeDurableSnapshot(notes)).toBe(true);
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });

  it("primary破損時は正常backupを復元候補として返す", async () => {
    const backup = [makeNote("backup")];
    files.set(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary, "{broken");
    files.set(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.backup, JSON.stringify(backup));
    expect(await readNativeDurableSnapshot()).toEqual(backup);
  });

  it("primary読込が一時失敗しても正常backupは読み取り専用の復元候補として返す", async () => {
    const backup = [makeNote("backup")];
    files.set(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.backup, JSON.stringify(backup));
    mocks.readFile.mockImplementation(async ({ path }: { path: string }) => {
      if (path === NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary) {
        throw { code: "OS-PLUG-FILE-0013" };
      }
      const data = files.get(path);
      if (data === undefined) throw FILE_NOT_FOUND;
      return { data };
    });

    expect(await readNativeDurableSnapshot()).toEqual(backup);
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });

  it("primary読込が不存在以外の理由で失敗したら既存世代へ触れず保存を中止する", async () => {
    const next = [makeNote("新版")];
    mocks.readFile.mockRejectedValue({ code: "OS-PLUG-FILE-0013" });

    expect(await persistNativeDurableSnapshot(next)).toBe(false);
    expect(mocks.writeFile).not.toHaveBeenCalled();
    expect(files.size).toBe(0);
  });

  it("不存在コードは初回保存として扱いprimaryを書ける", async () => {
    const notes = [makeNote("初回")];
    mocks.readFile.mockRejectedValue(FILE_NOT_FOUND);

    expect(await persistNativeDurableSnapshot(notes)).toBe(true);
    expect(mocks.writeFile).toHaveBeenCalledTimes(1);
    expect(files.get(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary)).toBe(JSON.stringify(notes));
  });

  it("新版primary書込失敗時も旧世代backupを残して失敗を返す", async () => {
    const oldNotes = [makeNote("旧版")];
    const newNotes = [makeNote("新版", 1)];
    files.set(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary, JSON.stringify(oldNotes));
    mocks.writeFile.mockImplementation(async ({ path, data }: { path: string; data: string }) => {
      if (path === NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary) throw new Error("disk failure");
      files.set(path, data);
      return { uri: path };
    });

    expect(await persistNativeDurableSnapshot(newNotes)).toBe(false);
    expect(files.get(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.backup)).toBe(JSON.stringify(oldNotes));
    expect(files.get(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary)).toBe(JSON.stringify(oldNotes));
  });

  it("非同期保存は呼出順に直列化され、旧版が新版を後から巻き戻さない", async () => {
    const first = [makeNote("first")];
    const second = [makeNote("second", 1)];
    let releaseFirst!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let markFirstPrimaryStarted!: () => void;
    const firstPrimaryStarted = new Promise<void>((resolve) => {
      markFirstPrimaryStarted = resolve;
    });
    let primaryWrites = 0;
    mocks.writeFile.mockImplementation(async ({ path, data }: { path: string; data: string }) => {
      if (path === NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary) {
        primaryWrites += 1;
        if (primaryWrites === 1) {
          markFirstPrimaryStarted();
          await gate;
        }
      }
      files.set(path, data);
      return { uri: path };
    });

    const firstSave = persistNativeDurableSnapshot(first);
    const secondSave = persistNativeDurableSnapshot(second);
    await firstPrimaryStarted;
    expect(primaryWrites).toBe(1);

    releaseFirst();
    expect(await firstSave).toBe(true);
    expect(await secondSave).toBe(true);
    expect(files.get(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary)).toBe(JSON.stringify(second));
  });
});
