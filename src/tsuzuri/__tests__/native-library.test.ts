// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, expect, it, vi } from "vitest";
import { applyRestoreNotes, makeArchive, planRestore } from "../backup";
import { loadNotes } from "../../lib/storage";
import { markDataErase } from "../../lib/dataEpoch";
import { blankDraft, bindDraft, emptyLibrary } from "../model";
import { eraseLibrary, adoptLibraryCandidate, readLibraryRecords, writeLibrary } from "../repository";
import { eraseNativeBooksAndExports, mirrorLibrary, nativeLibraryCheck } from "../nativeFiles";

const { files, failedWrites } = vi.hoisted(() => ({
  files: new Map<string, string>(),
  failedWrites: new Set<string>(),
}));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock("@capacitor/filesystem", () => ({
  Directory: { LibraryNoCloud: "library", Cache: "cache" },
  Encoding: { UTF8: "utf8" },
  Filesystem: {
    readFile: async ({ path }: { path: string }) => {
      if (!files.has(path)) throw { code: "OS-PLUG-FILE-0008" };
      return { data: files.get(path) };
    },
    writeFile: async ({ path, data }: { path: string; data: string }) => {
      if (failedWrites.has(path)) throw new Error("No space");
      files.set(path, data);
    },
    deleteFile: async ({ path }: { path: string }) => { files.delete(path); },
    rmdir: async () => {},
  },
}));
const PRIMARY = "zanshin/books.snapshot.v1.json";
const PREVIOUS = "zanshin/books.snapshot.previous.v1.json";
const DAMAGED = "zanshin/books.snapshot.damaged.v1.json";
const date = "2026-11-27T00:00:00Z";

beforeEach(async () => {
  files.clear();
  failedWrites.clear();
  localStorage.clear();
  await eraseLibrary();
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
  await eraseNativeBooksAndExports("erase");
  expect(files.has(PRIMARY) || files.has(PREVIOUS)).toBe(false);
});

it("offers a valid previous copy after explicit corruption and keeps the displaced raw bytes", async () => {
  const empty = emptyLibrary();
  const local = await writeLibrary(empty, { ...empty, hiddenSamples: ["month"] }, null);
  const previous = emptyLibrary();
  files.set(PRIMARY, "damaged original");
  files.set(PREVIOUS, JSON.stringify(previous));
  expect(await nativeLibraryCheck(local, true)).toEqual(previous);
  const adopted = await adoptLibraryCandidate(previous, local, null, previous);
  expect(await mirrorLibrary(adopted, null)).toBe(true);
  expect(JSON.parse(files.get(DAMAGED)!)).toEqual(["damaged original"]);
  expect((await readLibraryRecords()).displaced).toEqual([local]);
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
