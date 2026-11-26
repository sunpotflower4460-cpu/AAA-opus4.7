/**
 * R23: 復元候補を内容で見比べる専用画面。
 * R34 / F05: 保護している候補が満杯でも、候補を守ったまま、確認→明示的な整理→保存完了へ進める。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Note } from "../types/note";
import { copy } from "../lib/i18n";
import {
  BACKUP_KEY_FOR_TESTING,
  RECOVERY_CONFLICT_BACKUP_KEY_FOR_TESTING,
  RECOVERY_CONFLICT_SECONDARY_BACKUP_KEY_FOR_TESTING,
  STORAGE_KEY_FOR_TESTING,
} from "../lib/storage";

const durable = vi.hoisted(() => ({
  available: vi.fn(),
  read: vi.fn(),
  persist: vi.fn(),
}));

vi.mock("../lib/nativeDurableSnapshot", () => ({
  isNativeDurableSnapshotAvailable: durable.available,
  readNativeDurableSnapshot: durable.read,
  persistNativeDurableSnapshot: durable.persist,
}));

import App from "../App";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "note-1",
    title: "メモ",
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

function editFirstNoteBody(container: HTMLElement, value: string) {
  act(() => click(findButton(container, "見つかった復元候補")));
  act(() => click(findButton(container, copy.editNote)));
  const textarea = container.querySelector("textarea");
  if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("textarea not found");
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  act(() => {
    setter?.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function findButton(container: HTMLElement, text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
    candidate.textContent?.includes(text),
  );
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Button not found: ${text}`);
  return button;
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("復元候補の比較と、保護候補満杯からの解決", () => {
  let storage: ReturnType<typeof mockLocalStorage>;
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    durable.available.mockReset();
    durable.read.mockReset();
    durable.persist.mockReset();
    durable.available.mockReturnValue(false);
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

  function render() {
    root = createRoot(container);
    act(() => root?.render(<App />));
  }

  it("localとnativeが異なる時、比較画面で件数・変更日・全文を読み、見ただけでは何も保存されない", async () => {
    durable.available.mockReturnValue(true);
    const local = [
      makeNote({ id: "a", title: "localの題名", body: "localの本文" }),
      makeNote({ id: "b", title: "", body: "題名なしの一行目\n二行目", updatedAt: "2026-08-29T03:04:00.000Z" }),
    ];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(local);
    // nativeは「すべて削除した」0件の有効な候補。無視してはいけない。
    durable.read.mockResolvedValue({ status: "available", notes: [] });
    render();
    await flushPromises();
    expect(container.textContent).toContain(copy.storageConflictTitle);
    const before = JSON.stringify(storage._store);

    act(() => click(findButton(container, copy.recoveryReviewOpen)));

    // 候補ごとの呼び名・件数（0件も明示）・変更日。
    expect(container.textContent).toContain(copy.recoveryCandidateStored);
    expect(container.textContent).toContain(copy.recoveryCandidateNative);
    expect(container.textContent).toContain(copy.recoveryReviewCount(2));
    expect(container.textContent).toContain(copy.recoveryReviewEmpty);
    expect(container.textContent).toContain("2026.08.29");

    // 題名なしのメモは本文の最初の非空行で識別でき、全文を読める。
    expect(container.textContent).toContain("題名なしの一行目");
    const bodyField = Array.from(container.querySelectorAll("textarea")).find(
      (el) => el.value === "題名なしの一行目\n二行目",
    );
    expect(bodyField).toBeDefined();

    // 候補を切り替えて読んでも、保存層・nativeには何も書かない。
    act(() => click(findButton(container, copy.recoveryCandidateNative)));
    act(() => click(findButton(container, copy.recoveryReviewClose)));
    expect(JSON.stringify(storage._store)).toBe(before);
    expect(durable.persist).not.toHaveBeenCalled();
    expect(container.textContent).toContain(copy.storageConflictTitle);
  });

  describe("保護候補が満杯（F05）", () => {
    const archive1 = [makeNote({ id: "archive-1", title: "退避1の題名", body: "退避1の本文" })];
    const archive2 = [makeNote({ id: "archive-2", title: "退避2の題名", body: "退避2の本文" })];
    const hidden = [makeNote({ id: "hidden", title: "見つかった復元候補", body: "復元候補の本文" })];

    function seedFull() {
      // primaryなし・backupあり（復元候補）・保護枠が2枠とも別世代。
      storage._store[BACKUP_KEY_FOR_TESTING] = JSON.stringify(hidden);
      storage._store[RECOVERY_CONFLICT_BACKUP_KEY_FOR_TESTING] = JSON.stringify(archive1);
      storage._store[RECOVERY_CONFLICT_SECONDARY_BACKUP_KEY_FOR_TESTING] = JSON.stringify(archive2);
    }

    it("通常の競合と区別して理由を伝え、候補も画面の内容も失わずに、確認→整理→保存完了へ進める", () => {
      seedFull();
      render();
      expect(container.textContent).toContain("見つかった復元候補");
      // 復元候補とは別の内容を、この画面で書き足してある。
      editFirstNoteBody(container, "この画面で書き足した本文");
      const screenNotes = [{ ...hidden[0], body: "この画面で書き足した本文" }];

      // 画面の内容で保存し直す → 満杯。
      act(() => click(findButton(container, copy.storageRecoverySave)));
      expect(container.querySelector('[data-testid="recovery-archive-full"]')?.textContent).toContain(
        copy.recoveryArchiveFull,
      );
      // 何も消えていない。
      expect(storage._store[RECOVERY_CONFLICT_BACKUP_KEY_FOR_TESTING]).toBe(JSON.stringify(archive1));
      expect(storage._store[RECOVERY_CONFLICT_SECONDARY_BACKUP_KEY_FOR_TESTING]).toBe(JSON.stringify(archive2));
      expect(storage._store[BACKUP_KEY_FOR_TESTING]).toBe(JSON.stringify(hidden));

      // 同じ保存ボタンを押し続けても解決しない（ループ）。確認画面へ進む。
      act(() => click(findButton(container, copy.storageRecoverySave)));
      expect(container.querySelector('[data-testid="recovery-archive-full"]')).not.toBeNull();

      act(() => click(findButton(container, copy.recoveryReviewOpen)));
      expect(container.textContent).toContain(copy.recoveryArchiveFullGuide);
      act(() => click(findButton(container, copy.recoveryCandidateProtected(1))));
      expect(container.textContent).toContain("退避1の題名");

      // 候補2を確認し、整理を選ぶ。確認ダイアログで対象と取り消せないことを示す。
      act(() => click(findButton(container, copy.recoveryCandidateProtected(2))));
      expect(container.textContent).toContain("退避2の題名");
      act(() => click(findButton(container, copy.recoveryDiscardAction)));
      expect(container.textContent).toContain(copy.recoveryDiscardConfirmBody(1));
      // キャンセルでは何も消えない。
      act(() => click(findButton(container, copy.recoveryDiscardCancel)));
      expect(storage._store[RECOVERY_CONFLICT_SECONDARY_BACKUP_KEY_FOR_TESTING]).toBe(JSON.stringify(archive2));

      act(() => click(findButton(container, copy.recoveryDiscardAction)));
      act(() => click(findButton(container, copy.recoveryDiscardConfirm)));
      expect(container.textContent).toContain(copy.recoveryDiscardDone);
      expect(storage._store[RECOVERY_CONFLICT_SECONDARY_BACKUP_KEY_FOR_TESTING]).toBeUndefined();
      // 選んでいない候補は無事。
      expect(storage._store[RECOVERY_CONFLICT_BACKUP_KEY_FOR_TESTING]).toBe(JSON.stringify(archive1));

      // 閉じて、この画面の内容を保存し直せる。
      act(() => click(findButton(container, copy.recoveryReviewClose)));
      act(() => click(findButton(container, copy.storageRecoverySave)));
      expect(container.querySelector('[data-testid="recovery-archive-full"]')).toBeNull();
      expect(container.textContent).not.toContain(copy.storageRecoveryTitle);
      expect(JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[]).toEqual([
        expect.objectContaining({ id: "hidden", body: "この画面で書き足した本文" }),
      ]);
      expect(screenNotes).toHaveLength(1);
      // 整理を選んでいない候補（退避1と、見つかっていた復元候補）は保護されたまま。
      const kept = [
        storage._store[RECOVERY_CONFLICT_BACKUP_KEY_FOR_TESTING],
        storage._store[RECOVERY_CONFLICT_SECONDARY_BACKUP_KEY_FOR_TESTING],
      ];
      expect(kept).toContain(JSON.stringify(archive1));
      expect(kept).toContain(JSON.stringify(hidden));
    });

    it("確認した後に保護候補の内容が変わっていたら、何も整理しない", () => {
      seedFull();
      render();
      editFirstNoteBody(container, "この画面で書き足した本文");
      act(() => click(findButton(container, copy.storageRecoverySave)));
      act(() => click(findButton(container, copy.recoveryReviewOpen)));
      act(() => click(findButton(container, copy.recoveryCandidateProtected(2))));
      act(() => click(findButton(container, copy.recoveryDiscardAction)));

      // 確認中に別の画面などが同じ枠の内容を変えた。
      const changed = JSON.stringify([makeNote({ id: "other", title: "別の内容" })]);
      storage._store[RECOVERY_CONFLICT_SECONDARY_BACKUP_KEY_FOR_TESTING] = changed;
      act(() => click(findButton(container, copy.recoveryDiscardConfirm)));

      expect(container.textContent).toContain(copy.recoveryDiscardChanged);
      expect(storage._store[RECOVERY_CONFLICT_SECONDARY_BACKUP_KEY_FOR_TESTING]).toBe(changed);
    });
  });
});
