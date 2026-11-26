import { beforeEach, describe, expect, it, vi } from "vitest";

const KEY = "zanshin.prefs.brush.v1";

async function load() {
  vi.resetModules();
  return import("../brushPreference");
}

describe("brushPreference", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-brush");
  });

  it("defaults to mincho and reflects it on <html>", async () => {
    const { initBrush } = await load();
    expect(initBrush()).toBe("mincho");
    expect(document.documentElement.getAttribute("data-brush")).toBe("mincho");
  });

  it("restores a stored brush on init", async () => {
    window.localStorage.setItem(KEY, "fude");
    const { initBrush } = await load();
    expect(initBrush()).toBe("fude");
    expect(document.documentElement.getAttribute("data-brush")).toBe("fude");
  });

  it("falls back to the default for unknown stored values", async () => {
    window.localStorage.setItem(KEY, "comic-sans");
    const { initBrush } = await load();
    expect(initBrush()).toBe("mincho");
  });

  it("persists a chosen brush and notifies subscribers", async () => {
    const { initBrush, setBrush, getBrush } = await load();
    initBrush();
    setBrush("tegaki");
    expect(getBrush()).toBe("tegaki");
    expect(window.localStorage.getItem(KEY)).toBe("tegaki");
    expect(document.documentElement.getAttribute("data-brush")).toBe("tegaki");
  });

  it("keeps working when storage throws", async () => {
    const { initBrush, setBrush, getBrush } = await load();
    initBrush();
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => setBrush("boku")).not.toThrow();
    expect(getBrush()).toBe("boku");
    spy.mockRestore();
  });

  it("never touches the notes storage keys", async () => {
    window.localStorage.setItem("zanshin.notes.v1", "[]");
    const { initBrush, setBrush } = await load();
    initBrush();
    setBrush("fude");
    expect(window.localStorage.getItem("zanshin.notes.v1")).toBe("[]");
  });
});
