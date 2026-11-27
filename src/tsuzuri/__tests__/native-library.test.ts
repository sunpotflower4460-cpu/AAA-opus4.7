// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, expect, it, vi } from "vitest";
import { applyRestoreNotes, makeArchive, planRestore } from "../backup";
import { loadNotes } from "../../lib/storage";
import { markDataErase } from "../../lib/dataEpoch";
import { blankDraft, bindDraft, editionDraft, emptyLibrary } from "../model";
import { eraseAllData } from "../erase";
import { offerFile } from "../exportFile";
import { eraseLibrary, adoptLibraryCandidate, readLibrary, readLibraryRecords, writeLibrary } from "../repository";
import { eraseNativeBooksAndExports, mirrorLibrary, nativeLibraryCheck } from "../nativeFiles";

const { files, failedWrites, shareFile, beforeWrite } = vi.hoisted(() => ({
  files: new Map<string, string>(),
  failedWrites: new Set<string>(),
  shareFile: vi.fn(),
  beforeWrite: vi.fn<(path: string) => Promise<void> | undefined>(),
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true },
  registerPlugin: () => ({ shareFile }),
}));
vi.mock("@capacitor/filesystem", () => ({
  Directory: { LibraryNoCloud: "library", Cache: "cache" },
  Encoding: { UTF8: "utf8" },
  Filesystem: {
    readFile: async ({ path }: { path: string }) => {
      if (!files.has(path)) throw { code: "OS-PLUG-FILE-0008" };
      return { data: files.get(path) };
    },
    writeFile: async ({ path, data }: { path: string; data: string }) => {
      await beforeWrite(path);
      if (failedWrites.has(path)) throw new Error("No space");
      files.set(path, data);
    },
    deleteFile: async ({ path }: { path: string }) => { files.delete(path); },
    rmdir: async ({ path }: { path: string }) => {
      for (const key of files.keys()) if (key.startsWith(`${path}/`)) files.delete(key);
    },
  },
}));
const PRIMARY = "zanshin/books.snapshot.v1.json";
const PREVIOUS = "zanshin/books.snapshot.previous.v1.json";
const DAMAGED = "zanshin/books.snapshot.damaged.v1.json";
const date = "2026-11-27T00:00:00Z";

beforeEach(async () => {
  files.clear();
  failedWrites.clear();
  beforeWrite.mockReset();
  shareFile.mockReset();
  localStorage.clear();
  await eraseLibrary();
});

it("records erasure while a native file is still writing and prevents it from opening a share sheet", async () => {
  const marker = "zanshin/erase.pending.v1";
  let releaseWrite!: () => void;
  let announceWrite!: () => void;
  const writing = new Promise<void>((resolve) => { announceWrite = resolve; });
  const release = new Promise<void>((resolve) => { releaseWrite = resolve; });
  beforeWrite.mockImplementation((path) => {
    if (!path.startsWith("zanshin-exports/")) return;
    announceWrite();
    return release;
  });
  shareFile.mockResolvedValue({ completed: true });
  const exported = offerFile(new Blob(["private text"]), "zanshin-book.txt", null);
  const observed = exported.catch((error: unknown) => error);
  await writing;
  const erasure = eraseAllData("confirmed");
  await new Promise((resolve) => setTimeout(resolve, 0));
  try {
    expect(files.get(marker)).toBe("confirmed");
  } finally {
    releaseWrite();
    await erasure;
  }
  expect(await observed).toEqual(new Error("exportFailed"));
  expect(shareFile).not.toHaveBeenCalled();
  expect(files.size).toBe(0);
});

it("preserves the previous mirrored generation and refuses an out-of-order rewrite", async () => {
  const empty = emptyLibrary();
  const draft = blankDraft("vertical", { id: "n", title: "", body: "Line", isFavorite: false, createdAt: date, updatedAt: date });
  const first = await writeLibrary(empty, bindDraft(empty, draft).library, null);
  expect(await mirrorLibrary(first, null)).toBe(true);
  const second = await writeLibrary(first, { ...first, hiddenSamples: ["scenes"] }, null);
  expect(await mirrorLibrary(second, null)).toBe(true);
  expect(await mirrorLibrary(first, null)).toBe(false);
  expect(JSON.parse(files.get(PRIMARY)!)).toEqual(second);
  expect(JSON.parse(files.get(PREVIOUS)!)).toEqual(first);
  markDataErase("erase", true);
  expect(await mirrorLibrary(second, null)).toBe(false);
  await eraseNativeBooksAndExports();
  expect(files.has(PRIMARY) || files.has(PREVIOUS)).toBe(false);
});

it("offers a valid previous copy after explicit corruption and keeps the displaced raw bytes", async () => {
  const empty = emptyLibrary();
  const local = await writeLibrary(empty, { ...empty, hiddenSamples: ["month"] }, null);
  const previous = emptyLibrary();
  files.set(PRIMARY, "damaged original");
  files.set(PREVIOUS, JSON.stringify(previous));
  expect(await nativeLibraryCheck(local)).toEqual(previous);
  const adopted = await adoptLibraryCandidate(previous, local, null, [previous]);
  expect(await mirrorLibrary(adopted, null)).toBe(true);
  expect(JSON.parse(files.get(DAMAGED)!)).toEqual(["damaged original"]);
  expect((await readLibraryRecords()).displaced).toEqual([local]);
});

it.each(["device", "previous"] as const)("recovers a damaged library while preserving the other copy when choosing %s", async (choice) => {
  const initial = emptyLibrary();
  const draft = blankDraft("vertical", { id: "n", title: "", body: "Earlier text", isFavorite: false, createdAt: date, updatedAt: date });
  const previous = await writeLibrary(initial, bindDraft(initial, draft).library, null);
  const edit = editionDraft(previous, previous.books[0]);
  edit.passages[0].body = "Latest text on the device";
  const damaged = { partial: "unreadable bytes" };
  const put = IDBObjectStore.prototype.put;
  const intercept = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementationOnce(function (this: IDBObjectStore, value, key) {
    return put.call(this, { ...value, current: damaged }, key);
  });
  const latest = await writeLibrary(previous, bindDraft(previous, edit).library, null);
  intercept.mockRestore();
  files.set(PRIMARY, JSON.stringify(latest));

  const local = await readLibrary();
  if (local.kind !== "damaged") throw new Error("Expected a damaged local library");
  expect(local.previous).toEqual(previous);
  expect(await nativeLibraryCheck()).toEqual(latest);
  expect(files.get(PRIMARY)).toBe(JSON.stringify(latest));

  const selected = choice === "device" ? latest : previous;
  const remaining = choice === "device" ? previous : latest;
  const adopted = await adoptLibraryCandidate(selected, local.raw, null, [latest]);
  expect((await readLibraryRecords()).displaced).toEqual([damaged, remaining]);
  expect(await mirrorLibrary(adopted, null)).toBe(true);
  expect(JSON.parse(files.get(PRIMARY)!)).toEqual(selected);
});

it("retains the interrupted journal when the library recovery file cannot be written", async () => {
  const note = { id: "n", title: "", body: "  本文 Café  ", isFavorite: false, createdAt: date, updatedAt: date };
  const before = emptyLibrary();
  const archive = makeArchive([note], bindDraft(emptyLibrary(), blankDraft("vertical", note)).library);
  const plan = planRestore([], before, archive);
  const staged = await writeLibrary(before, plan.library, null, plan.journal);
  const synced = vi.fn();
  failedWrites.add(PRIMARY);

  await expect(applyRestoreNotes(plan.journal.id, null, synced)).rejects.toThrow("restoreIncomplete");
  expect((await readLibraryRecords()).restore).toEqual(plan.journal);
  expect(loadNotes().notes).toEqual([]);
  expect(synced).not.toHaveBeenCalled();

  failedWrites.delete(PRIMARY);
  await applyRestoreNotes(plan.journal.id, null, synced);
  expect(JSON.parse(files.get(PRIMARY)!)).toEqual(staged);
  expect((await readLibraryRecords()).restore).toBeUndefined();
  expect(synced).toHaveBeenCalledOnce();
  expect(loadNotes().notes).toEqual([note]);
});
