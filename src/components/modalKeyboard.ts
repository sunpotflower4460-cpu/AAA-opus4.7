import type { KeyboardEvent } from "react";

const controls =
  "button:not(:disabled), a[href], select:not(:disabled), textarea:not(:disabled), input:not(:disabled):not([type=hidden]), summary, [tabindex='0']";

export function handleModalKeyDown(event: KeyboardEvent<HTMLDivElement>, onClose: () => void) {
  if (event.defaultPrevented) return;
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    onClose();
    return;
  }
  if (event.key !== "Tab") return;

  const items = [...event.currentTarget.querySelectorAll<HTMLElement>(controls)].filter((element) => {
    const closedDetails = element.closest("details:not([open])");
    if (closedDetails && element !== closedDetails.firstElementChild) return false;
    return element.getClientRects().length > 0 && getComputedStyle(element).visibility === "visible";
  });
  if (items.length === 0) return;

  const current = items.findIndex((item) => item === document.activeElement);
  const next = event.shiftKey
    ? items[current - 1] ?? items[items.length - 1]
    : items[current + 1] ?? items[0];
  event.preventDefault();
  next.focus();
}
