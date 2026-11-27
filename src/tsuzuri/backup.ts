import { parseValidNotesSnapshot, saveNotes } from "../lib/storage";
import { persistNativeDurableSnapshot } from "../lib/nativeDurableSnapshot";
import type { Note } from "../types/note";
import { newId, type Library } from "./model";
import { mirrorLibrary } from "./nativeFiles";
import { finishJournal, withRestoreJournal, type RestoreJournal } from "./repository";
import { validLibrary } from "./validation";

export type Archive = {
  format: "zanshin.backup";
  schemaVersion: 1;
  exportedAt: string;
  notes: Note[];
  library: Library;
};

export function makeArchive(notes: Note[], library: Library): Archive {
  return { format: "zanshin.backup", schemaVersion: 1, exportedAt: new Date().toISOString(), notes, library };
}

export function readArchive(raw: string): Archive {
  let value: Partial<Archive> | null;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("invalidArchive");
  }
  if (value?.format !== "zanshin.backup") throw new Error("invalidArchive");
  if (value.schemaVersion !== 1) throw new Error("archiveVersion");
  const notes = parseValidNotesSnapshot(JSON.stringify(value.notes ?? null));
  if (!notes || !validLibrary(value.library) || typeof value.exportedAt !== "string" ||
    !Number.isFinite(Date.parse(value.exportedAt))) throw new Error("invalidArchive");
  return { format: value.format, schemaVersion: 1, exportedAt: value.exportedAt, notes, library: value.library };
}

export function planRestore(notes: Note[], library: Library, archive: Archive) {
  const locals = new Map(notes.map((note) => [note.id, note]));
  const noteIds = new Map<string, string>();
  const additions: Note[] = [];
  let conflicts = 0;
  for (const note of archive.notes) {
    const existing = locals.get(note.id);
    if (existing && JSON.stringify(existing) === JSON.stringify(note)) {
      noteIds.set(note.id, note.id);
      continue;
    }
    const id = existing ? newId() : note.id;
    if (existing) conflicts++;
    noteIds.set(note.id, id);
    additions.push({ ...note, id });
  }

  const duplicate = JSON.stringify({
    ...library, libraryId: "", storeRevision: 0,
  }) === JSON.stringify({ ...archive.library, libraryId: "", storeRevision: 0 });
  const incoming = archive.library;
  const reserve = (existing: readonly { id: string }[], imported: readonly { id: string }[]) => {
    const used = new Set(existing.map((item) => item.id));
    return new Map(imported.map((item) => {
      const collides = used.has(item.id);
      if (collides) conflicts++;
      return [item.id, collides ? newId() : item.id];
    }));
  };
  const linkNote = (localId: string | null) => localId === null ? null : noteIds.get(localId) ?? null;
  let merged = library;
  let importedBooks: string[] = [];
  let importedDrafts: string[] = [];
  if (!duplicate) {
    const bookIds = reserve(library.books, incoming.books);
    const editions = reserve(library.editions, incoming.editions);
    const snapshots = reserve(library.snapshots, incoming.snapshots);
    const draftIds = reserve(library.drafts, incoming.drafts);
    importedBooks = [...bookIds.values()];
    importedDrafts = [...draftIds.values()];
    const presetIds = reserve(library.presets, incoming.presets);
    const remap = (map: Map<string, string>, id: string | null) => id === null ? null : map.get(id)!;
    // Inline draft sources may already be referenced by imported editions.
    const draftSources = new Map<string, string>();
    merged = {
      ...library,
      books: [...library.books, ...incoming.books.map((item) => ({
        ...item, id: bookIds.get(item.id)!, editionId: editions.get(item.editionId)!,
      }))],
      editions: [...library.editions, ...incoming.editions.map((item) => ({
        ...item, id: editions.get(item.id)!, bookId: bookIds.get(item.bookId)!,
        passages: item.passages.map((piece) => ({
          ...piece, textSnapshotId: snapshots.get(piece.textSnapshotId)!,
          sourceBaseSnapshotId: remap(snapshots, piece.sourceBaseSnapshotId), localNoteId: linkNote(piece.localNoteId),
        })),
      }))],
      snapshots: [...library.snapshots, ...incoming.snapshots.map((item) => ({ ...item, id: snapshots.get(item.id)! }))],
      drafts: [...library.drafts, ...incoming.drafts.map((item) => ({
        ...item, id: draftIds.get(item.id)!, bookId: remap(bookIds, item.bookId), baseEditionId: remap(editions, item.baseEditionId),
        passages: item.passages.map((piece) => {
          const source = piece.sourceBase;
          // A draft is allowed to contain its own copy even when its source shares an ID.
          const sourceId = source ? draftSources.get(source.id) ?? newId() : null;
          if (source && sourceId) draftSources.set(source.id, sourceId);
          return {
            ...piece, previousTextId: remap(snapshots, piece.previousTextId), localNoteId: linkNote(piece.localNoteId),
            sourceBase: source && sourceId ? { ...source, id: sourceId } : null,
          };
        }),
      }))],
      presets: [...library.presets, ...incoming.presets.map((item) => ({ ...item, id: presetIds.get(item.id)! }))],
      hiddenSamples: [...new Set([...library.hiddenSamples, ...incoming.hiddenSamples])],
    };
  }
  return {
    baseLibrary: library,
    journal: { id: newId(), baseNotes: notes, nextNotes: [...notes, ...additions], bookIds: importedBooks, draftIds: importedDrafts } satisfies RestoreJournal,
    addedNotes: additions.length, addedBooks: duplicate ? 0 : incoming.books.length, conflicts, library: merged,
  };
}

export function replanRestoreNotes(notes: Note[], library: Library, pending: RestoreJournal) {
  const originals = new Set(pending.baseNotes.map((note) => note.id));
  const imported = pending.nextNotes.filter((note) => !originals.has(note.id));
  const existing = new Map(notes.map((note) => [note.id, note]));
  const redirects = new Map<string, string>();
  const additions: Note[] = [];
  for (const note of imported) {
    const current = existing.get(note.id);
    if (JSON.stringify(current) === JSON.stringify(note)) continue;
    const id = current ? newId() : note.id;
    if (current) redirects.set(note.id, id);
    additions.push({ ...note, id });
  }
  const patch = <T extends { localNoteId: string | null }>(piece: T) => {
    const redirect = piece.localNoteId ? redirects.get(piece.localNoteId) : undefined;
    return redirect ? { ...piece, localNoteId: redirect } : piece;
  };
  const revised = {
    ...library,
    editions: library.editions.map((edition) => pending.bookIds.includes(edition.bookId)
      ? { ...edition, passages: edition.passages.map(patch) } : edition),
    drafts: library.drafts.map((draft) => pending.draftIds.includes(draft.id)
      ? { ...draft, passages: draft.passages.map(patch) } : draft),
  };
  return {
    baseLibrary: library,
    library: revised,
    journal: { ...pending, id: newId(), baseNotes: notes, nextNotes: [...notes, ...additions] },
    addedNotes: additions.length, addedBooks: 0, conflicts: redirects.size,
  };
}

export async function applyRestoreNotes(id: string, epoch: string | null, synced: (notes: Note[]) => void) {
  const library = await withRestoreJournal(id, epoch, (_journal, saved) => saved);
  if (!await mirrorLibrary(library, epoch)) throw new Error("restoreIncomplete");

  const nextNotes = await withRestoreJournal(id, epoch, ({ baseNotes, nextNotes }) => {
    const result = saveNotes(nextNotes, { expectedNotes: baseNotes, writerId: id, dataEpoch: epoch });
    // Resuming after the primary write uses the same bytes, including if IDB cleanup failed.
    const alreadyApplied = !result.ok &&
      saveNotes(nextNotes, { expectedNotes: nextNotes, writerId: id, dataEpoch: epoch }).ok;
    if (!result.ok && !alreadyApplied) throw new Error("restoreIncomplete");
    return nextNotes;
  });
  synced(nextNotes);
  if (!await persistNativeDurableSnapshot(nextNotes, epoch)) throw new Error("restoreIncomplete");
  await finishJournal(id, epoch);
}
