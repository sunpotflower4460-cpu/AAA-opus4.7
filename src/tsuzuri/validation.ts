import { contentHash, type Library } from "./model";

const string = (value: unknown): value is string => typeof value === "string";
const id = (value: unknown): value is string => string(value) && value.trim().length > 0;
const nullableId = (value: unknown) => value === null || id(value);
const date = (value: unknown) => string(value) && Number.isFinite(Date.parse(value));
const revision = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const list = (value: unknown, test: (item: unknown) => boolean): boolean => Array.isArray(value) && value.every(test);
const unique = (items: readonly { id: string }[]) => new Set(items.map((item) => item.id)).size === items.length;

function cover(value: unknown): boolean {
  return record(value) &&
    ["title", "author", "date", "front", "after", "detail", "address", "closing"].every((key) => string(value[key]));
}

function appearance(value: unknown): boolean {
  return record(value) &&
    ["paper", "brush", "cover", "format"].every((key) => id(value[key])) &&
    (value.direction === "vertical" || value.direction === "horizontal") &&
    (value.binding === "left" || value.binding === "right") &&
    (value.ink === "clear" || value.ink === "soft");
}

function snapshot(value: unknown): boolean {
  return record(value) && id(value.id) && string(value.title) && string(value.body) &&
    date(value.capturedAt) && value.hash === contentHash(value.title, value.body) &&
    (value.origin === undefined || (record(value.origin) && id(value.origin.id) &&
      date(value.origin.createdAt) && date(value.origin.updatedAt) &&
      (value.origin.locale === undefined || value.origin.locale === "ja" || value.origin.locale === "en")));
}

function bookmark(value: unknown): boolean {
  return value === null || (record(value) && id(value.passageId) && (value.offset === null || revision(value.offset)) &&
    typeof value.progress === "number" && value.progress >= 0 && value.progress <= 1);
}

function book(value: unknown): boolean {
  return record(value) && id(value.id) && id(value.editionId) &&
    date(value.createdAt) && date(value.updatedAt) && bookmark(value.bookmark);
}

function edition(value: unknown): boolean {
  return record(value) && id(value.id) && id(value.bookId) && date(value.createdAt) &&
    revision(value.materialsVersion) && revision(value.layoutVersion) &&
    cover(value.cover) && appearance(value.appearance) &&
    Array.isArray(value.passages) && value.passages.length > 0 &&
    value.passages.every((piece) => record(piece) && id(piece.id) && id(piece.textSnapshotId) &&
      nullableId(piece.sourceBaseSnapshotId) && nullableId(piece.sourceContentHash) && nullableId(piece.localNoteId));
}

function draft(value: unknown): boolean {
  return record(value) && id(value.id) && nullableId(value.bookId) && nullableId(value.baseEditionId) &&
    cover(value.cover) && appearance(value.appearance) &&
    list(value.passages, (piece) => record(piece) && id(piece.id) && string(piece.title) &&
      string(piece.body) && nullableId(piece.previousTextId) && nullableId(piece.localNoteId) &&
      (piece.sourceBase === null || snapshot(piece.sourceBase)));
}

export function validLibrary(data: unknown): data is Library {
  if (!record(data) || data.schemaVersion !== 1 || !id(data.libraryId) || !revision(data.storeRevision) ||
    !list(data.books, book) || !list(data.editions, edition) || !list(data.snapshots, snapshot) ||
    !list(data.drafts, draft) || !list(data.hiddenSamples, id) ||
    !list(data.presets, (value) => record(value) && id(value.id) && string(value.name) && appearance(value.appearance))) return false;
  const library = data as Library;
  if (![library.books, library.editions, library.snapshots, library.drafts, library.presets].every(unique)) return false;
  const books = new Map(library.books.map((item) => [item.id, item]));
  const editions = new Map(library.editions.map((item) => [item.id, item]));
  const snapshots = new Map(library.snapshots.map((item) => [item.id, item]));
  return library.books.every((item) => {
    const current = editions.get(item.editionId);
    return current?.bookId === item.id &&
      (!item.bookmark || current.passages.some((piece) => piece.id === item.bookmark?.passageId));
  }) && library.editions.every((item) =>
    books.has(item.bookId) && unique(item.passages) && item.passages.every((piece) =>
      snapshots.has(piece.textSnapshotId) &&
      (piece.sourceBaseSnapshotId === null ? piece.sourceContentHash === null
        : snapshots.get(piece.sourceBaseSnapshotId)?.hash === piece.sourceContentHash))) &&
    library.drafts.every((item) => unique(item.passages) &&
      (item.bookId === null ? item.baseEditionId === null : item.baseEditionId !== null &&
        editions.get(item.baseEditionId)?.bookId === item.bookId) &&
      item.passages.every((piece) => piece.previousTextId === null || snapshots.has(piece.previousTextId)));
}
