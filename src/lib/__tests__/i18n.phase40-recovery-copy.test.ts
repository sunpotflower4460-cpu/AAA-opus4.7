import { describe, expect, it } from "vitest";
import { copy } from "../i18n";

describe("Phase 40 recovery copy", () => {
  it("native候補が未確認・不存在でも共通dirty案内が端末内候補の存在を断定しない", () => {
    expect(copy.dirtyRecoveryCandidateNotice).not.toContain("端末内");
    expect(copy.dirtyRecoveryCandidateNotice).toContain("未保存編集");
    expect(copy.dirtyRecoveryCandidateNotice).toContain("保存先の復元候補");

    expect(copy.nativeRecoveryAlternativeNotice(1)).toContain("端末内");
  });
});
