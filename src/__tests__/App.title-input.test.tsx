/**
 * R11 / D02: 題名は任意で、長くても折り返して全文を編集でき、本人の原文を勝手に整形しない。
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
    clear: vi.fn(),
    get _store() {
      return store;
    },
  };
}

function click(element: Element) {
  element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function setValue(el: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  act(() => {
    setter?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("題名の入力", () => {
  let storage: ReturnType<typeof mockLocalStorage>;
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    storage = mockLocalStorage();
    Object.defineProperty(window, "localStorage", { value: storage, writable: true, configurable: true });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root?.render(<App />));
    const create = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes(copy.newNote),
    )!;
    act(() => click(create));
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container.remove();
    vi.useRealTimers();
  });

  const title = () => container.querySelector<HTMLTextAreaElement>("textarea.note-title-input")!;
  const body = () => container.querySelector<HTMLTextAreaElement>("textarea.writing-textarea")!;

  it("題名欄は「タイトル（任意）」と名付けられ、題名なしでも本文だけで保存できる", () => {
    expect(title().labels?.[0]?.textContent).toBe(copy.titlePlaceholder);
    expect(copy.titlePlaceholder).toBe("タイトル（任意）");
    setValue(body(), "題名なしの一言");
    act(() => vi.advanceTimersByTime(1_000));
    const saved = JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[];
    expect(saved[0]).toMatchObject({ title: "", body: "題名なしの一言" });
  });

  it("200文字の題名・URL・絵文字を、そのまま全文保存できる", () => {
    const long = `${"長い題名の一部".repeat(20)}https://example.com/a/b?c=d🌙`.slice(0, 200);
    setValue(title(), long);
    act(() => vi.advanceTimersByTime(1_000));
    expect(title().value).toBe(long);
    const saved = JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[];
    expect(saved[0].title).toBe(long);
  });

  it("Enter は本文へ移動し、題名へ改行を入れない", () => {
    setValue(title(), "題名");
    const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    act(() => {
      title().dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(body());
    expect(title().value).toBe("題名");
  });

  it("日本語変換中の Enter（確定操作）は横取りしない", () => {
    setValue(title(), "かんじ");
    title().focus();
    const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, isComposing: true });
    act(() => {
      title().dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(title());
  });

  it("貼り付けた改行は空白にして、題名を1行の名前に保つ（以前の入力欄と同じ）", () => {
    setValue(title(), "一行目\n二行目");
    expect(title().value).toBe("一行目 二行目");
  });
});
