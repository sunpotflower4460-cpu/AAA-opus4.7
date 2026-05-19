export type PoeticLines = readonly [string, ...string[]];

/**
 * 残心 / Zanshin の文言。
 * 日本語をメインとし、英語のサブ表現を併記する。
 */
export const copy = {
  appName: "残心",
  appSubtitle: "Zanshin Notes",
  taglineLines: ["書いたあとにも、", "心が残る。"] as PoeticLines,
  taglineEnLines: ["A quiet place", "for words that remain."] as PoeticLines,
  zanshinDefinitionLines: [
    "残心とは、",
    "書き終えたあとにも",
    "心が静かに残っていること。",
  ] as PoeticLines,

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
  emptyTitleLines: ["まだ、言葉は", "置かれていません。"] as PoeticLines,
  emptySubtitleLines: [
    "書き終えたあとに残る、",
    "心のしずけさをここに。",
  ] as PoeticLines,
  emptySubtitleEnLines: ["A quiet place", "for words that remain."] as PoeticLines,
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

  // Monetization
  adLabel: "広告",
  adLabelEn: "Ad",
  adSectionLabel: "広告セクション",
  adSlotBody: "静かな余白を守るための小さな広告枠",
  adSlotBodyEn: "A small support space for Zanshin.",
  removeAds: "広告を外す",
  removeAdsEn: "Remove ads",
  premiumName: "残心 Premium",
  premiumBody: "広告を外して、\n静かな余白を守ります。",
  premiumBodyEn: "Remove ads.\nKeep the stillness.",
  premiumActiveBody: "静かな余白を守っています。",
  premiumActiveBodyEn: "Stillness is being kept.",
  premiumCta: "静かな余白を守る",
  premiumManage: "静けさの詳細を見る",
  restorePurchase: "購入を復元",
  premiumSheetBody: "広告を外して、書く前後の静けさを守ります。",
  premiumSheetBodyEn: "Remove ads. Keep the stillness before and after writing.",
  premiumIncluded: "含まれるもの",
  premiumBenefitAdsFree: "広告なし",
  premiumBenefitCalm: "書く画面の静けさを維持",
  premiumBenefitSupport: "今後の開発支援",
  premiumPriceNote: "価格は App Store の表示を使用します。",
  premiumMockNote:
    "Phase 7 ではモック実装です。本番申請前に StoreKit と実際の購入復元処理へ差し替えます。",
  purchaseMock: "購入する（モック）",
  premiumLoading: "静かに確認しています…",
  premiumError: "購入状態を確認できませんでした。時間を置いて、もう一度お試しください。",
  later: "あとで",
  mockDisablePremium: "モック Premium を解除する",
} as const;

export type Copy = typeof copy;
