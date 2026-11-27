import { dataWriteAllowed } from "../lib/dataEpoch";
import type { Note } from "../types/note";
import { emptyLibrary, type Library } from "./model";
import { validLibrary } from "./validation";

const DB_NAME = "zanshin.tsuzuri.v1";
const RECORDS = "records";

export type RestoreJournal = {
  id: string;
  baseNotes: Note[];
  nextNotes: Note[];
  bookIds: string[];
  draftIds: string[];
};

type Records = {
  current?: Library; previous?: Library; mirrored?: string; restore?: RestoreJournal;
  displaced?: unknown[];
};

export class LibraryError extends Error {
  constructor(readonly reason: "conflict" | "invalidLibrary" | "blocked" | "unavailable") {
    super(reason);
  }
}

export function stamp(library: Library): string {
  return `${library.libraryId}:${library.storeRevision}`;
}

export function sameLibrary(a: Library, b: Library): boolean {
  return stamp(a) === stamp(b) && JSON.stringify(a) === JSON.stringify(b);
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(RECORDS);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new LibraryError("blocked"));
    request.onsuccess = () => resolve(request.result);
  });
}

async function access<T>(
  mode: IDBTransactionMode,
  change: (records: Records, store: IDBObjectStore) => T,
): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(RECORDS, mode);
      const store = transaction.objectStore(RECORDS);
      const request = store.get("library");
      let result: T;
      let failure: unknown;
      request.onsuccess = () => {
        try {
          result = change(request.result ?? {}, store);
        } catch (error) {
          failure = error;
          transaction.abort();
        }
      };
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = () => reject(failure ?? transaction.error ?? new LibraryError("unavailable"));
    });
  } finally {
    db.close();
  }
}

export async function readLibraryRecords() {
  return access("readonly", (records) => records);
}

export type LibraryRead =
  | { kind: "ready"; library: Library; stored?: Library; restore?: RestoreJournal }
  | { kind: "damaged"; raw: unknown; previous?: Library };

export async function readLibrary(): Promise<LibraryRead> {
  const { current, previous, restore } = await readLibraryRecords();
  if (current === undefined || validLibrary(current)) {
    return { kind: "ready", library: current ?? emptyLibrary(), stored: current, restore };
  }
  return { kind: "damaged", raw: current, previous: validLibrary(previous) ? previous : undefined };
}

export async function writeLibrary(
  expected: Library,
  library: Library,
  epoch: string | null,
  journal?: RestoreJournal,
  expectedJournalId?: string,
) {
  if (!validLibrary(library)) throw new LibraryError("invalidLibrary");
  return access("readwrite", (records, store) => {
    if (!dataWriteAllowed(epoch) || records.restore?.id !== expectedJournalId) throw new LibraryError("blocked");
    if (records.current ? !sameLibrary(records.current, expected) : expected.storeRevision !== 0) {
      throw new LibraryError("conflict");
    }
    const current = { ...library, libraryId: expected.libraryId, storeRevision: expected.storeRevision + 1 };
    store.put({ ...records, current, previous: records.current, restore: journal }, "library");
    return current;
  });
}

export async function confirmLibraryMirror(library: Library, epoch: string | null) {
  return access("readwrite", (records, store) => {
    if (!dataWriteAllowed(epoch) || !records.current || !sameLibrary(records.current, library)) return false;
    store.put({ ...records, mirrored: stamp(library) }, "library");
    return true;
  });
}

export async function adoptLibraryCandidate(candidate: Library, expected: unknown, epoch: string | null, alternative?: Library) {
  if (!validLibrary(candidate)) throw new LibraryError("invalidLibrary");
  return access("readwrite", (records, store) => {
    if (!dataWriteAllowed(epoch) || records.restore) throw new LibraryError("blocked");
    if (JSON.stringify(records.current) !== JSON.stringify(expected)) throw new LibraryError("conflict");
    // Keep displaced copies even after a later explicit recovery.
    const displaced = [...records.displaced ?? []];
    for (const value of [records.current, alternative]) {
      if (value !== undefined && JSON.stringify(value) !== JSON.stringify(candidate) && !displaced.some((item) => JSON.stringify(item) === JSON.stringify(value))) {
        displaced.push(value);
      }
    }
    store.put({ current: candidate, mirrored: stamp(candidate), displaced }, "library");
    return candidate;
  });
}

export async function finishJournal(id: string, epoch: string | null) {
  return access("readwrite", (records, store) => {
    if (!dataWriteAllowed(epoch) || records.restore?.id !== id) throw new LibraryError("conflict");
    store.put({ ...records, restore: undefined }, "library");
  });
}

/** A replacement cannot commit while the synchronous note write is using this plan. */
export function withRestoreJournal<T>(
  id: string,
  epoch: string | null,
  apply: (journal: RestoreJournal, library: Library) => T,
): Promise<T> {
  return access("readonly", ({ restore, current }) => {
    if (!dataWriteAllowed(epoch) || restore?.id !== id || !validLibrary(current)) {
      throw new Error("restoreIncomplete");
    }
    return apply(restore, current);
  });
}

export async function eraseLibrary() {
  await access("readwrite", (_records, store) => store.clear());
  const records = await readLibraryRecords();
  if (Object.keys(records).length !== 0) throw new Error("libraryErase");
}
