import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { dataWriteAllowed } from "../lib/dataEpoch";
import type { Library } from "./model";
import { confirmLibraryMirror, readLibraryRecords, sameLibrary, stamp } from "./repository";
import { validLibrary } from "./validation";

const DIRECTORY = Directory.LibraryNoCloud;
const CURRENT = "zanshin/books.snapshot.v1.json";
const PREVIOUS = "zanshin/books.snapshot.previous.v1.json";
const DAMAGED = "zanshin/books.snapshot.damaged.v1.json";
const ERASE = "zanshin/erase.pending.v1";
export const EXPORT_DIRECTORY = "zanshin-exports";
let pending: Promise<unknown> = Promise.resolve();

function missing(error: unknown): boolean {
  return !!error && typeof error === "object" && "code" in error && error.code === "OS-PLUG-FILE-0008";
}

async function read(path: string) {
  try {
    const file = await Filesystem.readFile({ path, directory: DIRECTORY, encoding: Encoding.UTF8 });
    if (typeof file.data !== "string") throw new Error("nativeRead");
    return file.data;
  } catch (error) {
    if (missing(error)) return null;
    throw error;
  }
}

async function write(path: string, data: string) {
  await Filesystem.writeFile({ path, data, directory: DIRECTORY, encoding: Encoding.UTF8, recursive: true });
}

async function remove(path: string) {
  try {
    await Filesystem.deleteFile({ path, directory: DIRECTORY });
  } catch (error) {
    if (!missing(error)) throw error;
  }
  if (await read(path) !== null) throw new Error("nativeErase");
}

function decode(raw: string | null): Library | null {
  if (raw === null) return null;
  const saved: unknown = JSON.parse(raw);
  if (!validLibrary(saved)) throw new Error("invalidLibrary");
  return saved;
}

export async function nativeLibraryCheck(current: Library, installed: boolean) {
  if (!Capacitor.isNativePlatform()) return null;
  await pending;
  const actual = await read(CURRENT);
  let prior: Library | null;
  try {
    prior = decode(actual);
  } catch {
    const previous = decode(await read(PREVIOUS));
    if (previous) return previous;
    throw new Error("invalidLibrary");
  }
  if (!prior) {
    const previous = decode(await read(PREVIOUS));
    if (previous && (!installed || !sameLibrary(current, previous))) return previous;
    if (installed && !await mirrorLibrary(current, undefined, true)) throw new Error("nativeBackupFailed");
    return null;
  }
  if (!installed) return prior;
  if (sameLibrary(current, prior)) return null;
  const { mirrored, previous } = await readLibraryRecords();
  const knownPrevious = mirrored === stamp(prior) || (previous && sameLibrary(previous, prior));
  if (prior.libraryId !== current.libraryId || prior.storeRevision >= current.storeRevision || !knownPrevious) return prior;
  if (!await mirrorLibrary(current, undefined, false)) throw new Error("nativeBackupFailed");
  return null;
}

export function mirrorLibrary(library: Library, epoch?: string | null, allowMissing = true): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve(true);
  const operation = pending.then(async () => {
    if (!dataWriteAllowed(epoch)) return false;
    const records = await readLibraryRecords();
    if (!records.current || !sameLibrary(records.current, library)) return false;
    const raw = await read(CURRENT);
    let current: Library | null;
    try {
      current = decode(raw);
    } catch {
      // After explicit adoption, preserve the unreadable bytes in the existing previous file.
      if (records.mirrored !== stamp(library)) return false;
      current = null;
    }
    if (current && sameLibrary(current, library)) {
      if (epoch !== undefined) await confirmLibraryMirror(library, epoch);
      return true;
    }
    const expresslyAdopted = records.mirrored === stamp(library);
    if (current && !expresslyAdopted &&
      (current.libraryId !== library.libraryId || current.storeRevision >= library.storeRevision ||
      (stamp(current) !== records.mirrored && (!records.previous || !sameLibrary(current, records.previous))))) return false;
    if (!current && !allowMissing) return false;
    if (raw !== null) {
      // Preserve the previous generation or the original unreadable bytes.
      if (current) await write(PREVIOUS, raw);
      else {
        const saved = await read(DAMAGED);
        const copies: string[] = saved === null ? [] : JSON.parse(saved);
        if (!copies.includes(raw)) await write(DAMAGED, JSON.stringify([...copies, raw]));
      }
    }
    await write(CURRENT, JSON.stringify(library));
    if (epoch !== undefined) await confirmLibraryMirror(library, epoch);
    return true;
  });
  pending = operation.catch(() => {});
  return operation.catch(() => false);
}

export async function readNativeBookRecoveryCopies(): Promise<string | null> {
  return Capacitor.isNativePlatform() ? read(DAMAGED) : null;
}

export async function readEraseMarker(): Promise<string | null> {
  return Capacitor.isNativePlatform() ? read(ERASE) : null;
}

export async function markNativeErase(id: string): Promise<void> {
  if (Capacitor.isNativePlatform()) await write(ERASE, id);
}

export async function eraseNativeBooksAndExports() {
  if (!Capacitor.isNativePlatform()) return;
  await pending;
  await remove(CURRENT);
  await remove(PREVIOUS);
  await remove(DAMAGED);
  try {
    await Filesystem.rmdir({ path: EXPORT_DIRECTORY, directory: Directory.Cache, recursive: true });
  } catch (error) {
    if (!missing(error)) throw error;
  }
}

export async function clearNativeEraseMarker(): Promise<void> {
  if (Capacitor.isNativePlatform()) await remove(ERASE);
}
