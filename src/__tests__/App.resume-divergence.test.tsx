/**
 * R03: 復帰の3入口（pageshow / visibilitychange / native active）で、
 * 既知の正本と異なる「正常な形式のlocal版」を見つけても、nativeと比較する前に
 * 採用もnativeへの書込みもしない。
 *
 * 監査用の「問題が存在すること」の確認ではなく、望ましい挙動（比較→競合 or 解放）を検証する。
 * 入口はAppの実イベント接続（window/document/Capacitor lifecycleの購読）を通す。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Note } from "../types/note";
import { copy } from "../lib/i18n";
import { STORAGE_KEY_FOR_TESTING } from "../lib/storage";

const durable = vi.hoisted(() => ({
  available: vi.fn(),
  read: vi.fn(),
  persist: vi.fn(),
}));

const lifecycle = vi.hoisted(() => ({
  listener: null as null | ((state: { isActive: boolean }) => void),
}));

vi.mock("../lib/nativeDurableSnapshot", () => ({
  isNativeDurableSnapshotAvailable: durable.available,
  readNativeDurableSnapshot: durable.read,
  persistNativeDurableSnapshot: durable.persist,
}));

vi.mock("../lib/nativeAppLifecycle", () => ({
  subscribeToNativeAppState: (listener: (state: { isActive: boolean }) => void) => {
    lifecycle.listener = listener;
    return () => {
      lifecycle.listener = null;
    };
  },
}));

import App from "../App";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "note-1",
    title: "既知の正本",
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

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

type Entry = "pageshow" | "visibilitychange" | "native-active";

function fireResume(entry: Entry) {
  act(() => {
    if (entry === "pageshow") {
      window.dispatchEvent(new Event("pageshow"));
    } else if (entry === "visibilitychange") {
      Object.defineProperty(document, "visibilityState", {
        value: "visible",
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    } else {
      if (!lifecycle.listener) throw new Error("native lifecycle listener is not registered");
      lifecycle.listener({ isActive: true });
    }
  });
}

const ENTRIES: Entry[] = ["pageshow", "visibilitychange", "native-active"];

describe("復帰の入口でlocalの異なる有効版を比較前に採用しない（R03）", () => {
  let storage: ReturnType<typeof mockLocalStorage>;
  let container: HTMLDivElement;
  let root: Root | null = null;

  const known = [makeNote({ title: "既知の正本" })];

  beforeEach(() => {
    vi.useFakeTimers();
    lifecycle.listener = null;
    durable.available.mockReset();
    durable.read.mockReset();
    durable.persist.mockReset();
    durable.available.mockReturnValue(true);
    durable.persist.mockResolvedValue(true);
    storage = mockLocalStorage();
    Object.defineProperty(window, "localStorage", { value: storage, configurable: true });
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container.remove();
    vi.useRealTimers();
  });

  async function startWithKnownVersion() {
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(known);
    durable.read.mockResolvedValue({ status: "available", notes: known });
    root = createRoot(container);
    act(() => root?.render(<App />));
    await flushPromises();
    expect(container.textContent).toContain("既知の正本");
    expect(container.textContent).not.toContain(copy.storageConflictTitle);
    durable.persist.mockClear();
    durable.read.mockClear();
  }

  for (const entry of ENTRIES) {
    describe(`入口: ${entry}`, () => {
      it("localだけが別の有効版に変わっていてnativeが既知版のままなら、採用もnative上書きもせず比較へ送る", async () => {
        await startWithKnownVersion();

        const stale = [makeNote({ title: "差し替わったlocal", body: "古い版" })];
        storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(stale);

        fireResume(entry);
        await flushPromises();

        // nativeを実際に読み直して比較している。
        expect(durable.read).toHaveBeenCalled();
        // 比較前にも比較後にも、nativeへ異なる版を書いていない。
        expect(durable.persist).not.toHaveBeenCalled();
        // 異なる有効版は利用者の明示選択に回る。
        expect(container.textContent).toContain(copy.storageConflictTitle);
        // どちらの候補も内容を失っていない（localは保存層に残り、nativeは別候補として提示）。
        expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBe(JSON.stringify(stale));
        expect(container.textContent).toContain(copy.nativeRecoveryAlternativeNotice(known.length));
      });

      it("localの新しい版とnativeが同一内容なら競合にせず、安全確認後に採用する", async () => {
        await startWithKnownVersion();

        const updated = [makeNote({ title: "同期済みの新しい版", updatedAt: "2026-08-28T01:00:00.000Z" })];
        storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(updated);
        durable.read.mockResolvedValue({ status: "available", notes: updated });

        fireResume(entry);
        await flushPromises();

        expect(durable.read).toHaveBeenCalled();
        expect(container.textContent).toContain("同期済みの新しい版");
        expect(container.textContent).not.toContain(copy.storageConflictTitle);
      });

      it("native読込に失敗したら存在しないものとして進めず、異なるlocalを採用せずnativeも上書きしない", async () => {
        await startWithKnownVersion();

        const other = [makeNote({ title: "確認できないlocal" })];
        storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(other);
        durable.read.mockResolvedValue({ status: "error" });

        fireResume(entry);
        await flushPromises();

        expect(durable.persist).not.toHaveBeenCalled();
        expect(container.textContent).toContain(copy.nativeRecoveryReadError);
        expect(container.textContent).not.toContain("確認できないlocal");
      });

      it("localが既知の版と同じなら、余計な比較や競合を作らない", async () => {
        await startWithKnownVersion();

        fireResume(entry);
        await flushPromises();

        expect(container.textContent).not.toContain(copy.storageConflictTitle);
        expect(container.textContent).not.toContain(copy.nativeRecoveryReadError);
        expect(container.textContent).toContain("既知の正本");
      });
    });
  }
});
