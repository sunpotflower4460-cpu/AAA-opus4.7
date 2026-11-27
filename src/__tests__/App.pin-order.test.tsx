/**
 * R20 / R22 / D07 / D08: 先頭固定は「先頭のグループに留める」操作。
 * updatedAt は題名・本文・印を含むメモ全体の変更時刻、作成日（日付印の元の createdAt）は変わらない。
 * 並びは「固定したメモを先に、それぞれ変更の新しい順」。保存・再読込でも印と並びが残る。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { STORAGE_KEY_FOR_TESTING } from "../lib/storage";
import { messages } from "../lib/i18n";
import type { Note } from "../types/note";

const copy = messages.ja;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function note(id: string, title: string, updatedAt: string, extra: Partial<Note> = {}): Note {
  return {
    id,
    title,
    body: "本文",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt,
    isFavorite: false,
    ...extra,
  };
}

function click(element: Element) {
  element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

describe("先頭固定と並び", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;
  let store: Record<string, string>;

  const seeded = [
    note("new", "いちばん新しい", "2026-06-03T00:00:00.000Z"),
    note("mid", "真ん中", "2026-06-02T00:00:00.000Z"),
    note("old", "いちばん古い", "2026-06-01T00:00:00.000Z"),
  ];

  function mount() {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root?.render(<App />));
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T00:00:00.000Z"));
    store = { [STORAGE_KEY_FOR_TESTING]: JSON.stringify(seeded) };
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
    mount();
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container.remove();
    vi.useRealTimers();
  });

  const order = () =>
    Array.from(container.querySelectorAll<HTMLElement>("[data-note-id]")).map((el) => el.dataset.noteId);
  const stored = () => JSON.parse(store[STORAGE_KEY_FOR_TESTING]) as Note[];

  function toggleFromEditor(title: string, label: string) {
    const card = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes(title))!;
    act(() => click(card));
    act(() => click(Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes(copy.editNote))!));
    const pin = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
    act(() => click(pin));
    act(() => vi.advanceTimersByTime(1_000));
    act(() => click(container.querySelector<HTMLButtonElement>(`button[aria-label="${copy.backToRead}"]`)!));
    act(() => click(container.querySelector<HTMLButtonElement>(`button[aria-label="${copy.back}"]`)!));
  }

  it("固定すると先頭グループへ移り、変更日時が更新され、作成日は変わらず、保存される", () => {
    expect(order()).toEqual(["new", "mid", "old"]);
    toggleFromEditor("いちばん古い", copy.favoriteOn);

    expect(order()).toEqual(["old", "new", "mid"]);
    const saved = stored().find((n) => n.id === "old")!;
    expect(saved.isFavorite).toBe(true);
    expect(saved.createdAt).toBe("2026-01-01T00:00:00.000Z"); // 日付印の元（作成日）は変わらない
    expect(saved.updatedAt).toBe("2026-06-10T00:00:00.000Z"); // 印の切替も「変更」

    // 再読込（再起動）後も、印と並びが残る。
    act(() => root?.unmount());
    container.remove();
    mount();
    expect(order()).toEqual(["old", "new", "mid"]);
  });

  it("固定を解除すると、通常グループの中で『変更の新しい順』の位置へ戻る（元の位置へ戻すとは約束しない）", () => {
    toggleFromEditor("いちばん古い", copy.favoriteOn);
    toggleFromEditor("いちばん古い", copy.favoriteOff);
    // 解除も変更なので、いま一番新しい変更として通常グループの先頭になる。
    expect(order()).toEqual(["old", "new", "mid"]);
    expect(stored().find((n) => n.id === "old")!.isFavorite).toBe(false);
  });

  it("固定した複数のメモは、固定グループの中でも変更の新しい順", () => {
    toggleFromEditor("いちばん新しい", copy.favoriteOn);
    vi.setSystemTime(new Date("2026-06-11T00:00:00.000Z"));
    toggleFromEditor("真ん中", copy.favoriteOn);
    expect(order().slice(0, 2)).toEqual(["mid", "new"]);
    expect(order()[2]).toBe("old");
  });

  it("操作名と状態は色だけに頼らず、aria-pressed と名前で伝える", () => {
    const card = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes("真ん中"))!;
    act(() => click(card));
    act(() => click(Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes(copy.editNote))!));
    const pin = container.querySelector<HTMLButtonElement>(`button[aria-label="${copy.favoriteOn}"]`)!;
    expect(copy.favoriteOn).toBe("先頭に留める");
    expect(pin.getAttribute("aria-pressed")).toBe("false");
    act(() => click(pin));
    const pressed = container.querySelector<HTMLButtonElement>(`button[aria-label="${copy.favoriteOff}"]`)!;
    expect(pressed.getAttribute("aria-pressed")).toBe("true");
  });
});
