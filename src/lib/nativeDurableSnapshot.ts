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
      // native 層は primary / backup / secondary の「最新3世代ローリング」とする。
      // recovery/conflict 中の自動保存は App 側で停止しているため、通常保存で最古secondaryを
      // 永久保存し続ける必要はない。そうしないと4世代目から保存不能になる。
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
        // backupを更新する前に旧backupをsecondaryへ確定する。
        // secondary書込が失敗した場合はprimary/backupへ進まず、直前2世代をそのまま守る。
        await writeRaw(SECONDARY_BACKUP_PATH, existingBackup.raw);
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
  const backup = await readRaw(BACKUP_PATH);
  if (backup.status === "ok") {
    const parsedBackup = parseValidNotesSnapshot(backup.raw);
    if (parsedBackup !== null) return { status: "available", notes: parsedBackup };
  }

  // rotation で退避した secondary も実際の復元経路へ含める。
  // primary / backup の片方が I/O error や破損でも、secondary が正常なら読み取り専用候補として救済する。
  const secondaryBackup = await readRaw(SECONDARY_BACKUP_PATH);
  if (secondaryBackup.status === "ok") {
    const parsedSecondaryBackup = parseValidNotesSnapshot(secondaryBackup.raw);
    if (parsedSecondaryBackup !== null) {
      return { status: "available", notes: parsedSecondaryBackup };
    }
  }

  // 3層すべてから正常候補を得られなかった場合、I/O error または構造破損の痕跡が1つでもあれば
  // fresh install と誤認せず error を返す。
  if (
    primary.status === "error" ||
    backup.status === "error" ||
    secondaryBackup.status === "error"
  ) {
    return { status: "error" };
  }

  if (
    primary.status === "ok" ||
    backup.status === "ok" ||
    secondaryBackup.status === "ok"
  ) {
    return { status: "error" };
  }

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
