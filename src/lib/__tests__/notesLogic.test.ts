import { describe, it, expect } from "vitest";
import type { Note } from "../../types/note";

// NotesList の内部ロジックをテストするためにインライン再定義
function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

function matches(note: Note, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    note.title.toLowerCase().includes(needle) ||
    note.body.toLowerCase().includes(needle)
  );
}

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
      makeNote({ id: "b", isFavorite: true,  updatedAt: "2024-01-01T00:00:00.000Z" }),
    ];
    const sorted = sortNotes(notes);
    expect(sorted[0].id).toBe("b");
    expect(sorted[1].id).toBe("a");
  });

  it("お気に入りが複数ある場合、更新日時の新しい順", () => {
    const notes = [
      makeNote({ id: "fav-old", isFavorite: true, updatedAt: "2024-01-01T00:00:00.000Z" }),
      makeNote({ id: "fav-new", isFavorite: true, updatedAt: "2024-06-01T00:00:00.000Z" }),
    ];
    const sorted = sortNotes(notes);
    expect(sorted[0].id).toBe("fav-new");
    expect(sorted[1].id).toBe("fav-old");
  });

  it("お気に入りなしの場合、更新日時の新しい順", () => {
    const notes = [
      makeNote({ id: "old", isFavorite: false, updatedAt: "2024-01-01T00:00:00.000Z" }),
      makeNote({ id: "new", isFavorite: false, updatedAt: "2024-12-01T00:00:00.000Z" }),
    ];
    const sorted = sortNotes(notes);
    expect(sorted[0].id).toBe("new");
    expect(sorted[1].id).toBe("old");
  });

  it("元の配列を変更しない（immutable）", () => {
    const notes = [
      makeNote({ id: "a", isFavorite: false }),
      makeNote({ id: "b", isFavorite: true }),
    ];
    const original = [...notes];
    sortNotes(notes);
    expect(notes[0].id).toBe(original[0].id);
  });

  it("空配列を渡しても壊れない", () => {
    expect(sortNotes([])).toEqual([]);
  });
});

describe("matches — 検索", () => {
  it("空クエリはすべてにマッチする", () => {
    const note = makeNote({ title: "テスト", body: "本文" });
    expect(matches(note, "")).toBe(true);
  });

  it("タイトルにマッチする", () => {
    const note = makeNote({ title: "残心の使い方", body: "" });
    expect(matches(note, "残心")).toBe(true);
    expect(matches(note, "unknown")).toBe(false);
  });

  it("本文にマッチする", () => {
    const note = makeNote({ title: "", body: "今日は静かな日" });
    expect(matches(note, "静か")).toBe(true);
    expect(matches(note, "賑やか")).toBe(false);
  });

  it("大文字小文字を区別しない（英字）", () => {
    const note = makeNote({ title: "Hello World", body: "" });
    expect(matches(note, "hello")).toBe(true);
    expect(matches(note, "WORLD")).toBe(true);
  });

  it("タイトルと本文のどちらかにマッチすれば真", () => {
    const note = makeNote({ title: "タイトル", body: "本文キーワード" });
    expect(matches(note, "キーワード")).toBe(true);
  });

  it("どちらにもマッチしなければ偽", () => {
    const note = makeNote({ title: "タイトル", body: "本文" });
    expect(matches(note, "存在しない")).toBe(false);
  });
});
