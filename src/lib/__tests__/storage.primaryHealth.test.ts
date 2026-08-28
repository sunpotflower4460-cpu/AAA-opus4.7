import { beforeEach, describe, expect, it, vi } from "vitest";
import { getNotesPrimaryHealth, STORAGE_KEY_FOR_TESTING } from "../storage";
import type { Note } from "../../types/note";

const note: Note = {
  id: "one",
  title: "保存済み",
  body: "本文",
  createdAt: "2026-08-28T00:00:00.000Z",
  updatedAt: "2026-08-28T00:00:00.000Z",
  isFavorite: false,
  locale: "ja",
};

describe("notes primary health", () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    Object.keys(store).forEach((key) => delete store[key]);
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: vi.fn((key: string) => store[key] ?? null),
      },
    });
  });

  it("primary未作成はmissing", () => {
    expect(getNotesPrimaryHealth()).toBe("missing");
  });

  it("正常primaryはvalid", () => {
    store[STORAGE_KEY_FOR_TESTING] = JSON.stringify([note]);
    expect(getNotesPrimaryHealth()).toBe("valid");
  });

  it("破損primaryはinvalid", () => {
    store[STORAGE_KEY_FOR_TESTING] = "{broken";
    expect(getNotesPrimaryHealth()).toBe("invalid");
  });

  it("localStorage読込不能はunavailable", () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: vi.fn(() => {
          throw new DOMException("blocked", "SecurityError");
        }),
      },
    });
    expect(getNotesPrimaryHealth()).toBe("unavailable");
  });
});
