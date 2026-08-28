import { describe, expect, it } from "vitest";
import { isRetryableSaveFailure } from "../storage";

describe("isRetryableSaveFailure", () => {
  it("一時的な保存先失敗だけをRetry対象にする", () => {
    expect(isRetryableSaveFailure({ ok: false, reason: "quota" })).toBe(true);
    expect(isRetryableSaveFailure({ ok: false, reason: "unavailable" })).toBe(true);
    expect(isRetryableSaveFailure({ ok: false, reason: "unknown" })).toBe(true);
  });

  it("競合・不正データ・成功は通常Retry対象にしない", () => {
    expect(isRetryableSaveFailure({ ok: false, reason: "conflict" })).toBe(false);
    expect(isRetryableSaveFailure({ ok: false, reason: "invalid_data" })).toBe(false);
    expect(isRetryableSaveFailure({ ok: true })).toBe(false);
    expect(isRetryableSaveFailure(null)).toBe(false);
  });
});
