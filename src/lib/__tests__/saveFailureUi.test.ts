import { describe, expect, it } from "vitest";
import { copy } from "../i18n";
import { getSaveFailureMessage } from "../saveFailureUi";

describe("getSaveFailureMessage", () => {
  it("非競合の保存失敗を理由別メッセージへ正規化する", () => {
    expect(getSaveFailureMessage({ ok: false, reason: "quota" })).toBe(copy.saveErrorQuota);
    expect(getSaveFailureMessage({ ok: false, reason: "unavailable" })).toBe(copy.saveErrorUnavailable);
    expect(getSaveFailureMessage({ ok: false, reason: "invalid_data" })).toBe(copy.saveErrorInvalidData);
    expect(getSaveFailureMessage({ ok: false, reason: "unknown" })).toBe(copy.saveError);
  });

  it("成功・未実行・競合は汎用保存失敗バナーへ出さない", () => {
    expect(getSaveFailureMessage({ ok: true })).toBeNull();
    expect(getSaveFailureMessage(null)).toBeNull();
    expect(getSaveFailureMessage({ ok: false, reason: "conflict" })).toBeNull();
  });
});
