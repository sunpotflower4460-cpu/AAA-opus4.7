import { graphemeSegments } from "unicode-segmenter/grapheme";
import type { Appearance, Cover } from "./model";
import { brushFamily } from "./catalog";

export type PageSize = "A5" | "A6" | "square" | "portrait";
export type Surface = "paper" | "light" | "white";
export type OutputText = { title: string; body: string };
type SidewaysRun = { start: number; end: number; rtl: boolean };
export type Line = {
  text: string; x: number; y: number; size: number; vertical: boolean; rtl: boolean; advance: number;
  sideways: SidewaysRun[];
};
export type Page = { lines: Line[]; cover: boolean };
export type Layout = {
  width: number; height: number; pages: Page[]; appearance: Appearance; surface: Surface;
};

const SIZES: Record<PageSize, readonly [number, number]> = {
  A5: [419.53, 595.28], A6: [297.64, 419.53], square: [420, 420], portrait: [360, 640],
};
const MARGIN = 31;
const BODY_SIZE = 14;
const SIDEWAYS = /(?:https?:\/\/|www\.)[^\s]+|[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}](?:[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}\p{Mark} ]|\u200c|\u200d)*/gu;
const RTL = /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}]/u;
const VERTICAL_FORMS: Record<string, string> = {
  "（": "︵", "）": "︶", "「": "﹁", "」": "﹂", "『": "﹃", "』": "﹄",
  "【": "︻", "】": "︼", "…": "︙", "―": "︱", "ー": "︱",
};
const NO_START = /^[、。，．！？）」』】〕〉》］…ー]/u;
const NO_END = /^[（「『【〔〈《［]/u;

function font(size: number, brush: string) {
  return `${size}px ${brushFamily(brush, true)}`;
}

function splitLine(text: string, fits: (line: string) => boolean): string[] {
  if (text === "") return [""];
  const parts: string[] = [];
  // Wrapping first at word boundaries keeps ordinary English and URLs intact.
  for (const word of text.matchAll(/[^\s\u3000]+|[\s\u3000]+/gu)) {
    const token = word[0];
    if (fits(token)) parts.push(token);
    else for (const segment of graphemeSegments(token)) parts.push(segment.segment);
  }
  const lines: string[] = [];
  let line = "";
  for (const part of parts) {
    if (line && !fits(line + part)) {
      if (NO_START.test(part)) {
        const clusters = [...graphemeSegments(line)];
        const last = clusters[clusters.length - 1];
        if (last.index > 0 && fits(last.segment + part)) {
          lines.push(line.slice(0, last.index));
          line = last.segment + part;
          continue;
        }
      }
      const segments = [...graphemeSegments(line)];
      const last = segments[segments.length - 1];
      if (last && last.index > 0 && NO_END.test(last.segment) && fits(last.segment + part)) {
        lines.push(line.slice(0, last.index));
        line = last.segment + part;
        continue;
      }
      lines.push(line);
      line = "";
    }
    line += part;
  }
  if (line) lines.push(line);
  return lines;
}

function firstStrongRtl(text: string) {
  const firstLetter = text.match(/\p{Letter}/u)?.[0];
  return Boolean(firstLetter && RTL.test(firstLetter));
}

function sidewaysRuns(text: string): SidewaysRun[] {
  return [...text.matchAll(SIDEWAYS)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
    rtl: firstStrongRtl(match[0]),
  }));
}

export function layoutPages(
  context: CanvasRenderingContext2D,
  options: { text: OutputText[]; cover?: Cover; appearance: Appearance; size: PageSize; surface: Surface; contents?: boolean },
): Layout {
  const { text, cover, appearance, size, surface, contents } = options;
  const [width, height] = SIZES[size];
  const vertical = appearance.direction === "vertical";
  const inline = vertical ? height : width;
  const block = vertical ? width : height;
  const pages: Page[] = [{ lines: [], cover: Boolean(cover && (cover.title || cover.author || cover.date || cover.detail || cover.address || appearance.cover !== "plain")) }];
  let page = pages[0];
  let cursor = MARGIN;

  function nextPage(isCover = false) {
    if (page.lines.length === 0 && !page.cover) return;
    page = { cover: isCover, lines: [] };
    pages.push(page);
    cursor = MARGIN;
  }

  function write(value: string, size = BODY_SIZE, gap = 0) {
    const advance = size * 1.71;
    context.font = font(size, appearance.brush);
    cursor += gap;
    for (const originalLine of value.split(/\r\n|[\r\n\u2028\u2029]/u)) {
      const isRtl = firstStrongRtl(originalLine);
      const runs = vertical ? sidewaysRuns(originalLine) : [];
      let start = 0;
      let runIndex = 0;
      const available = inline - MARGIN * 2;
      const fits = (line: string) => vertical
        ? [...graphemeSegments(line)].length * size * 1.13 <= available
        : context.measureText(line.replace(/\t/g, "    ")).width <= available;
      for (const line of splitLine(originalLine, fits)) {
        if (cursor + advance > block - MARGIN) nextPage(page.cover && text.length === 0);
        const end = start + line.length;
        const sideways: SidewaysRun[] = [];
        // Find runs in the source line so a URL stays sideways after wrapping.
        while (runIndex < runs.length && runs[runIndex].end <= start) runIndex++;
        for (let index = runIndex; index < runs.length && runs[index].start < end; index++) {
          const run = runs[index];
          sideways.push({ start: Math.max(0, run.start - start), end: Math.min(line.length, run.end - start), rtl: run.rtl });
        }
        page.lines.push({
          text: line, size, vertical, rtl: isRtl,
          x: vertical ? width - cursor - size : isRtl ? width - MARGIN : MARGIN,
          y: vertical ? MARGIN : cursor + size,
          advance: vertical ? [...graphemeSegments(line)].length * size * 1.13
            : context.measureText(line.replace(/\t/g, "    ")).width,
          sideways,
        });
        start = end;
        cursor += advance;
      }
    }
  }

  if (page.cover && cover) {
    cursor = block * 0.22;
    if (cover.title) write(cover.title, 24);
    if (cover.author) write(cover.author, 14, 13);
    if (cover.date) write(cover.date, 13, 8);
    if (cover.detail) write(cover.detail, 14, 21);
    if (cover.address) write(cover.address, 14, 13);
    nextPage();
  }
  if (contents) {
    for (const piece of text) if (piece.title) write(piece.title, 14, 5);
    if (page.lines.length > 0) nextPage();
  }
  if (cover?.front) write(cover.front, BODY_SIZE);
  for (const [index, piece] of text.entries()) {
    // Keep a short title together with the beginning of its piece.
    if (piece.title && cursor + BODY_SIZE * 5 > block - MARGIN) nextPage();
    if (piece.title) write(piece.title, 19, index > 0 ? 13 : 0);
    if (piece.body) write(piece.body, BODY_SIZE, piece.title ? 5 : index > 0 ? 13 : 0);
    if (appearance.format === "BK03" && index < text.length - 1) nextPage();
  }
  if (cover?.closing) write(cover.closing, BODY_SIZE, 13);
  if (cover?.after) write(cover.after, BODY_SIZE, 21);
  return { width, height, pages, appearance, surface };
}

export function paintText(context: CanvasRenderingContext2D, page: Page, appearance: Appearance) {
  for (const line of page.lines) {
    context.font = font(line.size, appearance.brush);
    if (!line.vertical) {
      context.direction = line.rtl ? "rtl" : "ltr";
      context.textAlign = "start";
      context.fillText(line.text.replace(/\t/g, "    "), line.x, line.y);
      continue;
    }
    context.direction = "ltr";
    context.textAlign = "center";
    let y = line.y + line.size * 0.78;
    const interval = line.size * 1.13;
    const center = line.x + line.size / 2;
    function paintUpright(text: string) {
      for (const { segment } of graphemeSegments(text)) {
        const glyph = VERTICAL_FORMS[segment] ?? segment;
        context.fillText(glyph, center, y);
        y += interval;
      }
    }
    let offset = 0;
    for (const run of line.sideways) {
      paintUpright(line.text.slice(offset, run.start));
      const text = line.text.slice(run.start, run.end);
      const reserved = [...graphemeSegments(text)].length * interval;
      context.save();
      context.translate(center, y - line.size * 0.75 + reserved / 2);
      context.rotate(Math.PI / 2);
      context.direction = run.rtl ? "rtl" : "ltr";
      context.fillText(text, 0, line.size * 0.3, reserved);
      context.restore();
      y += reserved;
      offset = run.end;
    }
    paintUpright(line.text.slice(offset));
  }
}
