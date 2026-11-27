import { describe, expect, it } from "vitest";
import { formatZanshinDate, getTimeOfDay, makeNoteDateFormatter } from "../zanshinDate";

describe("zanshinDate", () => {
  it("有効な日時を日付印へ変換する", () => {
    const iso = "2026-08-28T03:00:00.000Z";
    expect(formatZanshinDate(iso)).toMatch(/^2026\.08\.28$/);
    expect(makeNoteDateFormatter({ formatLocale: "en", timeZone: "UTC" })(iso)).toBe("August 28, 2026");
  });

  it("不正日時を夜の余白と誤判定しない", () => {
    expect(formatZanshinDate("not-a-date")).toBe("");
    expect(getTimeOfDay("not-a-date")).toBeNull();
    expect(makeNoteDateFormatter({ formatLocale: "ja" })("not-a-date")).toBeNull();
  });
});
