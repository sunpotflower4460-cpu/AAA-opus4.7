import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(),
  addListener: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: mocks.isNativePlatform },
}));

vi.mock("@capacitor/app", () => ({
  App: { addListener: mocks.addListener },
}));

import { subscribeToNativeAppState } from "../nativeAppLifecycle";

describe("native app lifecycle subscription", () => {
  beforeEach(() => {
    mocks.isNativePlatform.mockReset();
    mocks.addListener.mockReset();
  });

  it("webではnative listenerを登録しない", () => {
    mocks.isNativePlatform.mockReturnValue(false);

    const unsubscribe = subscribeToNativeAppState(() => {});
    unsubscribe();

    expect(mocks.addListener).not.toHaveBeenCalled();
  });

  it("nativeではappStateChangeを登録しcleanupでremoveする", async () => {
    mocks.isNativePlatform.mockReturnValue(true);
    const remove = vi.fn().mockResolvedValue(undefined);
    mocks.addListener.mockResolvedValue({ remove });

    const listener = vi.fn();
    const unsubscribe = subscribeToNativeAppState(listener);
    await Promise.resolve();
    unsubscribe();
    await Promise.resolve();

    expect(mocks.addListener).toHaveBeenCalledWith("appStateChange", listener);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("登録完了前にcleanupされても遅れて返ったlistenerをremoveする", async () => {
    mocks.isNativePlatform.mockReturnValue(true);
    let resolveHandle!: (value: { remove: () => Promise<void> }) => void;
    const remove = vi.fn().mockResolvedValue(undefined);
    mocks.addListener.mockReturnValue(
      new Promise((resolve) => {
        resolveHandle = resolve;
      }),
    );

    const unsubscribe = subscribeToNativeAppState(() => {});
    unsubscribe();
    resolveHandle({ remove });
    await Promise.resolve();
    await Promise.resolve();

    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("native plugin登録失敗時もcleanup可能なままにする", async () => {
    mocks.isNativePlatform.mockReturnValue(true);
    mocks.addListener.mockRejectedValue(new Error("plugin unavailable"));

    const unsubscribe = subscribeToNativeAppState(() => {});
    await Promise.resolve();
    expect(() => unsubscribe()).not.toThrow();
  });
});
