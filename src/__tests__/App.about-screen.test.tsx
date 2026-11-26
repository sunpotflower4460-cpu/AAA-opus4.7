/**
 * R04 / D15: ホームの「このアプリについて」から、保存方法・プライバシー・問い合わせ・バージョンへ届き、
 * 開いて閉じても検索語・一覧・未保存内容を失わない。本文は同梱で、通信を必要としない。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { copy } from "../lib/i18n";
import { STORAGE_KEY_FOR_TESTING } from "../lib/storage";
import type { Note } from "../types/note";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function click(element: Element) {
  element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function find(container: HTMLElement, text: string): HTMLElement {
  const el = Array.from(container.querySelectorAll("button, a")).find((c) => c.textContent?.includes(text));
  if (!(el instanceof HTMLElement)) throw new Error(`not found: ${text}`);
  return el;
}

describe("このアプリについて", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;
  let store: Record<string, string>;
  const fetchSpy = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    store = {};
    const notes: Note[] = [
      { id: "a", title: "朝の庭", body: "霜", createdAt: "2026-08-28T00:00:00.000Z", updatedAt: "2026-08-28T00:00:00.000Z", isFavorite: false },
    ];
    store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(notes);
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
    fetchSpy.mockReset();
    vi.stubGlobal("fetch", fetchSpy);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root?.render(<App />));
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("ホームから開け、保存・削除・先頭固定・プライバシー・問い合わせ・バージョンの情報がある", () => {
    act(() => click(find(container, copy.aboutOpen)));
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const text = dialog.textContent ?? "";
    for (const expected of [
      copy.aboutStorageTitle,
      "クラウド同期はありません",
      "別の端末や機種変更後に必ず戻せる仕組みではありません",
      copy.aboutDeleteTitle,
      "10秒間",
      copy.aboutPinTitle,
      copy.aboutPrivacyTitle,
      "外部のサーバーへは送信しません",
      copy.aboutSupportTitle,
      "投稿は公開されます",
      copy.aboutVersion,
    ]) {
      expect(text).toContain(expected);
    }
    // 「第三者SDKは一切ない」とは書かない（Capacitor を使っている）。広告・分析・追跡は使わないと正確に伝える。
    expect(text).toContain("Capacitor");
    expect(text).not.toMatch(/第三者.*(SDK|ＳＤＫ).*(ない|なし|一切)/);
    // 問い合わせはGitHub Issues。公開URLが未確定の間、仮のページURLを導線にしない。
    const link = find(container, copy.aboutSupportLink) as HTMLAnchorElement;
    expect(link.href).toContain("github.com");
    expect(link.rel).toContain("noopener");
  });

  it("開いて閉じても、検索語と一覧の状態が変わらず、通信も発生しない（機内モードでも読める）", () => {
    const search = container.querySelector<HTMLInputElement>(".zanshin-search-input")!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    act(() => {
      setter?.call(search, "朝");
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const before = JSON.stringify(store);

    act(() => click(find(container, copy.aboutOpen)));
    act(() => click(find(container, copy.aboutClose)));

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.querySelector<HTMLInputElement>(".zanshin-search-input")!.value).toBe("朝");
    expect(JSON.stringify(store)).toBe(before);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("Escape で閉じられ、閉じる方法が1つに限られない", () => {
    act(() => click(find(container, copy.aboutOpen)));
    const dialog = container.querySelector('[role="dialog"]')!;
    act(() => {
      dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
