/**
 * R32: 画面キーボードが実際に開いた時だけ、編集領域を詰める。外部キーボードでは詰めない。
 * 実際の見える行数・カーソル位置は iOS の実機で測る必要がある（ここでは検出と状態のみ検証）。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { copy } from "../lib/i18n";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class FakeVisualViewport extends EventTarget {
  height = 800;
}

describe("キーボード表示中の編集領域", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;
  let viewport: FakeVisualViewport;

  beforeEach(() => {
    vi.useFakeTimers();
    const store: Record<string, string> = {};
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
    viewport = new FakeVisualViewport();
    Object.defineProperty(window, "visualViewport", { value: viewport, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root?.render(<App />));
    const create = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes(copy.newNote),
    )!;
    act(() => create.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container.remove();
    vi.useRealTimers();
    Object.defineProperty(window, "visualViewport", { value: undefined, configurable: true });
  });

  const editor = () => container.querySelector<HTMLElement>(".zanshin-editor")!;
  const body = () => container.querySelector<HTMLTextAreaElement>("textarea.writing-textarea")!;

  function shrink(by: number) {
    act(() => {
      viewport.height = 800 - by;
      viewport.dispatchEvent(new Event("resize"));
    });
  }

  it("入力欄にフォーカスがあり、視覚ビューポートが十分に縮んだ時だけ「開いている」とみなす", () => {
    act(() => body().focus());
    expect(editor().dataset.keyboard).toBe("closed");
    shrink(300);
    expect(editor().dataset.keyboard).toBe("open");
    expect(body().style.minHeight).toBe(""); // 最低高さ 42dvh を外す
    shrink(0);
    expect(editor().dataset.keyboard).toBe("closed");
    expect(body().style.minHeight).toBe("42dvh");
  });

  it("外部キーボード（画面が縮まない）では、フォーカスだけでは詰めない", () => {
    act(() => body().focus());
    shrink(20); // ブラウザのUIバー程度の伸縮
    expect(editor().dataset.keyboard).toBe("closed");
  });

  it("入力欄にフォーカスが無ければ、ビューポートが縮んでも詰めない", () => {
    act(() => (document.activeElement as HTMLElement | null)?.blur());
    shrink(300);
    expect(editor().dataset.keyboard).toBe("closed");
  });

  it("キーボードが開閉しても、本文のDOM・値・選択範囲を維持する", () => {
    act(() => body().focus());
    const node = body();
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    act(() => {
      setter?.call(node, "入力途中の本文");
      node.dispatchEvent(new Event("input", { bubbles: true }));
    });
    node.setSelectionRange(2, 4);
    shrink(300);
    expect(body()).toBe(node); // 同じ要素のまま（変換中のDOM差し替えをしない）
    expect(body().value).toBe("入力途中の本文");
    expect([body().selectionStart, body().selectionEnd]).toEqual([2, 4]);
    shrink(0);
    expect(body()).toBe(node);
  });
});
