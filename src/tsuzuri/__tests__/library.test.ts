// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Note } from "../../types/note";
import { markDataErase } from "../../lib/dataEpoch";
import { loadNotes, saveNotes } from "../../lib/storage";
import { applyRestoreNotes, makeArchive, planRestore, readArchive, replanRestoreNotes } from "../backup";
import {
  adoptSource, bindDraft, blankDraft, bookOriginalText, editionDraft, emptyLibrary, editionText, removeBook, sourceChanged,
} from "../model";
import { eraseLibrary, readLibrary, readLibraryRecords, writeLibrary } from "../repository";
import { eraseAllData, resumeInterruptedErase } from "../erase";
import { preserveUneditedText, selectedOriginal } from "../originalText";
import { validLibrary } from "../validation";

const time = "2026-11-27T01:02:03.000Z";
const note: Note = {
  id: "origin", title: "", body: "  雨\r\n\nCafe\u0301 👩🏽‍💻 𠮷\u{E0100}\t\n",
  createdAt: time, updatedAt: time, isFavorite: true, locale: "ja",
};

beforeEach(async () => {
  localStorage.clear();
  await eraseLibrary();
});

describe("immutable editions", () => {
  it("binds the preview and keeps the source baseline separate from in-book edits", () => {
    const first = bindDraft(emptyLibrary(), blankDraft("vertical", note));
    const duplicate = bindDraft(first.library, blankDraft("horizontal", note));
    const working = editionDraft(duplicate.library, first.book);
    working.passages[0].body += "本でだけ追記";
    expect(sourceChanged(working.passages[0], note)).toBe(false);
    const modified = { ...note, body: "New source" };
    expect(sourceChanged(working.passages[0], modified)).toBe(true);
    const originalText = working.passages[0].body;
    working.passages[0] = adoptSource(working.passages[0], modified, true);
    const amended = bindDraft(duplicate.library, working);
    expect(validLibrary(amended.library)).toBe(true);
    expect(editionText(amended.library, amended.library.editions[0])[0].body).toBe(note.body);
    expect(editionText(amended.library, amended.library.editions[1])[0].body).toBe(note.body);
    expect(editionText(amended.library, amended.library.editions[2])[0].body).toBe(originalText);
    expect(sourceChanged(editionDraft(amended.library, amended.book).passages[0], modified)).toBe(false);
    expect(validLibrary(removeBook(amended.library, amended.book.id))).toBe(true);
    expect(removeBook(amended.library, amended.book.id).books.map((book) => book.id)).toEqual([duplicate.book.id]);
  });

  it("refuses a colliding inline source before it can replace an already bound passage", () => {
    const first = bindDraft(emptyLibrary(), blankDraft("vertical", note));
    // Give the passage an independent text snapshot, separate from the source baseline.
    const edit = editionDraft(first.library, first.book);
    edit.passages[0].body = "Original book-only text";
    const revised = bindDraft(first.library, edit);
    const original = revised.library.editions[1];
    const collision = blankDraft("vertical", { ...note, body: "Distinct draft text" });
    collision.passages[0].sourceBase = {
      ...collision.passages[0].sourceBase!,
      id: original.passages[0].textSnapshotId,
    };
    expect(validLibrary({ ...revised.library, drafts: [collision] })).toBe(true);
    expect(() => bindDraft(revised.library, collision)).toThrow("invalidLibrary");
    expect(editionText(revised.library, original)[0].body).toBe("Original book-only text");
  });

  it("keeps the exact selected text despite later source edits", () => {
    const source = { ...note };
    const draft = blankDraft("horizontal", source);
    source.body = "Later source";
    const result = bindDraft(emptyLibrary(), draft);
    expect(editionText(result.library, result.library.editions[0])[0]).toMatchObject({ title: "", body: note.body });
    expect(() => bindDraft(result.library, { ...draft, bookId: result.book.id, baseEditionId: "stale" })).toThrow("conflict");
  });

  it("includes every authored cover field in the original text without trimming the text", () => {
    const draft = blankDraft("vertical", note);
    draft.cover = {
      title: "  短い手紙  ", author: "A. Cafe\u0301", date: "十二月", detail: " 雪 ", address: "友へ",
      front: "前書き\r\n の続き", closing: "👩🏽‍💻", after: "𠮷\u{E0100}\n",
    };
    const { library } = bindDraft(emptyLibrary(), draft);
    const [edition] = library.editions;
    const expected = ["  短い手紙  ", "A. Cafe\u0301", "十二月", " 雪 ", "友へ", "前書き\r\n の続き",
      note.body, "👩🏽‍💻", "𠮷\u{E0100}\n"].join("\n\n");
    expect(bookOriginalText(draft.cover, draft.passages)).toBe(expected);
    expect(bookOriginalText(edition.cover, editionText(library, edition))).toBe(expected);
  });
});

describe("transactional library and restore", () => {
  it("rejects concurrent and stale transactions and blocks writers from before erase", async () => {
    const pristine = emptyLibrary();
    const next = bindDraft(pristine, blankDraft("horizontal", note)).library;
    const first = await writeLibrary(pristine, next, null);
    const writes = await Promise.allSettled([
      writeLibrary(first, { ...first, hiddenSamples: ["a"] }, null),
      writeLibrary(first, { ...first, hiddenSamples: ["b"] }, null),
    ]);
    expect(writes.map((result) => result.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect((await readLibraryRecords()).previous).toEqual(first);
    markDataErase("new-epoch", true);
    await eraseLibrary();
    markDataErase("new-epoch", false);
    await expect(writeLibrary(pristine, next, null)).rejects.toThrow("blocked");
    expect(saveNotes([note], { force: true, dataEpoch: null })).toMatchObject({ ok: false });
    expect((await readLibrary()).kind).toBe("ready");
  });

  it("preserves the prior edition if the transaction cannot write", async () => {
    const initial = emptyLibrary();
    const first = await writeLibrary(initial, bindDraft(initial, blankDraft("horizontal", note)).library, null);
    const put = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementationOnce(() => {
      throw new DOMException("Full", "QuotaExceededError");
    });
    try {
      await expect(writeLibrary(first, { ...first, hiddenSamples: ["scenes"] }, null)).rejects.toMatchObject({ name: "QuotaExceededError" });
      expect((await readLibraryRecords()).current).toEqual(first);
    } finally {
      put.mockRestore();
    }
  });

  it("finishes a recorded erase across stores on startup and blocks old note and book writers", async () => {
    const first = emptyLibrary();
    await writeLibrary(first, bindDraft(first, blankDraft("vertical", note)).library, null);
    expect(saveNotes([note]).ok).toBe(true);
    localStorage.setItem("zanshin.notes.recovery.conflict.backup.v1", JSON.stringify([note]));
    localStorage.setItem("zanshin.notes.corrupt.backup", "private incomplete bytes");
    markDataErase("interrupted", true);
    expect(await resumeInterruptedErase()).toBe(true);
    expect((await readLibraryRecords()).current).toBeUndefined();
    expect([...Array(localStorage.length).keys()].map((key) => localStorage.key(key))).not.toContain("zanshin.notes.v1");
    expect(localStorage.getItem("zanshin.notes.corrupt.backup")).toBeNull();
    expect(localStorage.getItem("zanshin.notes.recovery.conflict.backup.v1")).toBeNull();
    expect(saveNotes([note], { dataEpoch: null }).ok).toBe(false);
    expect(await resumeInterruptedErase()).toBe(false);
    await eraseAllData();
    expect(loadNotes().notes).toEqual([]);
  });

  it("copies conflicting IDs, retains all references and resumes after the notes write", async () => {
    const library = bindDraft(emptyLibrary(), blankDraft("horizontal", note)).library;
    library.drafts = [editionDraft(library, library.books[0])];
    library.presets = [{ id: "saved", name: "任意", appearance: { ...library.editions[0].appearance, paper: "unknown-paper" } }];
    const withUnknown = { ...note, additional: { literal: "x\r\ny" } };
    const archive = readArchive(JSON.stringify(makeArchive([withUnknown], library)));
    expect(archive.notes[0]).toEqual(withUnknown);
    const current = { ...note, body: "Locally edited" };
    expect(saveNotes([current]).ok).toBe(true);
    const existing = await writeLibrary(emptyLibrary(), {
      ...library, editions: library.editions.map((edition) => ({ ...edition, cover: { ...edition.cover, title: "Local book" } })),
    }, null);
    const plan = planRestore([current], existing, archive);
    expect(validLibrary(plan.library)).toBe(true);
    expect(plan.library.books).toHaveLength(2);
    expect(plan.library.presets).toHaveLength(2);
    expect(plan.library.drafts).toHaveLength(2);
    expect(plan.library.drafts[1].passages[0].localNoteId).not.toBe(note.id);
    expect(plan.library.drafts[1].passages[0].sourceBase?.origin?.id).toBe(note.id);
    await writeLibrary(existing, plan.library, null, plan.journal);
    await expect(writeLibrary(existing, library, null)).rejects.toThrow("blocked");
    expect(saveNotes(plan.journal.nextNotes, { expectedNotes: [current], writerId: plan.journal.id }).ok).toBe(true);
    let synced: Note[] = [];
    await applyRestoreNotes(plan.journal.id, null, (notes) => { synced = notes; });
    expect(synced.map((item) => item.body)).toEqual([current.body, note.body]);
    expect((await readLibraryRecords()).restore).toBeUndefined();
    expect(loadNotes().notes).toEqual(synced);
    expect(makeArchive(synced, plan.library)).not.toHaveProperty("entitlement");
  });

  it("does not apply note writes from a restore plan that is no longer active", async () => {
    const before = emptyLibrary();
    const firstPlan = planRestore([], before, makeArchive([note], emptyLibrary()));
    const staged = await writeLibrary(before, firstPlan.library, null, firstPlan.journal);
    const replacement = planRestore([], staged, makeArchive([{ ...note, body: "Use this version" }], emptyLibrary()));
    await writeLibrary(staged, replacement.library, null, replacement.journal, firstPlan.journal.id);

    await expect(applyRestoreNotes(firstPlan.journal.id, null, () => {})).rejects.toThrow("restoreIncomplete");
    expect(loadNotes().notes).toEqual([]);
    expect((await readLibraryRecords()).restore?.id).toBe(replacement.journal.id);
    await applyRestoreNotes(replacement.journal.id, null, () => {});
    expect(loadNotes().notes[0].body).toBe("Use this version");
  });

  it("protects a pending operation from changed notes and rejects unresolved references and future versions", async () => {
    const existing = emptyLibrary();
    const incoming = bindDraft(emptyLibrary(), blankDraft("horizontal", note)).library;
    const archive = makeArchive([note], incoming);
    expect(() => readArchive(JSON.stringify({ ...archive, schemaVersion: 2 }))).toThrow("archiveVersion");
    expect(() => readArchive(JSON.stringify({ ...archive, library: { ...incoming, snapshots: [] } }))).toThrow("invalidArchive");
    const plan = planRestore([], existing, archive);
    const installed = await writeLibrary(existing, plan.library, null, plan.journal);
    const changed = { ...note, body: "Other window" };
    expect(saveNotes([changed]).ok).toBe(true);
    await expect(applyRestoreNotes(plan.journal.id, null, () => {})).rejects.toThrow("restoreIncomplete");
    expect((await readLibraryRecords()).restore?.id).toBe(plan.journal.id);
    expect((await readLibraryRecords()).current).toEqual(installed);
    expect(loadNotes().notes).toEqual([changed]);
    const resumable = replanRestoreNotes([changed], installed, plan.journal);
    expect(resumable.conflicts).toBe(1);
    const installedAgain = await writeLibrary(installed, resumable.library, null, resumable.journal, plan.journal.id);
    await applyRestoreNotes(resumable.journal.id, null, () => {});
    expect(loadNotes().notes.map((item) => item.body)).toEqual([changed.body, note.body]);
    expect(installedAgain.editions[0].passages[0].localNoteId).toBe(resumable.journal.nextNotes[1].id);
  });
});

it("maps selected ranges and edits back to unchanged CRLF and Unicode original text", () => {
  const original = "A\r\n👩🏽‍💻。\r\nB\r";
  const normalized = original.replace(/\r\n?/g, "\n");
  expect(preserveUneditedText(original, normalized.replace("。", "！"))).toBe(original.replace("。", "！"));
  expect(selectedOriginal(original, 1, 2)).toBe("\r\n");
  expect(selectedOriginal(original, 1, normalized.length - 1)).toBe(original.slice(1, -1));
});
