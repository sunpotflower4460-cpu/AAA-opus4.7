type Segmenter = { segment(text: string): Iterable<{ segment: string; index: number }> };

export function graphemes(text: string) {
  const Constructor = (Intl as typeof Intl & {
    Segmenter?: new (locale?: string, options?: { granularity: "grapheme" }) => Segmenter;
  }).Segmenter;
  try {
    return Constructor ? new Constructor(undefined, { granularity: "grapheme" }).segment(text) : null;
  } catch {
    return null;
  }
}

export function countGraphemes(text: string): number | null {
  const parts = graphemes(text);
  if (!parts) return null;
  let count = 0;
  for (const _ of parts) count += 1;
  return count;
}

export function truncateGraphemes(text: string, max: number): string {
  const parts = graphemes(text);
  if (!parts) return text;
  let count = 0;
  for (const { index } of parts) {
    if (count === max) return `${text.slice(0, index)}…`;
    count += 1;
  }
  return text;
}
