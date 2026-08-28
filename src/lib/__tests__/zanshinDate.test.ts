import { describe, expect, it } from "vitest";
import { formatZanshinDate, getYohakuLabel, getZanshinStamp } from "../zanshinDate";

describe("zanshinDate", () => {
  it("有効な日時を日付印へ変換する", () => {
    const iso = "2026-08-28T03:00:00.000Z";
    expect(formatZanshinDate(iso)).toMatch(/^2026\.08\.28$/);
    expect(getZanshinStamp(iso).date).toBe("2026.08.28");
  });

  it("不正日時を夜の余白と誤判定しない", () => {
    expect(formatZanshinDate("not-a-date")).toBe("");
    expect(getYohakuLabel("not-a-date")).toBe("");
    expect(getZanshinStamp("not-a-date")).toEqual({ date: "", label: "" });
  });
});
