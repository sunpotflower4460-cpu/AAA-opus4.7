import { describe, it, expect } from "vitest";
import type { Note } from "../../types/note";
import { matchesNote, normalizeSearchQuery, sortNotes } from "../notesLogic";

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "default-id",
    title: "",
    body: "",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    isFavorite: false,
    locale: "ja",
    ...overrides,
  };
}

describe("sortNotes — お気に入り優先ソート", () => {
  it("お気に入りが先頭に来る", () => {
    const notes = [
      makeNote({ id: "a", isFavorite: false, updatedAt: "2024-03-01T00:00:00.000Z" }),
      makeNote({ id: "b", isFavorite: true, updatedAt: "2024-01-01T00:00:00.000Z" }),
    ];
    expect(sortNotes(notes).map((note) => note.id)).toEqual(["b", "a"]);
  });

  it("同じお気に入り状態では更新日時の新しい順", () => {
    const notes = [
      makeNote({ id: "old", updatedAt: "2024-01-01T00:00:00.000Z" }),
      makeNote({ id: "new", updatedAt: "2024-12-01T00:00:00.000Z" }),
    ];
    expect(sortNotes(notes).map((note) => note.id)).toEqual(["new", "old"]);
  });

  it("元の配列を変更しない", () => {
    const notes = [makeNote({ id: "a" }), makeNote({ id: "b", isFavorite: true })];
    const originalIds = notes.map((note) => note.id);
    sortNotes(notes);
    expect(notes.map((note) => note.id)).toEqual(originalIds);
  });
});

describe("normalizeSearchQuery / matchesNote — 検索", () => {
  it("前後の空白を取り除く", () => {
    expect(normalizeSearchQuery("  残心  ")).toBe("残心");
    expect(normalizeSearchQuery("　残心　")).toBe("残心");
  });

  it("空白だけの検索は未検索としてすべてにマッチする", () => {
    const note = makeNote({ title: "テスト", body: "本文" });
    expect(matchesNote(note, "   ")).toBe(true);
    expect(matchesNote(note, "　　")).toBe(true);
  });

  it("前後に空白がある検索語でもタイトルにマッチする", () => {
    const note = makeNote({ title: "残心の使い方" });
    expect(matchesNote(note, "  残心 ")).toBe(true);
  });

  it("本文にマッチする", () => {
    const note = makeNote({ body: "今日は静かな日" });
    expect(matchesNote(note, "静か")).toBe(true);
    expect(matchesNote(note, "賑やか")).toBe(false);
  });

  it("英字の大文字小文字を区別しない", () => {
    const note = makeNote({ title: "Hello World" });
    expect(matchesNote(note, "hello")).toBe(true);
    expect(matchesNote(note, "WORLD")).toBe(true);
  });
});
