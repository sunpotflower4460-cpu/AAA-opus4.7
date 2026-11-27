import type { BookDraft } from "./model";

let rescue: BookDraft | null = null;

export function rememberBookDraft(value: BookDraft | null) {
  rescue = value;
}

export function getBookRescue() {
  return rescue;
}
