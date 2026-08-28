import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import type { Note } from "../types/note";
import { parseValidNotesSnapshot } from "./storage";

const PRIMARY_PATH = "zanshin/notes.snapshot.v1.json";
const BACKUP_PATH = "zanshin/notes.snapshot.backup.v1.json";
const SECONDARY_BACKUP_PATH = "zanshin/notes.snapshot.backup.secondary.v1.json";
const CORRUPT_PATH = "zanshin/notes.snapshot.corrupt.v1.json";
const DIRECTORY = Directory.LibraryNoCloud;
const FILE_NOT_FOUND_CODE = "OS-PLUG-FILE-0008";

let writeChain: Promise<void> = Promise.resolve();

type NativeReadResult =
  | { status: "ok"; raw: string }
  | { status: "missing" }
  | { status: "error" };

export type NativeDurableSnapshotReadResult =
  | { status: "available"; notes: Note[] }
  | { status: "missing" }
  | { status: "error" };

export function isNativeDurableSnapshotAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

function nativeErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

async function readRaw(path: string): Promise<NativeReadResult> {
  try {
    const result = await Filesystem.readFile({
      path,
      directory: DIRECTORY,
      encoding: Encoding.UTF8,
    });
    return typeof result.data === "string"
      ? { status: "ok", raw: result.data }
      : { status: "error" };
  } catch (error) {
    return nativeErrorCode(error) === FILE_NOT_FOUND_CODE
      ? { status: "missing" }
      : { status: "error" };
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
  const current = await readRaw(PRIMARY_PATH);

  // 「存在しない」と「読めない」を混同しない。読込障害時にprimaryへ触ると、
  // 既存の正常世代をbackupへ確定できないまま上書きする恐れがあるため中止する。
  if (current.status === "error") {
    throw new Error("native snapshot primary read failed");
  }

  if (current.status === "ok") {
    if (current.raw === nextRaw) return;

    if (parseValidNotesSnapshot(current.raw) !== null) {
      // 新しい primary に触る前に、直前の正常世代を確定する。
      // 既存 backup に別の正常世代がある場合は secondary へ退避し、
      // 未確認の世代を rotation だけで黙って消さない。
      const existingBackup = await readRaw(BACKUP_PATH);
      if (existingBackup.status === "error") {
        throw new Error("native snapshot backup read failed");
      }

      if (
        existingBackup.status === "ok" &&
        existingBackup.raw !== current.raw &&
        existingBackup.raw !== nextRaw &&
        parseValidNotesSnapshot(existingBackup.raw) !== null
      ) {
        const secondaryBackup = await readRaw(SECONDARY_BACKUP_PATH);
        if (secondaryBackup.status === "error") {
          throw new Error("native snapshot secondary backup read failed");
        }

        if (secondaryBackup.status === "ok") {
          const secondaryIsValid = parseValidNotesSnapshot(secondaryBackup.raw) !== null;
          const secondaryAlreadyPreservesOldBackup =
            secondaryIsValid && secondaryBackup.raw === existingBackup.raw;
          const secondaryCanBeReplaced =
            !secondaryIsValid ||
            secondaryBackup.raw === current.raw ||
            secondaryBackup.raw === nextRaw;

          if (!secondaryAlreadyPreservesOldBackup && !secondaryCanBeReplaced) {
            // primary / backup / secondary に3つの異なる正常世代がある。
            // 4つ目への更新でどれかを捨てるより、保存を止めて既存世代を守る。
            throw new Error("native snapshot recovery archive full");
          }

          if (!secondaryAlreadyPreservesOldBackup) {
            await writeRaw(SECONDARY_BACKUP_PATH, existingBackup.raw);
          }
        } else {
          await writeRaw(SECONDARY_BACKUP_PATH, existingBackup.raw);
        }
      } else if (
        existingBackup.status === "ok" &&
        parseValidNotesSnapshot(existingBackup.raw) === null
      ) {
        // 壊れた backup は診断余地だけ best-effort で残し、正常 current の確定を優先する。
        try {
          await writeRaw(CORRUPT_PATH, existingBackup.raw);
        } catch {
          // best effort
        }
      }

      // secondary 退避が必要なら完了した後で初めて backup を更新する。
      // ここが失敗した場合も current primary はまだ旧正本のまま残る。
      await writeRaw(BACKUP_PATH, current.raw);
    } else {
      // 破損した native snapshot も診断・救済余地を残すが、退避失敗は新版保存を妨げない。
      try {
        await writeRaw(CORRUPT_PATH, current.raw);
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

/**
 * localStorage 消失/破損時の native 復元候補を読む。
 * `missing` と I/O 失敗を区別し、読み取り不能を「新規インストール」と誤認させない。
 */
export async function readNativeDurableSnapshot(): Promise<NativeDurableSnapshotReadResult> {
  if (!isNativeDurableSnapshotAvailable()) return { status: "missing" };

  await writeChain.catch(() => {});

  const primary = await readRaw(PRIMARY_PATH);
  if (primary.status === "ok") {
    const parsedPrimary = parseValidNotesSnapshot(primary.raw);
    if (parsedPrimary !== null) return { status: "available", notes: parsedPrimary };
  }

  // primary が missing / corrupt / read error の場合でも backup は独立に読める可能性がある。
  // ただし両方から正常候補を得られなければ、read error / corrupt の痕跡は error として保持する。
  const backup = await readRaw(BACKUP_PATH);
  if (backup.status === "ok") {
    const parsedBackup = parseValidNotesSnapshot(backup.raw);
    if (parsedBackup !== null) return { status: "available", notes: parsedBackup };
    return { status: "error" };
  }

  if (primary.status === "error" || backup.status === "error") {
    return { status: "error" };
  }

  // primary が読めたが構造破損していたのに backup が無い場合も、fresh install ではない。
  if (primary.status === "ok") return { status: "error" };

  return { status: "missing" };
}

export function resetNativeDurableSnapshotQueueForTesting(): void {
  writeChain = Promise.resolve();
}

export const NATIVE_SNAPSHOT_PATHS_FOR_TESTING = {
  primary: PRIMARY_PATH,
  backup: BACKUP_PATH,
  secondaryBackup: SECONDARY_BACKUP_PATH,
  corrupt: CORRUPT_PATH,
} as const;
