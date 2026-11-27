import type { Note } from "../types/note";

export type TextSnapshot = Readonly<{
  id: string;
  title: string;
  body: string;
  capturedAt: string;
  hash: string;
  origin?: Pick<Note, "id" | "createdAt" | "updatedAt" | "locale">;
}>;

export type Appearance = {
  paper: string;
  brush: string;
  cover: string;
  format: string;
  direction: "vertical" | "horizontal";
  binding: "right" | "left";
  ink: "clear" | "soft";
};

export const BASIC_APPEARANCE: Readonly<Appearance> = {
  paper: "washi", brush: "mincho", cover: "plain", format: "BK01",
  direction: "horizontal", binding: "left", ink: "clear",
};
export const MATERIALS_VERSION = 1;
export const LAYOUT_VERSION = 1;

export type Cover = {
  title: string;
  author: string;
  date: string;
  front: string;
  after: string;
  detail: string;
  address: string;
  closing: string;
};

export type Passage = {
  id: string;
  textSnapshotId: string;
  sourceBaseSnapshotId: string | null;
  sourceContentHash: string | null;
  localNoteId: string | null;
};

export type DraftPassage = {
  id: string;
  title: string;
  body: string;
  previousTextId: string | null;
  sourceBase: TextSnapshot | null;
  localNoteId: string | null;
};

export type BookDraft = {
  id: string;
  bookId: string | null;
  baseEditionId: string | null;
  cover: Cover;
  appearance: Appearance;
  passages: DraftPassage[];
};

export type BookEdition = {
  id: string;
  bookId: string;
  createdAt: string;
  cover: Cover;
  appearance: Appearance;
  materialsVersion: number;
  layoutVersion: number;
  passages: Passage[];
};

export type Bookmark = { passageId: string; offset: number | null; progress: number };
export type Book = {
  id: string;
  editionId: string;
  createdAt: string;
  updatedAt: string;
  bookmark: Bookmark | null;
};
export type SavedPreset = { id: string; name: string; appearance: Appearance };

export type Library = {
  schemaVersion: 1;
  libraryId: string;
  storeRevision: number;
  books: Book[];
  editions: BookEdition[];
  snapshots: TextSnapshot[];
  drafts: BookDraft[];
  presets: SavedPreset[];
  hiddenSamples: string[];
};

export function emptyLibrary(): Library {
  return {
    schemaVersion: 1, libraryId: newId(), storeRevision: 0, books: [], editions: [],
    snapshots: [], drafts: [], presets: [], hiddenSamples: [],
  };
}

export function newId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function contentHash(title: string, body: string): string {
  // An identity hint over original UTF-16, never a substitute for text comparison.
  const source = JSON.stringify([title, body]);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index++) {
    hash = Math.imul(hash ^ source.charCodeAt(index), 16777619);
  }
  return `${source.length}:${(hash >>> 0).toString(16)}`;
}

function capture(title: string, body: string, origin?: TextSnapshot["origin"]): TextSnapshot {
  return { id: newId(), title, body, hash: contentHash(title, body), capturedAt: new Date().toISOString(), ...(origin ? { origin } : {}) };
}

export function snapshotNote(note: Note): TextSnapshot {
  const { id, createdAt, updatedAt, locale } = note;
  return capture(note.title, note.body, { id, createdAt, updatedAt, ...(locale ? { locale } : {}) });
}

export function passageFromNote(note: Note): DraftPassage {
  return {
    id: newId(), title: note.title, body: note.body, previousTextId: null,
    sourceBase: snapshotNote(note), localNoteId: note.id,
  };
}

export function sameText(a: Pick<Note, "title" | "body">, b: Pick<Note, "title" | "body">): boolean {
  return a.title === b.title && a.body === b.body;
}

export function sourceChanged(passage: DraftPassage, note: Note): boolean {
  const base = passage.sourceBase;
  return Boolean(base && (contentHash(note.title, note.body) !== base.hash || !sameText(base, note)));
}

export function adoptSource(passage: DraftPassage, note: Note, keepBookText = false): DraftPassage {
  return {
    ...passage,
    title: keepBookText ? passage.title : note.title,
    body: keepBookText ? passage.body : note.body,
    sourceBase: snapshotNote(note),
    previousTextId: keepBookText ? passage.previousTextId : null,
  };
}

export function blankDraft(direction: Appearance["direction"], note?: Note): BookDraft {
  return {
    id: newId(), bookId: null, baseEditionId: null,
    cover: { title: "", author: "", date: "", front: "", after: "", detail: "", address: "", closing: "" },
    appearance: { ...BASIC_APPEARANCE, direction, binding: direction === "vertical" ? "right" : "left" },
    passages: note ? [passageFromNote(note)] : [],
  };
}

export function editionDraft(library: Library, book: Book): BookDraft {
  const edition = library.editions.find((item) => item.id === book.editionId)!;
  const snapshots = new Map(library.snapshots.map((item) => [item.id, item]));
  return {
    id: newId(), bookId: book.id, baseEditionId: edition.id,
    appearance: { ...edition.appearance }, cover: { ...edition.cover },
    passages: edition.passages.map((passage) => {
      const text = snapshots.get(passage.textSnapshotId)!;
      return {
        id: passage.id, title: text.title, body: text.body, previousTextId: text.id,
        localNoteId: passage.localNoteId,
        sourceBase: passage.sourceBaseSnapshotId === null ? null : snapshots.get(passage.sourceBaseSnapshotId)!,
      };
    }),
  };
}

export function bindDraft(library: Library, draft: BookDraft): { library: Library; book: Book } {
  if (draft.passages.length === 0) throw new Error("emptySelection");
  const existing = library.books.find((item) => item.id === draft.bookId);
  if (draft.bookId !== null && (!existing || existing.editionId !== draft.baseEditionId)) throw new Error("conflict");
  const id = existing?.id ?? newId();
  const now = new Date().toISOString();
  const snapshots = new Map(library.snapshots.map((item) => [item.id, item]));
  const edition: BookEdition = {
    id: newId(), bookId: id, createdAt: now, appearance: { ...draft.appearance }, cover: { ...draft.cover },
    materialsVersion: MATERIALS_VERSION, layoutVersion: LAYOUT_VERSION,
    passages: draft.passages.map((passage) => {
      const previous = passage.previousTextId ? snapshots.get(passage.previousTextId) : undefined;
      const source = passage.sourceBase;
      const text = previous && sameText(previous, passage) ? previous
        : source && sameText(source, passage) ? source : capture(passage.title, passage.body, source?.origin);
      for (const snapshot of source ? [source, text] : [text]) {
        const known = snapshots.get(snapshot.id);
        if (known && JSON.stringify(known) !== JSON.stringify(snapshot)) throw new Error("invalidLibrary");
        if (!known) snapshots.set(snapshot.id, snapshot);
      }
      return {
        id: passage.id, textSnapshotId: text.id,
        sourceBaseSnapshotId: source?.id ?? null, sourceContentHash: source?.hash ?? null,
        localNoteId: passage.localNoteId,
      };
    }),
  };
  const bookmark = existing?.bookmark;
  const book: Book = {
    id, editionId: edition.id, createdAt: existing?.createdAt ?? now, updatedAt: now,
    bookmark: bookmark && edition.passages.some((entry) => entry.id === bookmark.passageId) ? bookmark : null,
  };
  return {
    book,
    library: {
      ...library, books: existing ? library.books.map((item) => item.id === id ? book : item) : [book, ...library.books],
      editions: [...library.editions, edition], snapshots: [...snapshots.values()],
      drafts: library.drafts.filter((item) => item.id !== draft.id),
    },
  };
}

export function removeBook(library: Library, bookId: string): Library {
  const editions = library.editions.filter((edition) => edition.bookId !== bookId);
  const drafts = library.drafts.filter((draft) => draft.bookId !== bookId);
  const referenced = new Set<string>();
  for (const edition of editions) {
    for (const passage of edition.passages) {
      referenced.add(passage.textSnapshotId);
      if (passage.sourceBaseSnapshotId) referenced.add(passage.sourceBaseSnapshotId);
    }
  }
  for (const draft of drafts) {
    for (const passage of draft.passages) {
      if (passage.previousTextId) referenced.add(passage.previousTextId);
    }
  }
  return {
    ...library, editions, drafts,
    books: library.books.filter((book) => book.id !== bookId),
    snapshots: library.snapshots.filter((snapshot) => referenced.has(snapshot.id)),
  };
}

export function editionText(library: Library, edition: BookEdition) {
  const snapshots = new Map(library.snapshots.map((snapshot) => [snapshot.id, snapshot]));
  return edition.passages.map((passage) => ({ id: passage.id, ...textFields(snapshots.get(passage.textSnapshotId)!) }));
}

function textFields(snapshot: TextSnapshot) {
  return { title: snapshot.title, body: snapshot.body };
}

export function pieceText(piece: { title: string; body: string }) {
  return piece.title ? `${piece.title}\n${piece.body}` : piece.body;
}
