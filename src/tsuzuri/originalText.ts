export function selectedOriginal(source: string, start: number, end: number) {
  if (start >= end) return "";
  let uiOffset = 0;
  let rawStart = 0;
  let rawEnd = 0;
  while (rawEnd < source.length && uiOffset < end) {
    if (uiOffset === start) rawStart = rawEnd;
    rawEnd += source.charAt(rawEnd) === "\r" && source.charAt(rawEnd + 1) === "\n" ? 2 : 1;
    uiOffset++;
  }
  return source.slice(rawStart, rawEnd);
}

export function preserveUneditedText(original: string, input: string): string {
  const normalized = original.replace(/\r\n?/g, "\n");
  if (normalized === input) return original;
  let prefix = 0;
  let suffix = 0;
  while (prefix < normalized.length && normalized[prefix] === input[prefix]) prefix++;
  while (suffix < normalized.length - prefix && suffix < input.length - prefix &&
    normalized[normalized.length - suffix - 1] === input[input.length - suffix - 1]) suffix++;
  return selectedOriginal(original, 0, prefix) + input.slice(prefix, input.length - suffix) +
    selectedOriginal(original, normalized.length - suffix, normalized.length);
}
