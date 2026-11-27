import { describe, expect, it } from "vitest";
import { messages } from "../i18n";
import { getSaveFailureMessage } from "../saveFailureUi";

const copy = messages.ja;

describe("getSaveFailureMessage", () => {
  it("非競合の保存失敗を理由別メッセージへ正規化する", () => {
    expect(getSaveFailureMessage(copy, { ok: false, reason: "quota" })).toBe(copy.saveErrorQuota);
    expect(getSaveFailureMessage(copy, { ok: false, reason: "unavailable" })).toBe(copy.saveErrorUnavailable);
    expect(getSaveFailureMessage(copy, { ok: false, reason: "invalid_data" })).toBe(copy.saveErrorInvalidData);
    expect(getSaveFailureMessage(copy, { ok: false, reason: "unknown" })).toBe(copy.saveError);
  });

  it("成功・未実行・競合は汎用保存失敗バナーへ出さない", () => {
    expect(getSaveFailureMessage(copy, { ok: true })).toBeNull();
    expect(getSaveFailureMessage(copy, null)).toBeNull();
    expect(getSaveFailureMessage(copy, { ok: false, reason: "conflict" })).toBeNull();
  });
});
