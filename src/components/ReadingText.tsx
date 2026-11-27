import { useMemo, type ReactNode } from "react";

// Keep URLs and non-Latin scripts in their natural orientation. The inline runs
// include accents and joining marks so they don't introduce a shaping boundary.
const LATIN_OR_URL = /(?:https?:\/\/|www\.)[^\p{White_Space}]+|(?:\p{Script=Latin}[\p{Mark}\u200c\u200d]*)+(?:['’-](?:\p{Script=Latin}[\p{Mark}\u200c\u200d]*)+)*/giu;

export function ReadingText({ text }: { text: string }) {
  return useMemo(() => {
    const parts: ReactNode[] = [];
    let end = 0;
    for (const match of text.matchAll(LATIN_OR_URL)) {
      const start = match.index;
      const run = match[0];
      if (/^(?:https?:\/\/|www\.)/i.test(run)) continue;
      if (start > end) parts.push(text.slice(end, start));
      parts.push(<span key={start} className="read-upright-latin">{run}</span>);
      end = start + run.length;
    }
    if (end < text.length) parts.push(text.slice(end));
    return parts;
  }, [text]);
}
