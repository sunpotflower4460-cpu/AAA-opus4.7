import type { ReadingMode } from "./uiPreferences";

export type ReadingPosition = {
  mode: ReadingMode;
  body: string;
  offset: number | null;
  distance: number;
  progress: number;
};

type CaretDocument = Document & {
  caretRangeFromPoint?(x: number, y: number): Range | null;
};

function scrollExtent(element: HTMLElement, mode: ReadingMode) {
  return mode === "horizontal"
    ? element.scrollHeight - element.clientHeight
    : element.scrollWidth - element.clientWidth;
}

/** Save a position in the original text so it can be located after reflow. */
export function captureReadingPosition(element: HTMLElement, text: string, mode: ReadingMode): ReadingPosition {
  const distance = mode === "horizontal" ? element.scrollTop : Math.abs(element.scrollLeft);
  const extent = scrollExtent(element, mode);
  const progress = extent > 0 ? Math.min(1, distance / extent) : 0;
  const body = element.querySelector("pre");
  let offset: number | null = null;

  if (distance > 0 && body?.firstChild) {
    const viewport = element.getBoundingClientRect();
    const bounds = body.getBoundingClientRect();
    const x = Math.min(viewport.right, bounds.right);
    const y = Math.max(viewport.top, bounds.top);
    const byPoint = document as CaretDocument;
    // Sample into the visible area to skip whitespace and the paper's padding.
    for (const inset of [12, 28, 48]) {
      const caret = mode === "horizontal"
        ? byPoint.caretRangeFromPoint?.(Math.max(viewport.left, bounds.left) + inset, y + 8)
        : byPoint.caretRangeFromPoint?.(x - inset, y + 8);
      if (caret && body.contains(caret.startContainer)) {
        const before = document.createRange();
        before.selectNodeContents(body);
        before.setEnd(caret.startContainer, caret.startOffset);
        offset = before.toString().length;
        break;
      }
    }
  }

  return { mode, body: text, offset, distance, progress };
}

export function restoreReadingPosition(
  element: HTMLElement,
  text: string,
  mode: ReadingMode,
  position: ReadingPosition,
) {
  if (position.mode === mode && position.body === text) {
    if (mode === "horizontal") element.scrollTop = position.distance;
    else element.scrollLeft = -position.distance;
    return;
  }

  const body = element.querySelector("pre");
  if (position.offset !== null && position.body === text && body) {
    const bounds = locateCharacter(body, position.offset)?.getBoundingClientRect();
    if (bounds && (bounds.width > 0 || bounds.height > 0)) {
      const viewport = element.getBoundingClientRect();
      if (mode === "horizontal") element.scrollTop += bounds.top - viewport.top - 8;
      else element.scrollLeft += bounds.right - viewport.right + 12;
      return;
    }
  }

  const distance = position.progress * scrollExtent(element, mode);
  if (mode === "horizontal") element.scrollTop = distance;
  else element.scrollLeft = -distance;
}

function locateCharacter(body: HTMLElement, offset: number): Range | null {
  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? "";
    if (remaining < text.length) {
      const range = document.createRange();
      range.setStart(node, remaining);
      // WebKit can return an empty rectangle for a collapsed vertical range.
      const codePoint = text.codePointAt(remaining) ?? 0;
      range.setEnd(node, remaining + (codePoint > 0xffff ? 2 : 1));
      return range;
    }
    remaining -= text.length;
  }
  return null;
}
