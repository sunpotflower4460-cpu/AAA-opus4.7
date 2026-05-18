/**
 * 残心 / Zanshin の文言。
 * 日本語をメインとし、英語のサブ表現を併記する。
 */
export const copy = {
  appName: "残心",
  appSubtitle: "Zanshin Notes",
  tagline: "書いたあとにも、心がそこに残るメモ帳。",
  taglineEn: "A quiet place for words that remain.",
  zanshinDefinition: "残心とは、\n書き終えたあとにも\n心が静かに残っていること。",

  // 一覧
  searchPlaceholder: "残した言葉を探す",
  searchPlaceholderEn: "Find the words you left behind",
  newNote: "言葉を置く",
  newNoteEn: "Place new words",
  favorites: "大切な余韻",
  favoriteBadge: "金のしるし",
  lastRemains: "最後の余韻",
  settledOn: "残した日",

  // 空状態
  emptyTitle: "まだ、言葉は置かれていません。",
  emptySubtitle: "残心とは、\n書き終えたあとにも\n心が静かに残っていること。",
  emptySubtitleEn: "The first quiet trace begins here.",
  emptyAction: "最初の余韻を残す",
  emptyActionEn: "Leave the first trace",

  // エディタ
  back: "戻る",
  backEn: "Back",
  titlePlaceholder: "題を置く",
  titlePlaceholderEn: "Place a title",
  bodyPlaceholder: "いま残したい言葉を、静かに置く。",
  bodyPlaceholderEn: "Place the words you wish to leave, quietly.",
  untitled: "名のない余韻",
  untitledEn: "Untitled trace",

  // 保存・状態
  saved: "余韻を保存しました",
  savedEn: "Saved in stillness",
  saving: "余韻を静かに整えています",
  savingEn: "Settling in stillness",

  // お気に入り
  favoriteOn: "大切な余韻として残す",
  favoriteOff: "大切な余韻から外す",
  favoriteOnEn: "Keep as a treasured trace",
  favoriteOffEn: "Remove treasured trace",

  // 削除
  deleteNote: "この余韻を手放す",
  deleteNoteEn: "Let this trace go",
  deleteConfirmTitle: "この余韻を手放しますか？",
  deleteConfirmTitleEn: "Let this trace go?",
  deleteConfirmBody:
    "この言葉を静かに手放しますか？\n削除すると、あとから戻すことはできません。",
  deleteConfirmBodyEn:
    "Let this note go quietly?\nOnce deleted, it cannot be brought back.",
  cancel: "残しておく",
  cancelEn: "Keep it",
  confirmDelete: "手放す（削除）",
  confirmDeleteEn: "Release (delete)",

  // 検索結果
  noSearchResult: "その言葉は、まだ見つかっていません。",
  noSearchResultEn: "That trace has not appeared yet.",
} as const;

export type Copy = typeof copy;
