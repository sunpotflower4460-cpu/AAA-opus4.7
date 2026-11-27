import type { Note } from "../types/note";
import { graphemes, truncateGraphemes } from "./graphemes";
import { findSearchMatch, HORIZONTAL_SPACES, LINE_BREAKS, normalizeSearchQuery } from "./notesLogic";

export function hasVisibleText(text: string): boolean {
  return /[^\p{White_Space}\p{Default_Ignorable_Code_Point}\p{Cc}]/u.test(text);
}

function firstVisibleLine(text: string): string | null {
  return text.split(LINE_BREAKS).find(hasVisibleText)?.trim() ?? null;
}

export function getNoteHeading(note: Note): { text: string | null; source: "title" | "body" | "untitled" } {
  if (hasVisibleText(note.title)) return { text: note.title, source: "title" };
  const line = firstVisibleLine(note.body);
  return { text: line, source: line === null ? "untitled" : "body" };
}

type Excerpt = { text: string; directionSource?: string };

/** Map comparison offsets to whole graphemes in the original line. */
export function matchExcerpt(text: string, query: string, context = 14): Excerpt | null {
  const needle = normalizeSearchQuery(query);
  const match = findSearchMatch(text, needle);
  if (!match) return null;

  const original = { text: match.line };
  const segments = graphemes(match.line);
  if (!segments) return original;

  const mapped: { index: number; end: number }[] = [];
  const comparisonParts: string[] = [];
  let comparisonOffset = 0;
  let inSpaceRun = false;
  for (const { segment, index } of segments) {
    const normalized = segment.normalize("NFC").replace(HORIZONTAL_SPACES, " ");
    const isSpace = normalized === " ";
    const part = isSpace && inSpaceRun ? "" : normalized;
    inSpaceRun = isSpace;
    comparisonParts.push(part);
    comparisonOffset += part.toLowerCase().length;
    mapped.push({ index, end: comparisonOffset });
  }

  // If segment-by-segment mapping and whole-string folding disagree, keep the full original line.
  const mappedComparison = comparisonParts.join("").toLowerCase();
  if (mappedComparison !== match.comparison || comparisonOffset !== match.comparison.length) return original;
  const start = mapped.findIndex(({ end }) => end > match.index);
  const end = mapped.findIndex(({ end }) => end >= match.index + needle.length);
  if (start < 0 || end < 0) return original;

  const from = Math.max(0, start - context);
  const to = end + 1 + context;
  if (from === 0 && to >= mapped.length) return original;

  const clipped = match.line.slice(mapped[from].index, mapped[to]?.index);
  return {
    text: `${from > 0 ? "…" : ""}${clipped}${to < mapped.length ? "…" : ""}`,
    directionSource: match.line,
  };
}

export function getCardDisplay(note: Note, query = "") {
  const heading = getNoteHeading(note);
  const last = note.body.split(LINE_BREAKS).filter(hasVisibleText).pop()?.trim() ?? null;
  const visibleHeading = heading.source === "body" && heading.text !== null
    ? truncateGraphemes(heading.text, 80)
    : heading.text;
  const bodyMatch = matchExcerpt(note.body, query);
  const titleMatch = bodyMatch === null ? matchExcerpt(note.title, query) : null;
  const match = bodyMatch ?? titleMatch;

  let excerpt: Excerpt | null = null;
  if (match && match.text !== visibleHeading) {
    // The title itself is already visible for short, title-only matches.
    if (!titleMatch || titleMatch.directionSource || titleMatch.text !== note.title) excerpt = match;
  }
  if (!excerpt && last !== null && last !== heading.text) {
    const shortened = truncateGraphemes(last, 72);
    excerpt = { text: shortened, directionSource: shortened !== last ? last : undefined };
  }

  return { heading: visibleHeading, headingSource: heading.source, excerpt };
}
