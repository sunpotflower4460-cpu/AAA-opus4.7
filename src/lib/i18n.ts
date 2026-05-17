/**
 * 残心 / Zanshin の文言。
 * 日本語をメインとし、英語のサブ表現を併記する。
 */
export const copy = {
  appName: "残心",
  appSubtitle: "Zanshin Notes",
  tagline: "書いたあとにも、心がそこに残るメモ帳。",
  taglineEn: "Write with stillness.",

  // 一覧
  searchPlaceholder: "言葉を探す",
  searchPlaceholderEn: "Search your words",
  newNote: "新しい余白",
  newNoteEn: "Open a new space",
  favorites: "お気に入り",

  // 空状態
  emptyTitle: "まだ、言葉は置かれていません。",
  emptySubtitle: "No words have settled yet.",
  emptyAction: "新しい余白をひらく",
  emptyActionEn: "Open a new space",

  // エディタ
  back: "戻る",
  backEn: "Back",
  titlePlaceholder: "題（つけなくてもよい）",
  titlePlaceholderEn: "Title (optional)",
  bodyPlaceholder: "ここに、静かに置いてください。",
  bodyPlaceholderEn: "Place your words here, quietly.",
  untitled: "無題の余白",
  untitledEn: "Untitled space",

  // 保存・状態
  saved: "余韻を保存しました",
  savedEn: "Saved in stillness",
  saving: "そっと書き留めています",
  savingEn: "Settling…",

  // お気に入り
  favoriteOn: "大切な言葉として残す",
  favoriteOff: "大切な言葉から外す",
  favoriteOnEn: "Mark as treasured",
  favoriteOffEn: "Unmark treasured",

  // 削除
  deleteNote: "言葉を手放す",
  deleteNoteEn: "Let go of this note",
  deleteConfirmTitle: "この言葉を手放しますか？",
  deleteConfirmTitleEn: "Let this note go?",
  deleteConfirmBody:
    "一度手放すと、戻すことはできません。\n本当に削除してもよろしいですか？",
  deleteConfirmBodyEn:
    "Once released, it cannot be brought back.\nAre you sure you want to delete it?",
  cancel: "やめる",
  cancelEn: "Cancel",
  confirmDelete: "手放す",
  confirmDeleteEn: "Release",

  // 検索結果
  noSearchResult: "見つかりませんでした。",
  noSearchResultEn: "Nothing was found.",
} as const;

export type Copy = typeof copy;
