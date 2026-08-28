import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import {
  BACKUP_KEY_FOR_TESTING,
  STORAGE_KEY_FOR_TESTING,
} from "../lib/storage";
import { copy } from "../lib/i18n";
import type { Note } from "../types/note";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeNote(): Note {
  return {
    id: "recovered-note",
    title: "復元されたメモ",
    body: "復元された本文",
    createdAt: "2026-08-28T00:00:00.000Z",
    updatedAt: "2026-08-28T00:00:00.000Z",
    isFavorite: false,
    locale: "ja",
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

function findButton(container: HTMLElement, text: string): HTMLButtonElement | null {
  const match = Array.from(container.querySelectorAll("button")).find((button) =>
    button.textContent?.includes(text),
  );
  return match instanceof HTMLButtonElement ? match : null;
}

function click(button: HTMLButtonElement | null) {
  if (!button) throw new Error("button not found");
  button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function changeTextarea(container: HTMLElement, value: string) {
  const textarea = container.querySelector("textarea");
  if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("textarea not found");
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(
    textarea,
    value,
  );
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("App corrupt recovery conflict", () => {
  let storage: ReturnType<typeof mockLocalStorage>;
  let container: HTMLDivElement;
  let root: Root | null;

  beforeEach(() => {
    storage = mockLocalStorage();
    Object.defineProperty(window, "localStorage", {
      value: storage,
      writable: true,
      configurable: true,
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = null;
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container.remove();
  });

  function renderRecovery(primaryRaw?: string) {
    if (primaryRaw !== undefined) {
      storage.setItem(STORAGE_KEY_FOR_TESTING, primaryRaw);
    }
    storage.setItem(BACKUP_KEY_FOR_TESTING, JSON.stringify([makeNote()]));

    root = createRoot(container);
    act(() => {
      root?.render(
        <StrictMode>
          <App />
        </StrictMode>,
      );
    });
  }

  it("復元候補がある起動直後から明示保存アクションを表示し、編集を要求しない", () => {
    renderRecovery("{ broken primary");

    expect(container.textContent).toContain(copy.storageRecoveryTitle);
    expect(container.textContent).toContain("復元候補を1件表示しています");
    expect(findButton(container, copy.storageConflictLoad)).toBeNull();
    expect(findButton(container, copy.storageRecoverySave)).not.toBeNull();

    act(() => click(findButton(container, copy.storageRecoverySave)));

    const saved = JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[];
    expect(saved).toHaveLength(1);
    expect(saved[0].id).toBe("recovered-note");
    expect(container.textContent).not.toContain(copy.storageRecoveryTitle);
  });

  it("primary が消失して backup だけ残った場合も同じ復元導線を表示する", () => {
    renderRecovery();

    expect(container.textContent).toContain(copy.storageRecoveryTitle);
    expect(container.textContent).toContain("復元されたメモ");
    expect(findButton(container, copy.storageRecoverySave)).not.toBeNull();
  });

  it("復元確定前に編集しても自動保存せず、エディタへ保存停止理由を表示する", () => {
    const corruptRaw = "{ broken primary";
    renderRecovery(corruptRaw);

    act(() => click(findButton(container, "復元されたメモ")));
    act(() => click(findButton(container, copy.editNote)));
    act(() => changeTextarea(container, "復元内容へ追記"));

    expect(container.textContent).toContain(copy.saveRecovery);
    expect(container.textContent).not.toContain(copy.saving);

    act(() => window.dispatchEvent(new Event("pagehide")));

    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBe(corruptRaw);
    expect(container.textContent).toContain(copy.storageConflictRecoveryBody);
    expect(findButton(container, copy.storageConflictLoad)).toBeNull();
    expect(findButton(container, copy.storageRecoverySave)).not.toBeNull();
  });
});
