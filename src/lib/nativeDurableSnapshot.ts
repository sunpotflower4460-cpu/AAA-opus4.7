import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import type { Note } from "../types/note";
import { parseValidNotesSnapshot } from "./storage";

const PRIMARY_PATH = "zanshin/notes.snapshot.v1.json";
const BACKUP_PATH = "zanshin/notes.snapshot.backup.v1.json";
const CORRUPT_PATH = "zanshin/notes.snapshot.corrupt.v1.json";
const DIRECTORY = Directory.LibraryNoCloud;

let writeChain: Promise<void> = Promise.resolve();

export function isNativeDurableSnapshotAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

async function readRaw(path: string): Promise<string | null> {
  try {
    const result = await Filesystem.readFile({ path, directory: DIRECTORY, encoding: Encoding.UTF8 });
    return typeof result.data === "string" ? result.data : null;
  } catch {
    return null;
  }
}

async function writeRaw(path: string, data: string): Promise<void> {
  await Filesystem.writeFile({
    path,
    data,
    directory: DIRECTORY,
    encoding: Encoding.UTF8,
    recursive: true,
  });
}

async function writeSnapshotRaw(nextRaw: string): Promise<void> {
  const currentRaw = await readRaw(PRIMARY_PATH);
  if (currentRaw === nextRaw) return;

  if (currentRaw !== null) {
    if (parseValidNotesSnapshot(currentRaw) !== null) {
      // 新しい primary に触る前に、直前の正常世代を確定する。
      // ここが失敗した場合は current primary を残し、新版へ進まない。
      await writeRaw(BACKUP_PATH, currentRaw);
    } else {
      // 破損した native snapshot も診断・救済余地を残すが、退避失敗は新版保存を妨げない。
      try {
        await writeRaw(CORRUPT_PATH, currentRaw);
      } catch {
        // best effort
      }
    }
  }

  await writeRaw(PRIMARY_PATH, nextRaw);
}

/**
 * localStorage の同期保存を置き換えず、native 側に耐久スナップショットを直列保存する。
 * 呼び出し順を Promise chain で固定し、古い非同期 write が新しい内容を後から巻き戻すのを防ぐ。
 */
export function persistNativeDurableSnapshot(notes: readonly Note[]): Promise<boolean> {
  if (!isNativeDurableSnapshotAvailable()) return Promise.resolve(true);

  let raw: string;
  try {
    raw = JSON.stringify(notes);
  } catch {
    return Promise.resolve(false);
  }
  if (parseValidNotesSnapshot(raw) === null) return Promise.resolve(false);

  const operation = writeChain
    .catch(() => {
      // 前回失敗が次回のretryを永久に止めないようchainだけ回復する。
    })
    .then(() => writeSnapshotRaw(raw));

  writeChain = operation.catch(() => {
    // 次回保存を継続可能にするため内部chainでは吸収する。
  });

  return operation.then(
    () => true,
    () => false,
  );
}

/** localStorage 消失/破損時の復元候補。primary が壊れていれば1世代前へフォールバックする。 */
export async function readNativeDurableSnapshot(): Promise<Note[] | null> {
  if (!isNativeDurableSnapshotAvailable()) return null;

  await writeChain.catch(() => {});

  const primaryRaw = await readRaw(PRIMARY_PATH);
  if (primaryRaw !== null) {
    const primary = parseValidNotesSnapshot(primaryRaw);
    if (primary !== null) return primary;
  }

  const backupRaw = await readRaw(BACKUP_PATH);
  return backupRaw === null ? null : parseValidNotesSnapshot(backupRaw);
}

export function resetNativeDurableSnapshotQueueForTesting(): void {
  writeChain = Promise.resolve();
}

export const NATIVE_SNAPSHOT_PATHS_FOR_TESTING = {
  primary: PRIMARY_PATH,
  backup: BACKUP_PATH,
  corrupt: CORRUPT_PATH,
} as const;
