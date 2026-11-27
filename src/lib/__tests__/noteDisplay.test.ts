import { describe, expect, it, vi } from "vitest";
import type { Note } from "../../types/note";
import { getCardDisplay, matchExcerpt } from "../noteDisplay";
import { countGraphemes, truncateGraphemes } from "../graphemes";

function note(overrides: Partial<Note>): Note {
  return {
    id: "n",
    title: "",
    body: "",
    createdAt: "2026-08-28T00:00:00.000Z",
    updatedAt: "2026-08-28T00:00:00.000Z",
    isFavorite: false,
    ...overrides,
  };
}

const FAMILY = "👨‍👩‍👧‍👦";
const SKIN = "👍🏽";
const MOON = "🌙";
const KA_DAKUTEN = "が"; // か + 結合濁点
const VS = "☺️"; // 異体字セレクタ

function hasLoneSurrogate(text: string): boolean {
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      i += 1;
    } else if (c >= 0xdc00 && c <= 0xdfff) {
      return true;
    }
  }
  return false;
}

describe("書記素を割らない短縮（R19）", () => {
  it.each([
    ["家族の絵文字", FAMILY],
    ["肌色の絵文字", SKIN],
    ["月", MOON],
    ["結合濁点", KA_DAKUTEN],
    ["異体字セレクタ", VS],
  ])("%s を途中で切らない", (_label, unit) => {
    const text = `${unit.repeat(5)}あいうえお`;
    for (let max = 1; max <= 5; max += 1) {
      const cut = truncateGraphemes(text, max);
      expect(hasLoneSurrogate(cut)).toBe(false);
      // 切った結果は、元の書記素の整数個 + 省略記号
      expect(cut.endsWith("…")).toBe(true);
      expect(cut.slice(0, -1)).toBe(unit.repeat(max));
    }
  });

  it("短ければそのまま返し、省略記号を付けない", () => {
    expect(truncateGraphemes("短い", 10)).toBe("短い");
  });

  it("Intl.Segmenter が無い環境では複合文字を短縮しない", () => {
    const original = (Intl as unknown as { Segmenter?: unknown }).Segmenter;
    (Intl as unknown as { Segmenter?: unknown }).Segmenter = undefined;
    try {
      const cut = truncateGraphemes(`${MOON}${MOON}${MOON}${SKIN}`, 2);
      expect(hasLoneSurrogate(cut)).toBe(false);
      expect(cut).toBe(`${MOON}${MOON}${MOON}${SKIN}`);
      expect(countGraphemes(MOON)).toBeNull();
    } finally {
      (Intl as unknown as { Segmenter?: unknown }).Segmenter = original;
    }
  });
});

describe("検索の一致抜粋（R17）", () => {
  const long = `${"あ".repeat(60)}中間の語${"い".repeat(60)}末尾の語`;

  it("本文の先頭・中間・末尾のどこに一致しても、一致箇所を含む抜粋になる", () => {
    expect(matchExcerpt("先頭の語から始まる長い文章がここに続いていく", "先頭の語")?.text).toContain("先頭の語");
    expect(matchExcerpt(long, "中間の語")?.text).toContain("中間の語");
    expect(matchExcerpt(long, "末尾の語")?.text).toContain("末尾の語");
  });

  it("前後を省略した時だけ省略記号が付き、抜粋は短い", () => {
    const excerpt = matchExcerpt(long, "中間の語")!.text;
    expect(excerpt.startsWith("…")).toBe(true);
    expect(excerpt.endsWith("…")).toBe(true);
    expect(excerpt.length).toBeLessThan(60);
  });

  it("大文字小文字を区別せず、原文の表記のまま返す", () => {
    expect(matchExcerpt("Buy Tea and citrus", "tea")?.text).toBe("Buy Tea and citrus");
  });

  it("一致箇所が絵文字の隣でも、書記素を割らない", () => {
    const text = `${FAMILY.repeat(8)}ここに探す語${SKIN.repeat(8)}`;
    const excerpt = matchExcerpt(text, "探す語", 3)!.text;
    expect(excerpt).toContain("探す語");
    expect(hasLoneSurrogate(excerpt)).toBe(false);
  });

  it("一致しなければ null、空白だけの検索語も null", () => {
    expect(matchExcerpt("本文", "ない")).toBeNull();
    expect(matchExcerpt("本文", "   ")).toBeNull();
  });
});

describe("一覧カードの見出し（R16）", () => {
  it("題名なしは本文の最初の非空行を見出しにし、保存される題名は空のまま（入力を書き換えない）", () => {
    const n = note({ body: "\n  最初の行  \n二行目\n三行目" });
    const display = getCardDisplay(n);
    expect(display.heading).toBe("最初の行");
    expect(display.headingSource).toBe("body");
    expect(display.excerpt?.text).toBe("三行目");
    expect(n.title).toBe("");
    expect(n.body).toBe("\n  最初の行  \n二行目\n三行目");
  });

  it("無題の一行メモは、見出しと抜粋で同じ一文を二度出さない", () => {
    const display = getCardDisplay(note({ body: "電車の窓に映る朝" }));
    expect(display.heading).toBe("電車の窓に映る朝");
    expect(display.excerpt).toBeNull();
  });

  it("題名も本文もない確定済みメモだけ、代替表示を使う", () => {
    expect(getCardDisplay(note({})).headingSource).toBe("untitled");
  });

  it("題名のみのメモは本人の題名のまま", () => {
    const display = getCardDisplay(note({ title: "題名だけ" }));
    expect(display.heading).toBe("題名だけ");
    expect(display.headingSource).toBe("title");
    expect(display.excerpt).toBeNull();
  });

  it("無題10件を、それぞれ違う見出しで見分けられる", () => {
    const headings = Array.from({ length: 10 }, (_, i) => getCardDisplay(note({ id: `n${i}`, body: `${i}件目の一言` })).heading);
    expect(new Set(headings).size).toBe(10);
  });

  it("検索中は本文の一致箇所を示す。見出しですでに見えている一致は繰り返さない", () => {
    const body = `${"前置き。".repeat(20)}探している語がここにある。${"後ろ。".repeat(20)}`;
    const display = getCardDisplay(note({ title: "日記", body }), "探している語");
    expect(display.excerpt?.text).toContain("探している語");

    const visible = getCardDisplay(note({ body: "探している語だけの一行" }), "探している語");
    expect(visible.excerpt).toBeNull();
  });

  it("長い見出しは書記素で短縮し、絵文字を割らない", () => {
    const display = getCardDisplay(note({ body: `${FAMILY.repeat(100)}` }));
    expect(hasLoneSurrogate(display.heading ?? "")).toBe(false);
  });

  it("原文を変更しない（呼び出し前後で同一）", () => {
    const n = note({ title: "  先頭空白の題 ", body: "  行頭空白\n\n末尾空白  " });
    const snapshot = JSON.stringify(n);
    getCardDisplay(n, "空白");
    expect(JSON.stringify(n)).toBe(snapshot);
    vi.restoreAllMocks();
  });
});
