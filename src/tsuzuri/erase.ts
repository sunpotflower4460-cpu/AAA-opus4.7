import { markDataErase, readDataEpoch } from "../lib/dataEpoch";
import { eraseNativeNoteData } from "../lib/nativeDurableSnapshot";
import { eraseLocalNoteData } from "../lib/storage";
import { drainExports } from "./exportFile";
import { newId } from "./model";
import { clearNativeEraseMarker, eraseNativeBooksAndExports, markNativeErase, readEraseMarker } from "./nativeFiles";
import { eraseLibrary } from "./repository";

let active: Promise<void> | null = null;

export function eraseAllData(receivedId?: string): Promise<void> {
  if (active) return active;
  const id = receivedId ?? newId();
  markDataErase(id, true);
  active = (async () => {
    await markNativeErase(id);
    await drainExports();
    await eraseNativeBooksAndExports();
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

export async function resumeInterruptedErase(): Promise<boolean> {
  let local;
  try {
    local = readDataEpoch();
  } catch {
    // W1 still handles unavailable browser storage in the usual interface.
    local = { id: null, erasing: false };
  }
  const id = local.erasing ? local.id : await readEraseMarker();
  if (!id) return false;
  await eraseAllData(id);
  return true;
}
