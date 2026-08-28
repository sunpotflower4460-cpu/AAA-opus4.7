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
  NATIVE_SNAPSHOT_PATHS_FOR_TESTING,
  readNativeDurableSnapshot,
  resetNativeDurableSnapshotQueueForTesting,
} from "../nativeDurableSnapshot";

const FILE_NOT_FOUND = { code: "OS-PLUG-FILE-0008" };
const IO_ERROR = { code: "OS-PLUG-FILE-0013" };

function makeNote(title: string): Note {
  return {
    id: "secondary",
    title,
    body: "本文",
    createdAt: "2026-08-28T00:00:00.000Z",
    updatedAt: "2026-08-28T00:01:00.000Z",
    isFavorite: false,
    locale: "ja",
  };
}

describe("native durable snapshot secondary recovery", () => {
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
  });

  it("primaryとbackupが壊れていても正常secondaryを復元候補として返す", async () => {
    const secondary = [makeNote("secondary recovery")];
    files.set(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary, "{broken-primary");
    files.set(NATIVE_SNAPSHOT_PATHS_FOR_TESTING.backup, "{broken-backup");
    files.set(
      NATIVE_SNAPSHOT_PATHS_FOR_TESTING.secondaryBackup,
      JSON.stringify(secondary),
    );

    expect(await readNativeDurableSnapshot()).toEqual({
      status: "available",
      notes: secondary,
    });
  });

  it("primaryがI/O失敗なら正常secondaryがあっても安全確認未完了としてerrorにする", async () => {
    const secondary = [makeNote("secondary after io error")];
    files.set(
      NATIVE_SNAPSHOT_PATHS_FOR_TESTING.secondaryBackup,
      JSON.stringify(secondary),
    );
    mocks.readFile.mockImplementation(async ({ path }: { path: string }) => {
      if (
        path === NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary ||
        path === NATIVE_SNAPSHOT_PATHS_FOR_TESTING.backup
      ) {
        throw IO_ERROR;
      }
      const data = files.get(path);
      if (data === undefined) throw FILE_NOT_FOUND;
      return { data };
    });

    expect(await readNativeDurableSnapshot()).toEqual({ status: "error" });
    expect(mocks.readFile).toHaveBeenCalledTimes(1);
  });

  it("primary不存在でもbackupがI/O失敗なら正常secondaryへ降りずerrorにする", async () => {
    const secondary = [makeNote("secondary behind unreadable backup")];
    files.set(
      NATIVE_SNAPSHOT_PATHS_FOR_TESTING.secondaryBackup,
      JSON.stringify(secondary),
    );
    mocks.readFile.mockImplementation(async ({ path }: { path: string }) => {
      if (path === NATIVE_SNAPSHOT_PATHS_FOR_TESTING.primary) throw FILE_NOT_FOUND;
      if (path === NATIVE_SNAPSHOT_PATHS_FOR_TESTING.backup) throw IO_ERROR;
      const data = files.get(path);
      if (data === undefined) throw FILE_NOT_FOUND;
      return { data };
    });

    expect(await readNativeDurableSnapshot()).toEqual({ status: "error" });
    expect(mocks.readFile).toHaveBeenCalledTimes(2);
  });

  it("primaryとbackup不存在でもsecondary読込失敗はfresh install扱いしない", async () => {
    mocks.readFile.mockImplementation(async ({ path }: { path: string }) => {
      if (path === NATIVE_SNAPSHOT_PATHS_FOR_TESTING.secondaryBackup) {
        throw IO_ERROR;
      }
      throw FILE_NOT_FOUND;
    });

    expect(await readNativeDurableSnapshot()).toEqual({ status: "error" });
  });

  it("primary・backup・secondaryがすべて不存在の時だけmissingを返す", async () => {
    expect(await readNativeDurableSnapshot()).toEqual({ status: "missing" });
  });
});
