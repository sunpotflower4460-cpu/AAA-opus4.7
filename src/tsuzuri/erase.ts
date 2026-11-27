import { markDataErase, readDataEpoch } from "../lib/dataEpoch";
import { eraseNativeNoteData } from "../lib/nativeDurableSnapshot";
import { eraseLocalNoteData } from "../lib/storage";
import { drainExports } from "./exportFile";
import { newId } from "./model";
import { clearNativeEraseMarker, eraseNativeBooksAndExports, readEraseMarker } from "./nativeFiles";
import { eraseLibrary } from "./repository";

let active: Promise<void> | null = null;

export function eraseAllData(receivedId?: string): Promise<void> {
  if (active) return active;
  const id = receivedId ?? newId();
  markDataErase(id, true);
  active = (async () => {
    await drainExports();
    await eraseNativeBooksAndExports(id);
    await eraseNativeNoteData();
    await eraseLibrary();
    eraseLocalNoteData();
    await clearNativeEraseMarker();
    markDataErase(id, false);
  })().finally(() => {
    active = null;
  });
  return active;
}

export async function resumeInterruptedErase(): Promise<void> {
  let local;
  try {
    local = readDataEpoch();
  } catch {
    // W1 still handles unavailable browser storage in the usual interface.
    local = { id: null, erasing: false };
  }
  const native = await readEraseMarker();
  if (native || local.erasing) await eraseAllData(native ?? local.id ?? undefined);
}
