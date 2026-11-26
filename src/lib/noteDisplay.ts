import type { Note } from "../types/note";
import { copy } from "./i18n";

/**
 * 一覧・検索で使う「表示だけ」の整形。
 * 本人の題名・本文は一切書き換えない（保存・コピー・読み返しは常に原文）。
 * 短縮は UTF-16 の位置ではなく、見た目の1文字のまとまり（書記素）で行い、
 * 絵文字・肌色・家族絵文字・結合文字・異体字セレクタを途中で切らない（R19）。
 */

type SegmenterLike = { segment(input: string): Iterable<{ segment: string }> };

function getSegmenter(): SegmenterLike | null {
  const Segmenter = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => SegmenterLike })
    .Segmenter;
  if (typeof Segmenter !== "function") return null;
  try {
    return new Segmenter(undefined, { granularity: "grapheme" });
  } catch {
    return null;
  }
}

/** 書記素に分割する。Intl.Segmenter が無い環境では、少なくともサロゲートを割らない。 */
export function splitGraphemes(text: string): string[] {
  const segmenter = getSegmenter();
  if (segmenter) return Array.from(segmenter.segment(text), (part) => part.segment);
  return Array.from(text);
}

/** 先頭から max 書記素までに短縮する。切った時だけ「…」を付ける（表示用。保存しない）。 */
export function truncateGraphemes(text: string, max: number): string {
  const parts = splitGraphemes(text);
  if (parts.length <= max) return text;
  return `${parts.slice(0, max).join("")}…`;
}

function nonEmptyLines(body: string): string[] {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

export function firstNonEmptyLine(body: string): string | null {
  return nonEmptyLines(body)[0] ?? null;
}

export function lastNonEmptyLine(body: string): string | null {
  const lines = nonEmptyLines(body);
  return lines.length > 0 ? lines[lines.length - 1] : null;
}

/**
 * 検索語に一致した箇所を中心に、前後を含む短い抜粋を返す。一致しなければ null。
 * 大文字小文字は区別しない。小文字化で長さが変わる文字がある時は、位置対応を誤らないよう
 * 大文字小文字を区別した一致だけを使う。
 */
export function matchExcerpt(text: string, query: string, context = 14): string | null {
  const q = query.trim();
  if (q === "") return null;

  const lowered = text.toLowerCase();
  const loweredQuery = q.toLowerCase();
  const positionsAreSafe = lowered.length === text.length && loweredQuery.length === q.length;
  const index = positionsAreSafe ? lowered.indexOf(loweredQuery) : text.indexOf(q);
  if (index < 0) return null;
  const matchLength = positionsAreSafe ? loweredQuery.length : q.length;

  // 一致位置（UTF-16）を書記素の範囲へ対応づける。
  const parts = splitGraphemes(text);
  let offset = 0;
  let startPart = 0;
  let endPart = parts.length - 1;
  let foundStart = false;
  for (let i = 0; i < parts.length; i += 1) {
    const partEnd = offset + parts[i].length;
    if (!foundStart && partEnd > index) {
      startPart = i;
      foundStart = true;
    }
    if (partEnd >= index + matchLength) {
      endPart = i;
      break;
    }
    offset = partEnd;
  }

  const from = Math.max(0, startPart - context);
  const to = Math.min(parts.length, endPart + 1 + context);
  const body = parts.slice(from, to).join("").replace(/\s*\n\s*/g, " ");
  return `${from > 0 ? "…" : ""}${body}${to < parts.length ? "…" : ""}`;
}

export type CardDisplay = {
  /** 識別用の見出し。題名があれば本人の題名、無ければ本文の最初の非空行（保存されない） */
  heading: string;
  /** 見出しの補足。見出しと同じ内容は出さない。無ければ空 */
  excerpt: string;
  /** 見出しが本文から作った表示用のものか */
  headingIsDerived: boolean;
};

const HEADING_MAX = 80;
const EXCERPT_MAX = 72;

/**
 * 一覧カードの表示内容。
 * - 題名あり: 題名 + 最後の非空行（検索中は一致箇所の抜粋）
 * - 題名なし: 本文の最初の非空行 + 別の内容があれば最後の行（同じ一文を二度出さない）
 * - どちらも空: 「名のない余韻」だけ
 */
export function getCardDisplay(note: Note, query = ""): CardDisplay {
  const q = query.trim();
  const hasTitle = note.title.trim() !== "";
  const first = firstNonEmptyLine(note.body);
  const last = lastNonEmptyLine(note.body);

  if (hasTitle) {
    let excerpt = "";
    if (q !== "") {
      excerpt =
        matchExcerpt(note.body, q) ??
        // 題名の省略されて見えない部分に一致した時だけ、その箇所を示す。
        (splitGraphemes(note.title).length > 30 ? matchExcerpt(note.title, q) ?? "" : "");
    }
    if (excerpt === "" && last !== null) excerpt = truncateGraphemes(last, EXCERPT_MAX);
    return { heading: note.title, excerpt, headingIsDerived: false };
  }

  if (first === null) {
    return { heading: copy.untitled, excerpt: "", headingIsDerived: false };
  }

  let excerpt = "";
  if (q !== "") {
    const found = matchExcerpt(note.body, q);
    // 見出しにすでに一致箇所が見えている時は、同じ文を繰り返さない。
    if (found !== null && !truncateGraphemes(first, HEADING_MAX).includes(q)) excerpt = found;
  }
  if (excerpt === "" && last !== null && last !== first) {
    excerpt = truncateGraphemes(last, EXCERPT_MAX);
  }
  return {
    heading: truncateGraphemes(first, HEADING_MAX),
    excerpt,
    headingIsDerived: true,
  };
}
