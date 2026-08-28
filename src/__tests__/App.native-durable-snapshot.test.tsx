import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Note } from "../types/note";
import { copy } from "../lib/i18n";
import { BACKUP_KEY_FOR_TESTING, STORAGE_KEY_FOR_TESTING } from "../lib/storage";

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
    title: "元のメモ",
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
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { Object.keys(store).forEach((key) => delete store[key]); }),
    get _store() { return store; },
  };
}

function click(element: Element) {
  element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function findButton(container: HTMLElement, text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
    candidate.textContent?.includes(text),
  );
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Button not found: ${text}`);
  return button;
}

function hasButton(container: HTMLElement, text: string): boolean {
  return Array.from(container.querySelectorAll("button")).some((candidate) =>
    candidate.textContent?.includes(text),
  );
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("App native durable snapshot", () => {
  let storage: ReturnType<typeof mockLocalStorage>;
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    durable.available.mockReset();
    durable.read.mockReset();
    durable.persist.mockReset();
    durable.available.mockReturnValue(true);
    durable.read.mockResolvedValue({ status: "missing" });
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

  function renderApp() {
    root = createRoot(container);
    act(() => root?.render(<App />));
  }

  it("localStorage primary消失時はnative snapshotを画面に復元候補として表示し自動上書きしない", async () => {
    const recovered = [makeNote({ title: "nativeから救出" })];
    durable.read.mockResolvedValue({ status: "available", notes: recovered });
    renderApp();
    await flushPromises();

    expect(container.textContent).toContain("nativeから救出");
    expect(container.textContent).toContain(copy.storageRecoveryTitle);
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBeUndefined();
    expect(durable.persist).not.toHaveBeenCalled();

    act(() => click(findButton(container, copy.storageRecoverySave)));
    await flushPromises();

    expect(JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[]).toEqual(recovered);
    expect(durable.persist).toHaveBeenCalledWith(recovered);
  });

  it("native復旧読込が遅くても確認完了前の新規編集とautosaveを開始しない", async () => {
    const recovered = [makeNote({ title: "遅れて見つかったnative" })];
    let resolveRead!: (value: { status: "available"; notes: Note[] }) => void;
    durable.read.mockReturnValue(
      new Promise((resolve) => {
        resolveRead = resolve;
      }),
    );

    renderApp();
    expect(container.textContent).toContain(copy.nativeRecoveryChecking);

    act(() => click(findButton(container, copy.emptyAction)));
    act(() => vi.advanceTimersByTime(1_000));
    await flushPromises();

    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBeUndefined();
    expect(container.querySelector("textarea")).toBeNull();
    expect(durable.persist).not.toHaveBeenCalled();

    await act(async () => {
      resolveRead({ status: "available", notes: recovered });
      await Promise.resolve();
    });
    await flushPromises();

    expect(container.textContent).toContain("遅れて見つかったnative");
    expect(container.textContent).toContain(copy.storageRecoveryTitle);
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBeUndefined();
  });

  it("native読込障害はfresh install扱いせず編集を止め、retryでmissing確認後に解放する", async () => {
    durable.read
      .mockResolvedValueOnce({ status: "error" })
      .mockResolvedValue({ status: "missing" });

    renderApp();
    await flushPromises();

    expect(container.textContent).toContain(copy.nativeRecoveryReadError);
    expect(hasButton(container, copy.nativeRecoveryRetry)).toBe(true);
    act(() => click(findButton(container, copy.emptyAction)));
    act(() => vi.advanceTimersByTime(1_000));
    await flushPromises();
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBeUndefined();
    expect(container.querySelector("textarea")).toBeNull();

    act(() => click(findButton(container, copy.nativeRecoveryRetry)));
    await flushPromises();
    expect(container.textContent).not.toContain(copy.nativeRecoveryReadError);

    act(() => click(findButton(container, copy.emptyAction)));
    expect(container.querySelector("textarea")).not.toBeNull();
    act(() => vi.advanceTimersByTime(500));
    await flushPromises();
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBeDefined();
  });

  it("native側の空配列も意図的な全削除状態として明示復旧候補にする", async () => {
    durable.read.mockResolvedValue({ status: "available", notes: [] });
    renderApp();
    await flushPromises();

    expect(container.textContent).toContain(copy.storageRecoveryTitle);
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBeUndefined();
    act(() => click(findButton(container, copy.storageRecoverySave)));
    await flushPromises();
    expect(JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[]).toEqual([]);
  });

  it("既存の正常localStorageもnative missing確認後にだけ耐久層へ移行する", async () => {
    const existing = [makeNote()];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(existing);
    renderApp();
    await flushPromises();

    expect(durable.read).toHaveBeenCalledTimes(1);
    expect(durable.persist).toHaveBeenCalledWith(existing);
    expect(durable.read.mock.invocationCallOrder[0]).toBeLessThan(
      durable.persist.mock.invocationCallOrder[0],
    );
    expect(container.textContent).not.toContain(copy.nativeRecoveryReadError);
  });

  it("正常localと異なるnative snapshotは起動だけで上書きせず別候補として保持する", async () => {
    const local = [makeNote({ title: "localの正本" })];
    const native = [
      makeNote({
        title: "nativeの別世代",
        body: "localにはない内容",
        updatedAt: "2026-08-28T00:05:00.000Z",
      }),
    ];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(local);
    durable.read.mockResolvedValue({ status: "available", notes: native });

    renderApp();
    await flushPromises();

    expect(container.textContent).toContain("localの正本");
    expect(container.textContent).toContain(copy.storageConflictTitle);
    expect(container.textContent).toContain(copy.nativeRecoveryAlternativeNotice(native.length));
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBe(JSON.stringify(local));
    expect(durable.persist).not.toHaveBeenCalled();

    act(() => click(findButton(container, copy.nativeRecoveryShowAlternative)));
    expect(container.textContent).toContain("nativeの別世代");
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBe(JSON.stringify(local));
    expect(durable.persist).not.toHaveBeenCalled();

    act(() => click(findButton(container, copy.storageConflictOverwrite)));
    await flushPromises();

    expect(JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[]).toEqual(native);
    expect(durable.persist).toHaveBeenCalledWith(native);
    expect(container.textContent).not.toContain(copy.storageConflictTitle);
  });

  it("正常localとnativeが異なる起動競合で保存済みlocalを明示採用できる", async () => {
    const local = [makeNote({ title: "採用するlocal" })];
    const native = [makeNote({ title: "採用しないnative" })];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(local);
    durable.read.mockResolvedValue({ status: "available", notes: native });

    renderApp();
    await flushPromises();
    expect(durable.persist).not.toHaveBeenCalled();

    act(() => click(findButton(container, copy.storageConflictLoad)));
    await flushPromises();

    expect(JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[]).toEqual(local);
    expect(durable.persist).toHaveBeenCalledWith(local);
    expect(container.textContent).not.toContain(copy.storageConflictTitle);
  });

  it("正常localがあってもnative読込障害中はlocalでnativeを上書きせずretryまでgateする", async () => {
    const local = [makeNote({ title: "読めるlocal" })];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(local);
    durable.read
      .mockResolvedValueOnce({ status: "error" })
      .mockResolvedValue({ status: "missing" });

    renderApp();
    await flushPromises();

    expect(container.textContent).toContain(copy.nativeRecoveryReadError);
    expect(durable.persist).not.toHaveBeenCalled();
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBe(JSON.stringify(local));

    act(() => click(findButton(container, copy.nativeRecoveryRetry)));
    await flushPromises();

    expect(container.textContent).not.toContain(copy.nativeRecoveryReadError);
    expect(durable.persist).toHaveBeenCalledWith(local);
  });

  it("通常autosave成功後は最新snapshotをnative側にも保存する", async () => {
    const existing = [makeNote()];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(existing);
    renderApp();
    await flushPromises();
    durable.persist.mockClear();

    act(() => click(findButton(container, "元のメモ")));
    act(() => click(findButton(container, copy.editNote)));
    const textarea = container.querySelector("textarea");
    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("textarea not found");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    act(() => {
      setter?.call(textarea, "nativeにも残す本文");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => vi.advanceTimersByTime(500));
    await flushPromises();

    const latest = JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[];
    expect(latest[0].body).toBe("nativeにも残す本文");
    expect(durable.persist).toHaveBeenCalledWith(latest);
  });

  it("clean状態で正常な外部保存版へ追従したらnative耐久層も同じ正本へ更新する", async () => {
    const existing = [makeNote()];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(existing);
    renderApp();
    await flushPromises();
    durable.persist.mockClear();

    const remote = [makeNote({ title: "外部の正本", updatedAt: "2026-08-28T00:01:00.000Z" })];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(remote);
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: STORAGE_KEY_FOR_TESTING, newValue: JSON.stringify(remote) }),
      );
    });
    await flushPromises();

    expect(container.textContent).toContain("外部の正本");
    expect(durable.persist).toHaveBeenCalledWith(remote);
  });

  it("競合で保存済み版を明示採用したら捨てたlocal版をnative復元候補に残さない", async () => {
    const existing = [makeNote()];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(existing);
    renderApp();
    await flushPromises();
    durable.persist.mockClear();

    act(() => click(findButton(container, "元のメモ")));
    act(() => click(findButton(container, copy.editNote)));
    const textarea = container.querySelector("textarea");
    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("textarea not found");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    act(() => {
      setter?.call(textarea, "捨てる未保存編集");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const remote = [makeNote({ title: "採用する保存済み版", updatedAt: "2026-08-28T00:02:00.000Z" })];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(remote);
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: STORAGE_KEY_FOR_TESTING, newValue: JSON.stringify(remote) }),
      );
    });
    expect(container.textContent).toContain(copy.storageConflictTitle);
    expect(durable.persist).not.toHaveBeenCalled();

    act(() => click(findButton(container, copy.storageConflictLoad)));
    await flushPromises();

    expect(JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[]).toEqual(remote);
    expect(container.textContent).not.toContain(copy.storageConflictTitle);
    expect(durable.persist).toHaveBeenCalledWith(remote);
  });

  it("native予備保存失敗を非致命warningとして表示し、retry成功で消す", async () => {
    const existing = [makeNote()];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(existing);
    durable.persist.mockResolvedValueOnce(false).mockResolvedValue(true);
    renderApp();
    await flushPromises();

    expect(container.querySelector('[data-testid="native-backup-failure"]')).not.toBeNull();
    expect(container.textContent).toContain(copy.nativeBackupError);

    act(() => click(findButton(container, copy.nativeBackupRetry)));
    await flushPromises();

    expect(container.querySelector('[data-testid="native-backup-failure"]')).toBeNull();
  });

  it("native予備保存Retryは編集開始時に即座に無効化しinert buttonを残さない", async () => {
    const existing = [makeNote()];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(existing);
    durable.persist.mockResolvedValueOnce(false).mockResolvedValue(true);
    renderApp();
    await flushPromises();
    expect(hasButton(container, copy.nativeBackupRetry)).toBe(true);

    act(() => click(findButton(container, "元のメモ")));
    act(() => click(findButton(container, copy.editNote)));
    const textarea = container.querySelector("textarea");
    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("textarea not found");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    act(() => {
      setter?.call(textarea, "dirtyにする");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="native-backup-failure"]')).not.toBeNull();
    expect(hasButton(container, copy.nativeBackupRetry)).toBe(false);
  });


  it("local復元確認中にprimaryが正常化したら候補と同一内容でもrecovery状態を完全解除する", async () => {
    const candidate = [makeNote({ id: "recovered", title: "復旧候補と同じ正本" })];
    storage._store[BACKUP_KEY_FOR_TESTING] = JSON.stringify(candidate);
    let resolveNative: ((value: { status: "missing" }) => void) | undefined;
    durable.read.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveNative = resolve;
        }),
    );

    renderApp();
    expect(container.querySelector('[data-testid="native-recovery-checking"]')).not.toBeNull();
    expect(container.textContent).toContain("復旧候補と同じ正本");

    // probe本体はqueueMicrotaskで開始される。resolver生成前にresolveするとテストだけが
    // 永久pendingになるため、実際にnative readが始まったことを確認してから競合を再現する。
    await flushPromises();
    expect(durable.read).toHaveBeenCalledTimes(1);
    expect(resolveNative).toBeDefined();

    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(candidate);
    await act(async () => {
      resolveNative?.({ status: "missing" });
      await Promise.resolve();
    });
    await flushPromises();

    expect(container.querySelector('[data-testid="native-recovery-checking"]')).toBeNull();
    expect(container.textContent).not.toContain(copy.storageRecoveryTitle);
    expect(hasButton(container, copy.storageRecoverySave)).toBe(false);
    expect(durable.persist).toHaveBeenCalledWith(candidate);

    act(() => click(findButton(container, "復旧候補と同じ正本")));
    act(() => click(findButton(container, copy.editNote)));
    const textarea = container.querySelector("textarea");
    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("textarea not found");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    act(() => {
      setter?.call(textarea, "正常化後に編集できる");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      vi.advanceTimersByTime(500);
    });
    await flushPromises();

    const saved = JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[];
    expect(saved[0]?.body).toBe("正常化後に編集できる");
  });

  it("localの空backupも全削除済み候補としてnative別世代と切り替えて選べる", async () => {
    const nativeCandidate = [makeNote({ id: "native-existing", title: "nativeに残るメモ" })];
    storage._store[BACKUP_KEY_FOR_TESTING] = JSON.stringify([]);
    durable.read.mockResolvedValue({ status: "available", notes: nativeCandidate });

    renderApp();
    expect(container.querySelector('[data-testid="native-recovery-checking"]')).not.toBeNull();
    await flushPromises();

    expect(container.textContent).toContain(copy.storageRecoveryTitle);
    expect(container.textContent).not.toContain("nativeに残るメモ");
    expect(hasButton(container, copy.nativeRecoveryShowAlternative)).toBe(true);
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBeUndefined();

    act(() => click(findButton(container, copy.nativeRecoveryShowAlternative)));
    expect(container.textContent).toContain("nativeに残るメモ");
    expect(hasButton(container, copy.nativeRecoveryShowLocal)).toBe(true);

    act(() => click(findButton(container, copy.nativeRecoveryShowLocal)));
    expect(container.textContent).not.toContain("nativeに残るメモ");

    act(() => click(findButton(container, copy.storageRecoverySave)));
    await flushPromises();

    expect(JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[]).toEqual([]);
    expect(durable.persist).toHaveBeenCalledWith([]);
  });

  it("local復元候補があってもnativeを確認し、異なる別世代を隠さず明示的に切り替えられる", async () => {
    const localCandidate = [makeNote({ id: "local-recovery", title: "local復元候補" })];
    const nativeCandidate = [makeNote({ id: "native-recovery", title: "native別候補" })];
    storage._store[BACKUP_KEY_FOR_TESTING] = JSON.stringify(localCandidate);
    durable.read.mockResolvedValue({ status: "available", notes: nativeCandidate });

    renderApp();
    expect(container.querySelector('[data-testid="native-recovery-checking"]')).not.toBeNull();
    expect(hasButton(container, copy.storageRecoverySave)).toBe(false);
    await flushPromises();

    expect(container.textContent).toContain("local復元候補");
    expect(container.querySelector('[data-testid="native-recovery-alternative"]')).not.toBeNull();
    expect(hasButton(container, copy.nativeRecoveryShowAlternative)).toBe(true);
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBeUndefined();
    expect(durable.persist).not.toHaveBeenCalled();

    act(() => click(findButton(container, copy.nativeRecoveryShowAlternative)));
    expect(container.textContent).toContain("native別候補");
    expect(hasButton(container, copy.nativeRecoveryShowLocal)).toBe(true);

    act(() => click(findButton(container, copy.nativeRecoveryShowLocal)));
    expect(container.textContent).toContain("local復元候補");

    act(() => click(findButton(container, copy.nativeRecoveryShowAlternative)));
    act(() => click(findButton(container, copy.storageRecoverySave)));
    await flushPromises();

    expect(JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[]).toEqual(nativeCandidate);
    expect(durable.persist).toHaveBeenCalledWith(nativeCandidate);
  });

  it("local復元候補がある状態でnative読込に失敗したらforce確定を出さず、retry完了後だけ解放する", async () => {
    const localCandidate = [makeNote({ id: "local-recovery", title: "守るlocal候補" })];
    storage._store[BACKUP_KEY_FOR_TESTING] = JSON.stringify(localCandidate);
    durable.read
      .mockResolvedValueOnce({ status: "error" })
      .mockResolvedValue({ status: "missing" });

    renderApp();
    await flushPromises();

    expect(container.textContent).toContain(copy.nativeRecoveryReadError);
    expect(hasButton(container, copy.storageRecoverySave)).toBe(false);
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBeUndefined();

    act(() => click(findButton(container, copy.nativeRecoveryRetry)));
    await flushPromises();

    expect(container.textContent).not.toContain(copy.nativeRecoveryReadError);
    expect(container.textContent).toContain("守るlocal候補");
    expect(hasButton(container, copy.storageRecoverySave)).toBe(true);
  });

  it("runtimeでlocal復元候補へ遷移した場合もnative別世代を再確認して隠さない", async () => {
    const existing = [makeNote({ id: "existing", title: "起動時正本" })];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(existing);
    renderApp();
    await flushPromises();
    durable.persist.mockClear();

    const localCandidate = [makeNote({ id: "runtime-local", title: "runtime local候補" })];
    const nativeCandidate = [makeNote({ id: "runtime-native", title: "runtime native候補" })];
    delete storage._store[STORAGE_KEY_FOR_TESTING];
    storage._store[BACKUP_KEY_FOR_TESTING] = JSON.stringify(localCandidate);
    durable.read.mockResolvedValue({ status: "available", notes: nativeCandidate });

    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY_FOR_TESTING, newValue: null }));
    });
    expect(container.querySelector('[data-testid="native-recovery-checking"]')).not.toBeNull();
    await flushPromises();

    expect(container.textContent).toContain("runtime local候補");
    expect(container.querySelector('[data-testid="native-recovery-alternative"]')).not.toBeNull();
    expect(hasButton(container, copy.nativeRecoveryShowAlternative)).toBe(true);
    expect(durable.persist).not.toHaveBeenCalled();
  });

  it("dirty screen・remote recovery・native別世代を混ぜず3候補として切り替えられる", async () => {
    const initial = [makeNote({ id: "shared", title: "同じメモ", body: "初期" })];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(initial);
    renderApp();
    await flushPromises();
    durable.persist.mockClear();

    act(() => click(findButton(container, "同じメモ")));
    act(() => click(findButton(container, copy.editNote)));
    let textarea = container.querySelector("textarea");
    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("textarea not found");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    const dirtyTextarea = textarea;
    act(() => {
      setter?.call(dirtyTextarea, "screen dirty");
      dirtyTextarea.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const localCandidate = [makeNote({ id: "shared", title: "同じメモ", body: "local recovery" })];
    const nativeCandidate = [makeNote({ id: "shared", title: "同じメモ", body: "native recovery" })];
    delete storage._store[STORAGE_KEY_FOR_TESTING];
    storage._store[BACKUP_KEY_FOR_TESTING] = JSON.stringify(localCandidate);
    durable.read.mockResolvedValue({ status: "available", notes: nativeCandidate });

    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY_FOR_TESTING, newValue: null }));
    });
    expect(container.querySelector('[data-testid="native-recovery-checking"]')).not.toBeNull();
    textarea = container.querySelector("textarea");
    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("textarea not found");
    expect(textarea?.value).toBe("screen dirty");
    await flushPromises();

    expect(container.querySelector('[data-testid="dirty-recovery-candidates"]')).not.toBeNull();
    expect(hasButton(container, copy.dirtyRecoveryShowLocal)).toBe(true);
    expect(hasButton(container, copy.nativeRecoveryShowAlternative)).toBe(true);

    act(() => click(findButton(container, copy.dirtyRecoveryShowLocal)));
    textarea = container.querySelector("textarea");
    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("textarea not found");
    expect(textarea?.value).toBe("local recovery");
    expect(hasButton(container, copy.dirtyRecoveryShowScreen)).toBe(true);

    act(() => click(findButton(container, copy.nativeRecoveryShowAlternative)));
    textarea = container.querySelector("textarea");
    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("textarea not found");
    expect(textarea?.value).toBe("native recovery");

    act(() => click(findButton(container, copy.dirtyRecoveryShowScreen)));
    textarea = container.querySelector("textarea");
    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("textarea not found");
    expect(textarea?.value).toBe("screen dirty");

    act(() => click(findButton(container, copy.storageRecoverySave)));
    await flushPromises();
    const saved = JSON.parse(storage._store[STORAGE_KEY_FOR_TESTING]) as Note[];
    expect(saved[0]?.body).toBe("screen dirty");
    expect(durable.persist).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ body: "screen dirty" })]),
    );
  });

  it("表示中local候補を編集後に別remote recoveryが来ても自動上書きしない", async () => {
    const initial = [makeNote({ id: "shared", title: "同じメモ", body: "初期" })];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(initial);
    renderApp();
    await flushPromises();

    act(() => click(findButton(container, "同じメモ")));
    act(() => click(findButton(container, copy.editNote)));
    let textarea = container.querySelector("textarea");
    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("textarea not found");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    const initialTextarea = textarea;
    act(() => {
      setter?.call(initialTextarea, "screen dirty");
      initialTextarea.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const localOne = [
      makeNote({ id: "shared", title: "同じメモ", body: "local one" }),
      makeNote({ id: "local-extra", title: "local extra", body: "second" }),
    ];
    const nativeCandidate = [makeNote({ id: "shared", title: "同じメモ", body: "native" })];
    delete storage._store[STORAGE_KEY_FOR_TESTING];
    storage._store[BACKUP_KEY_FOR_TESTING] = JSON.stringify(localOne);
    durable.read.mockResolvedValue({ status: "available", notes: nativeCandidate });
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY_FOR_TESTING, newValue: null }));
    });
    await flushPromises();

    act(() => click(findButton(container, copy.dirtyRecoveryShowLocal)));
    textarea = container.querySelector("textarea");
    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("textarea not found");
    expect(textarea.value).toBe("local one");
    const localTextarea = textarea;
    act(() => {
      setter?.call(localTextarea, "local edited by user");
      localTextarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(container.querySelector("textarea")?.value).toBe("local edited by user");

    const localTwo = [makeNote({ id: "shared", title: "同じメモ", body: "local two from remote" })];
    storage._store[BACKUP_KEY_FOR_TESTING] = JSON.stringify(localTwo);
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY_FOR_TESTING, newValue: null }));
    });
    expect(container.querySelector("textarea")?.value).toBe("local edited by user");
    await flushPromises();
    expect(container.querySelector("textarea")?.value).toBe("local edited by user");
    expect(container.textContent).toContain(copy.storageRecoveryCandidateCount(2));

    act(() => click(findButton(container, copy.dirtyRecoveryShowScreen)));
    expect(container.querySelector("textarea")?.value).toBe("screen dirty");
    act(() => click(findButton(container, copy.dirtyRecoveryShowLocal)));
    expect(container.querySelector("textarea")?.value).toBe("local edited by user");
    expect(JSON.parse(storage._store[BACKUP_KEY_FOR_TESTING]) as Note[]).toEqual(localTwo);
  });

  it("表示中native候補を編集後に再probeされても自動上書きしない", async () => {
    const initial = [makeNote({ id: "shared", title: "同じメモ", body: "初期" })];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(initial);
    renderApp();
    await flushPromises();

    act(() => click(findButton(container, "同じメモ")));
    act(() => click(findButton(container, copy.editNote)));
    let textarea = container.querySelector("textarea");
    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("textarea not found");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    const initialTextarea = textarea;
    act(() => {
      setter?.call(initialTextarea, "screen dirty");
      initialTextarea.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const localOne = [makeNote({ id: "shared", title: "同じメモ", body: "local one" })];
    const nativeOne = [makeNote({ id: "shared", title: "同じメモ", body: "native one" })];
    delete storage._store[STORAGE_KEY_FOR_TESTING];
    storage._store[BACKUP_KEY_FOR_TESTING] = JSON.stringify(localOne);
    durable.read.mockResolvedValue({ status: "available", notes: nativeOne });
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY_FOR_TESTING, newValue: null }));
    });
    await flushPromises();

    act(() => click(findButton(container, copy.nativeRecoveryShowAlternative)));
    textarea = container.querySelector("textarea");
    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("textarea not found");
    expect(textarea.value).toBe("native one");
    const nativeTextarea = textarea;
    act(() => {
      setter?.call(nativeTextarea, "native edited by user");
      nativeTextarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(container.querySelector("textarea")?.value).toBe("native edited by user");

    const localTwo = [makeNote({ id: "shared", title: "同じメモ", body: "local two" })];
    const nativeTwo = [makeNote({ id: "shared", title: "同じメモ", body: "native two from probe" })];
    storage._store[BACKUP_KEY_FOR_TESTING] = JSON.stringify(localTwo);
    durable.read.mockResolvedValue({ status: "available", notes: nativeTwo });
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY_FOR_TESTING, newValue: null }));
    });
    expect(container.querySelector("textarea")?.value).toBe("native edited by user");
    await flushPromises();
    expect(container.querySelector("textarea")?.value).toBe("native edited by user");

    act(() => click(findButton(container, copy.dirtyRecoveryShowScreen)));
    expect(container.querySelector("textarea")?.value).toBe("screen dirty");
    act(() => click(findButton(container, copy.nativeRecoveryShowAlternative)));
    expect(container.querySelector("textarea")?.value).toBe("native edited by user");
  });

  it("表示中native候補の件数を編集すると候補件数表示も追従する", async () => {
    const initial = [makeNote({ id: "shared", title: "同じメモ", body: "初期" })];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(initial);
    renderApp();
    await flushPromises();

    act(() => click(findButton(container, "同じメモ")));
    act(() => click(findButton(container, copy.editNote)));
    const textarea = container.querySelector("textarea");
    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("textarea not found");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    act(() => {
      setter?.call(textarea, "screen dirty");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const localCandidate = [makeNote({ id: "shared", title: "同じメモ", body: "local" })];
    const nativeCandidate = [makeNote({ id: "shared", title: "同じメモ", body: "native" })];
    delete storage._store[STORAGE_KEY_FOR_TESTING];
    storage._store[BACKUP_KEY_FOR_TESTING] = JSON.stringify(localCandidate);
    durable.read.mockResolvedValue({ status: "available", notes: nativeCandidate });
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY_FOR_TESTING, newValue: null }));
    });
    await flushPromises();

    act(() => click(findButton(container, copy.nativeRecoveryShowAlternative)));
    expect(container.textContent).toContain(copy.nativeRecoveryAlternativeNotice(1));

    const backButton = container.querySelector(`button[aria-label="${copy.back}"]`);
    if (!(backButton instanceof HTMLButtonElement)) throw new Error("editor back button not found");
    act(() => click(backButton));
    act(() => click(findButton(container, copy.newNote)));

    expect(container.textContent).toContain(copy.nativeRecoveryAlternativeNotice(2));
    expect(container.textContent).not.toContain(copy.nativeRecoveryAlternativeNotice(1));
  });

  it("dirty三者競合でnative読込失敗中は候補を保持したままforce確定を出さない", async () => {
    const initial = [makeNote({ id: "shared", title: "同じメモ", body: "初期" })];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(initial);
    renderApp();
    await flushPromises();

    act(() => click(findButton(container, "同じメモ")));
    act(() => click(findButton(container, copy.editNote)));
    const textarea = container.querySelector("textarea");
    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("textarea not found");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    const dirtyTextarea = textarea;
    act(() => {
      setter?.call(dirtyTextarea, "絶対に守るdirty");
      dirtyTextarea.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const localCandidate = [makeNote({ id: "shared", title: "同じメモ", body: "local" })];
    delete storage._store[STORAGE_KEY_FOR_TESTING];
    storage._store[BACKUP_KEY_FOR_TESTING] = JSON.stringify(localCandidate);
    durable.read.mockResolvedValue({ status: "error" });
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY_FOR_TESTING, newValue: null }));
    });
    await flushPromises();

    expect(container.textContent).toContain(copy.nativeRecoveryReadError);
    expect(hasButton(container, copy.storageRecoverySave)).toBe(false);
    expect(container.querySelector("textarea")?.value).toBe("絶対に守るdirty");
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBeUndefined();

    durable.read.mockResolvedValue({ status: "missing" });
    act(() => click(findButton(container, copy.nativeRecoveryRetry)));
    await flushPromises();

    expect(container.textContent).not.toContain(copy.nativeRecoveryReadError);
    expect(container.querySelector("textarea")?.value).toBe("絶対に守るdirty");
    expect(hasButton(container, copy.dirtyRecoveryShowLocal)).toBe(true);
    expect(hasButton(container, copy.storageRecoverySave)).toBe(true);
  });

  it("dirty三者probe中に正常primaryが戻っても未保存screenを自動破棄しない", async () => {
    const initial = [makeNote({ id: "shared", title: "同じメモ", body: "初期" })];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(initial);
    renderApp();
    await flushPromises();

    act(() => click(findButton(container, "同じメモ")));
    act(() => click(findButton(container, copy.editNote)));
    const textarea = container.querySelector("textarea");
    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("textarea not found");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    const dirtyTextarea = textarea;
    act(() => {
      setter?.call(dirtyTextarea, "probe中も守るscreen");
      dirtyTextarea.dispatchEvent(new Event("input", { bubbles: true }));
    });

    let resolveNative: ((value: { status: "available"; notes: Note[] }) => void) | undefined;
    durable.read.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveNative = resolve;
        }),
    );
    const localCandidate = [makeNote({ id: "shared", title: "同じメモ", body: "local recovery" })];
    delete storage._store[STORAGE_KEY_FOR_TESTING];
    storage._store[BACKUP_KEY_FOR_TESTING] = JSON.stringify(localCandidate);
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY_FOR_TESTING, newValue: null }));
    });
    await flushPromises();
    expect(resolveNative).toBeDefined();

    const returnedPrimary = [makeNote({ id: "shared", title: "同じメモ", body: "戻ったprimary" })];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(returnedPrimary);
    const nativeCandidate = [makeNote({ id: "shared", title: "同じメモ", body: "native別世代" })];
    await act(async () => {
      resolveNative?.({ status: "available", notes: nativeCandidate });
      await Promise.resolve();
    });
    await flushPromises();

    expect(container.querySelector("textarea")?.value).toBe("probe中も守るscreen");
    expect(container.querySelector('[data-testid="dirty-recovery-candidates"]')).not.toBeNull();
    expect(hasButton(container, copy.storageConflictLoad)).toBe(true);
    expect(hasButton(container, copy.dirtyRecoveryShowLocal)).toBe(true);
    expect(hasButton(container, copy.nativeRecoveryShowAlternative)).toBe(true);

    act(() => click(findButton(container, copy.storageConflictLoad)));
    await flushPromises();
    expect(container.querySelector("textarea")?.value).toBe("戻ったprimary");
  });

  it("初回loadNotesだけ一時失敗して直後にprimaryが読めてもnative safety probeで現在正本へ収束する", async () => {
    const existing = [makeNote({ title: "一時障害後の正本" })];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(existing);
    let primaryReads = 0;
    storage.getItem.mockImplementation((key: string) => {
      if (key === STORAGE_KEY_FOR_TESTING) {
        primaryReads += 1;
        if (primaryReads === 1) {
          throw new DOMException("transient storage failure", "SecurityError");
        }
      }
      return storage._store[key] ?? null;
    });
    durable.read.mockResolvedValue({ status: "missing" });

    renderApp();
    expect(container.querySelector('[data-testid="native-recovery-checking"]')).not.toBeNull();
    expect(container.textContent).not.toContain(
      "データの読み込みに問題がありました。メモが復元できない可能性があります。",
    );

    await flushPromises();

    expect(container.textContent).toContain("一時障害後の正本");
    expect(container.querySelector('[data-testid="native-recovery-checking"]')).toBeNull();
    expect(container.querySelector('[data-testid="native-recovery-error"]')).toBeNull();
    expect(durable.persist).toHaveBeenCalledWith(existing);
  });

  it("localStorage API自体が一時利用不能ならnative確認を必須化し、回復確認まで編集しない", async () => {
    storage.getItem.mockImplementation((key: string) => {
      if (key === STORAGE_KEY_FOR_TESTING) {
        throw new DOMException("storage unavailable", "SecurityError");
      }
      return storage._store[key] ?? null;
    });
    durable.read.mockResolvedValue({ status: "missing" });

    renderApp();
    await flushPromises();

    expect(container.textContent).toContain(copy.nativeRecoveryReadError);
    expect(container.textContent).not.toContain(
      "データの読み込みに問題がありました。メモが復元できない可能性があります。",
    );
    expect(container.querySelector('[data-testid="native-recovery-error"]')).not.toBeNull();
    act(() => click(findButton(container, copy.emptyAction)));
    act(() => vi.advanceTimersByTime(1_000));
    await flushPromises();
    expect(container.querySelector("textarea")).toBeNull();
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBeUndefined();

    storage.getItem.mockImplementation((key: string) => storage._store[key] ?? null);
    act(() => click(findButton(container, copy.nativeRecoveryRetry)));
    await flushPromises();

    expect(container.textContent).not.toContain(copy.nativeRecoveryReadError);
    act(() => click(findButton(container, copy.emptyAction)));
    expect(container.querySelector("textarea")).not.toBeNull();
  });

  it("local primary破損かつnative不存在でもfresh install扱いせず明示復旧を要求する", async () => {
    storage._store[STORAGE_KEY_FOR_TESTING] = "{broken";
    durable.read.mockResolvedValue({ status: "missing" });

    renderApp();
    await flushPromises();

    expect(container.textContent).toContain(copy.storageRecoveryTitle);
    expect(hasButton(container, copy.storageRecoverySave)).toBe(true);

    act(() => click(findButton(container, copy.emptyAction)));
    act(() => vi.advanceTimersByTime(1_000));
    await flushPromises();

    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBe("{broken");
  });

});
