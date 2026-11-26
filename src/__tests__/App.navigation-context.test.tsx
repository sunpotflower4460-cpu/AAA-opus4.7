/**
 * R15 / R21 / D06: 未操作の新規下書きは一覧に増やさず元の文脈（検索語・位置）へ戻り、
 * 入力のあった新規・既存メモは保存を保ったまま、来た場所の名前で戻れる。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { STORAGE_KEY_FOR_TESTING } from "../lib/storage";
import { copy } from "../lib/i18n";
import type { Note } from "../types/note";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "note-1",
    title: "",
    body: "本文",
    createdAt: "2026-08-28T00:00:00.000Z",
    updatedAt: "2026-08-28T00:00:00.000Z",
    isFavorite: false,
    locale: "ja",
    ...overrides,
  };
}

function mockLocalStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach((key) => delete store[key]);
    }),
    get _store() {
      return store;
    },
  };
}

function click(element: Element) {
  element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function findButton(container: HTMLElement, text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) =>
      candidate.textContent?.includes(text) || candidate.getAttribute("aria-label")?.includes(text),
  );
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Button not found: ${text}`);
  return button;
}

function setValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  act(() => {
    setter?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function storedNotes(storage: ReturnType<typeof mockLocalStorage>): Note[] {
  return JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING] ?? "[]") as Note[];
}

describe("戻り先と未操作の新規下書き", () => {
  let storage: ReturnType<typeof mockLocalStorage>;
  let container: HTMLDivElement;
  let root: Root | null = null;

  const seeded = [
    makeNote({ id: "a", title: "朝の庭", body: "霜の降りた庭に", updatedAt: "2026-08-28T03:00:00.000Z" }),
    makeNote({ id: "b", title: "", body: "電車の窓に映る朝", updatedAt: "2026-08-28T02:00:00.000Z" }),
    makeNote({ id: "c", title: "買い物", body: "お茶と柑橘", updatedAt: "2026-08-28T01:00:00.000Z" }),
  ];

  beforeEach(() => {
    vi.useFakeTimers();
    storage = mockLocalStorage();
    Object.defineProperty(window, "localStorage", { value: storage, writable: true, configurable: true });
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(seeded);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root?.render(<App />));
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container.remove();
    vi.useRealTimers();
  });

  const searchInput = () => container.querySelector<HTMLInputElement>(".zanshin-search-input")!;
  const cardCount = () => container.querySelectorAll("[data-note-id]").length;

  it("新規→何もせず戻る を5回繰り返しても、メモの件数は増えず、保存先にも空のメモが残らない", () => {
    for (let i = 0; i < 5; i += 1) {
      act(() => click(findButton(container, copy.newNote)));
      expect(container.querySelector<HTMLTextAreaElement>("textarea.writing-textarea")).not.toBeNull();
      act(() => click(findButton(container, copy.back)));
      act(() => vi.advanceTimersByTime(1_000));
      expect(cardCount()).toBe(3);
    }
    expect(storedNotes(storage)).toHaveLength(3);
    expect(container.textContent).toContain(copy.notesCountLabel(3));
  });

  it("検索中の新規→何もせず戻ると、検索語と結果が元のまま復元され、戻る操作の名前は「検索結果へ」", () => {
    setValue(searchInput(), "朝");
    expect(container.textContent).toContain(copy.searchResultCountLabel(2));

    act(() => click(findButton(container, copy.newNote)));
    expect(findButton(container, copy.backToSearch)).toBeDefined();
    act(() => click(findButton(container, copy.backToSearch)));

    expect(searchInput().value).toBe("朝");
    expect(container.textContent).toContain(copy.searchResultCountLabel(2));
    expect(storedNotes(storage)).toHaveLength(3);
  });

  it("本文を入力した新規は保存され、現在の検索語に一致しなくても、通常の一覧で新しいカードに戻れる", () => {
    setValue(searchInput(), "朝");
    act(() => click(findButton(container, copy.newNote)));
    setValue(container.querySelector<HTMLTextAreaElement>("textarea.writing-textarea")!, "検索に一致しない新しい一言");
    act(() => vi.advanceTimersByTime(1_000));

    // 入力のあった新規は「一覧へ」で、新しいカードが見える通常一覧へ。
    act(() => click(findButton(container, copy.back)));
    expect(searchInput().value).toBe("");
    expect(container.textContent).toContain("検索に一致しない新しい一言");
    expect(storedNotes(storage)).toHaveLength(4);
  });

  it("題名だけ・本文だけのメモは保存する。入力後に消した新規メモも、自動削除しない", () => {
    // 題名だけ
    act(() => click(findButton(container, copy.newNote)));
    setValue(container.querySelector<HTMLTextAreaElement>(".note-title-input")!, "題名だけ");
    act(() => vi.advanceTimersByTime(1_000));
    act(() => click(findButton(container, copy.back)));
    // 入力して、すべて消した
    act(() => click(findButton(container, copy.newNote)));
    setValue(container.querySelector<HTMLTextAreaElement>("textarea.writing-textarea")!, "いったん書いた");
    setValue(container.querySelector<HTMLTextAreaElement>("textarea.writing-textarea")!, "");
    act(() => vi.advanceTimersByTime(1_000));
    act(() => click(findButton(container, copy.back)));

    const notes = storedNotes(storage);
    expect(notes).toHaveLength(5);
    expect(notes.some((n) => n.title === "題名だけ" && n.body === "")).toBe(true);
    expect(notes.some((n) => n.title === "" && n.body === "" && n.id !== "b")).toBe(true);
  });

  it("読み返しから「編集する」で開いた編集は「読み返しへ」戻り、同じメモの読み返しになる", () => {
    act(() => click(findButton(container, "朝の庭")));
    act(() => click(findButton(container, copy.editNote)));
    expect(findButton(container, copy.backToRead)).toBeDefined();
    act(() => click(findButton(container, copy.backToRead)));
    expect(container.querySelector(".read-mode-paper")).not.toBeNull();
    expect(container.textContent).toContain("朝の庭");

    // 読み返しから一覧へは、元のカードにフォーカスが戻る。
    act(() => click(findButton(container, copy.back)));
    act(() => vi.advanceTimersByTime(50));
    expect(cardCount()).toBe(3);
  });

  it("検索結果から開いた読み返しは「検索結果へ」戻り、検索語を保つ", () => {
    setValue(searchInput(), "朝");
    act(() => click(findButton(container, "朝の庭")));
    expect(findButton(container, copy.backToSearch)).toBeDefined();
    act(() => click(findButton(container, copy.backToSearch)));
    expect(searchInput().value).toBe("朝");
    expect(container.textContent).toContain(copy.searchResultCountLabel(2));
  });

  it("無題のメモは、本文の最初の行で見分けられ、保存されている題名は空のまま", () => {
    expect(container.textContent).toContain("電車の窓に映る朝");
    expect(storedNotes(storage).find((n) => n.id === "b")?.title).toBe("");
  });
});

describe("検索の解除（R18）", () => {
  it("検索を消した後は入力欄へフォーカスが戻り、そのまま次の語を書ける", () => {
    vi.useFakeTimers();
    const store: Record<string, string> = {
      [STORAGE_KEY_FOR_TESTING]: JSON.stringify([makeNote({ id: "a", title: "朝の庭" })]),
    };
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
          store[k] = v;
        },
        removeItem: (k: string) => {
          delete store[k];
        },
        clear: () => {},
      },
      configurable: true,
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<App />));

    const input = container.querySelector<HTMLInputElement>(".zanshin-search-input")!;
    setValue(input, "存在しない語");
    expect(container.textContent).toContain(copy.noSearchResult);
    expect(container.textContent).toContain(copy.noSearchResultHint);
    expect(container.textContent).toContain(copy.searchResultCountLabel(0));

    act(() => click(findButton(container, copy.clearSearch)));
    expect(input.value).toBe("");
    expect(document.activeElement).toBe(input);
    expect(container.textContent).toContain(copy.notesCountLabel(1));

    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });
});
