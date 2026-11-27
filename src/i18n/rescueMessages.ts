import type { UiLocale } from "./locales";

export type CopyFeedback = {
  copying: string;
  copied: string;
  copyFailed: string;
};

type RescueMessages = CopyFeedback & {
  copyBody: string;
  copyTitle: string;
  originalTitle: string;
  originalText: string;
  renderFailureTitle: string;
  renderFailureUnsaved: string;
  renderFailureNoUnsaved: string;
  renderFailureUnknown: string;
  renderFailureReload: string;
  unsavedNoteLabel: string;
};

export const rescueMessages = {
  ja: {
    copyBody: "本文をコピー",
    copyTitle: "タイトルをコピー",
    copying: "コピー中…",
    copied: "コピーしました",
    copyFailed: "コピーできませんでした。下の文章を選択してコピーしてください。",
    originalTitle: "タイトルの原文",
    originalText: "本文の原文",
    renderFailureTitle: "表示に問題が起きました",
    renderFailureUnsaved: "保存できていない変更があります。再読み込みする前に、下の文章をコピーしてください。",
    renderFailureNoUnsaved: "保存できていない変更は確認されませんでした。再読み込みして開き直せます。",
    renderFailureUnknown: "保存の状況を確認できませんでした。再読み込みすると、保存されていない内容は失われることがあります。",
    renderFailureReload: "再読み込みして開き直す",
    unsavedNoteLabel: "保存できていない内容",
  },
  en: {
    copyBody: "Copy text",
    copyTitle: "Copy title",
    copying: "Copying…",
    copied: "Copied",
    copyFailed: "Couldn’t copy. Select and copy the text below.",
    originalTitle: "Original title",
    originalText: "Original text",
    renderFailureTitle: "Something went wrong with the display",
    renderFailureUnsaved: "Some changes are unsaved. Copy the text below before reopening the app.",
    renderFailureNoUnsaved: "No unsaved changes were found. You can reload to reopen the app.",
    renderFailureUnknown: "We couldn’t check what was saved. Reloading may lose unsaved changes.",
    renderFailureReload: "Reload to reopen the app",
    unsavedNoteLabel: "Unsaved content",
  },
} satisfies Record<UiLocale, RescueMessages>;
