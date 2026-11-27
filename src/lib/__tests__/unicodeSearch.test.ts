import { describe, expect, it, vi } from "vitest";
import fixture from "../../../docs/multilingual/fixtures/round-2.json";
import { countGraphemes, truncateGraphemes } from "../graphemes";
import { getCardDisplay, matchExcerpt } from "../noteDisplay";
import { matchesNote } from "../notesLogic";
import { makeNoteDateFormatter } from "../zanshinDate";

const cases = fixture.text_cases;
const sample = (id: string) => cases.find((item) => item.id === id)!;
const note = (id: string) => ({
  id,
  title: sample(id).title,
  body: sample(id).body,
  createdAt: "2026-11-27T00:00:00Z",
  updatedAt: "2026-11-27T00:00:00Z",
  isFavorite: false,
});

const searchCases = cases.flatMap((item) =>
  (item.queries ?? []).map((check) => [item.id, check] as const),
);

describe("比較規則と原文（ML14/15/25〜27/31〜33/37）", () => {
  it.each(searchCases)("%s の比較 fixture %j", (id, check) => {
    const original = note(id);
    expect(matchesNote(original, check.text)).toBe(check.expected_under_proposed_policy);
  });

  it.each([
    ["MLT09", "Café", "Cafe\u0301"],
    ["MLT10", "が", "か\u3099"],
    ["MLT11", "가", "\u1100\u1161"],
  ])("%s の両表現で一致し、原文を保つ", (id, composed, decomposed) => {
    const n = note(id);
    const before = JSON.stringify(n);
    expect(matchesNote(n, composed)).toBe(true);
    expect(matchesNote(n, decomposed)).toBe(true);
    const excerpt = matchExcerpt(n.body, decomposed);
    expect(excerpt).not.toBeNull();
    expect(n.body).toContain(excerpt!.directionSource ?? excerpt!.text);
    expect(JSON.stringify(n)).toBe(before);
  });

  it.each(["\r", "\n", "\r\n", "\u2028", "\u2029"])("行境界 %j を跨がない", (newline) => {
    expect(matchesNote({ ...note("MLT17"), body: `blue${newline}moon` }, "blue moon")).toBe(false);
    expect(matchExcerpt(`blue${newline}moon`, "blue moon")).toBeNull();
  });

  it("水平空白を比較時だけ等価化し、合成後の位置を原文に戻す", () => {
    const original = `Cafe\u0301\u00a0\t \u202fMoon`;
    const line = `${"زن".repeat(37)} ${original} ${"ש".repeat(37)}`;
    const excerpt = matchExcerpt(line, "CAFÉ MOON", 0);
    expect(excerpt?.text).toBe(`…${original}…`);
    expect(excerpt?.directionSource).toBe(line);
    expect(matchExcerpt(line, "cafe moon")).toBeNull();
    expect(matchExcerpt("blue\u200bmoon", "bluemoon")).toBeNull();
    expect(matchExcerpt("Straße", "strasse")).toBeNull();
  });

  it("不可視の題名を本文で識別し、元データの制御文字は残す", () => {
    const invisible = note("MLT18");
    const before = JSON.stringify(invisible);
    expect(getCardDisplay(invisible).headingSource).toBe("body");
    expect(getCardDisplay({ ...invisible, body: "" }).headingSource).toBe("untitled");
    expect(JSON.stringify(invisible)).toBe(before);
  });

  it.each(fixture.length_examples)("書記素の参照値を照合する $text", ({ text, reference_graphemes }) => {
    expect(countGraphemes(text)).toBe(reference_graphemes);
  });

  it.each(["missing", "throws"])("Segmenterが %s の場合は分割しない", (mode) => {
    const descriptor = Object.getOwnPropertyDescriptor(Intl, "Segmenter");
    try {
      const unavailable = mode === "throws" ? class { constructor() { throw new Error("unsupported"); } } : undefined;
      Object.defineProperty(Intl, "Segmenter", { value: unavailable, configurable: true });
      const text = note("MLT07").body;
      expect(countGraphemes(text)).toBeNull();
      expect(truncateGraphemes(text, 1)).toBe(text);
      const line = `🏳️‍🌈👍🏽${"Cafe\u0301 ".repeat(100)}query 👨‍👩‍👧‍👦`;
      expect(matchExcerpt(line, "QUERY")).toEqual({ text: line });
    } finally {
      if (descriptor) Object.defineProperty(Intl, "Segmenter", descriptor);
    }
  });
});

it("書式とタイムゾーンを独立して指定できる", () => {
  const instant = "2026-11-26T23:50:00Z";
  expect(makeNoteDateFormatter({ formatLocale: "ja", timeZone: "Asia/Tokyo" })(instant)).toBe("2026年11月27日");
  expect(makeNoteDateFormatter({ formatLocale: "en", timeZone: "Asia/Tokyo" })(instant)).toBe("November 27, 2026");
  expect(makeNoteDateFormatter({ formatLocale: "en", timeZone: "UTC" })(instant)).toBe("November 26, 2026");
  vi.restoreAllMocks();
});
