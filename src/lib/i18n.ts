export type PoeticLines = readonly [string, ...string[]];

/**
 * 残心 / Zanshin の文言。
 * 日本語をメインとし、英語のサブ表現を併記する。
 */
export const copy = {
  appName: "残心",
  appSubtitle: "Zanshin Notes",
  taglineLines: ["書いたあとにも、", "心が残る。"] as PoeticLines,
  taglineEn: "A quiet place for words that remain.",
  zanshinDefinitionLines: [
    "残心とは、",
    "書き終えたあとにも",
    "心が静かに残ること。",
  ] as PoeticLines,

  // 一覧
  searchPlaceholder: "残した言葉を探す",
  searchPlaceholderEn: "Find the words you left behind",
  clearSearch: "検索を消す",
  clearSearchEn: "Clear search",
  newNote: "言葉を置く",
  newNoteEn: "Place new words",
  notesCount: "余韻",
  notesCountEmpty: "まだ余韻はありません",
  localOnly: "端末内に保存",
  openReadMode: "読み返す",
  favorites: "大切な余韻",
  favoriteBadge: "金のしるし",
  lastRemains: "最後の余韻",
  settledOn: "残した日",

  // 空状態
  emptyTitleLines: ["まだ、言葉は置かれていません。"] as PoeticLines,
  emptySubtitleLines: [
    "その日の余白に、",
    "最初の言葉を残す。",
  ] as PoeticLines,
  emptyAction: "最初の余白をひらく",

  // エディタ
  back: "戻る",
  backEn: "Back",
  titlePlaceholder: "この余白に名をつける",
  titlePlaceholderEn: "Place a title",
  bodyPlaceholder: "いま残したい言葉を、ここに。",
  bodyPlaceholderEn: "Place the words you wish to leave, quietly.",
  untitled: "名のない余韻",
  untitledEn: "Untitled trace",
  editNote: "言葉を直す",
  editNoteEn: "Edit",

  // 読み返し
  readNote: "読み返す",
  readNoteEn: "Read",
  readModeHint: "横へ静かに読み進める",
  exitReadMode: "書く場所へ戻る",
  exitReadModeEn: "Back to writing",
  emptyReadBody: "まだ、言葉は置かれていません。",
  emptyReadBodyEn: "No words have been placed yet.",

  // 保存・状態
  saved: "保存済み",
  savedEn: "Saved",
  saving: "保存中",
  savingEn: "Saving",
  saveError: "保存できませんでした",
  saveErrorEn: "Could not save",
  saveErrorQuota: "保存領域の上限に達したため、保存できませんでした",
  saveErrorUnavailable: "端末内の保存先を利用できませんでした",
  saveErrorInvalidData: "この内容を安全に保存できませんでした",
  retrySave: "もう一度保存する",
  retrySaveEn: "Try saving again",
  saveConflict: "別の変更と重なったため、保存を止めています",
  saveConflictEn: "Saving paused because another change was detected",
  saveRecovery: "復元内容を確認するまで、保存を止めています",
  storageConflictTitle: "保存先の内容が変わっています",
  storageConflictBody:
    "別の画面で更新されたか、復元中のデータがあります。自動保存を止めています。保存先を読み込むと、この画面の未保存編集は破棄されます。",
  storageRecoveryTitle: "保存データを確認してください",
  storageConflictRecoveryBody:
    "保存先のデータに問題があるため、自動保存を止めています。この画面に残っている内容を確認し、それを保存し直す場合だけ選んでください。可能な場合は元の問題データも退避します。",
  storageRecoveryCandidateCount: (count: number) =>
    `復元候補を${count}件表示しています。`,
  storageConflictLoad: "未保存編集を破棄して読み込む",
  storageConflictOverwrite: "この画面の編集で上書き",
  storageRecoverySave: "この画面の内容で保存し直す",

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
    "この言葉を静かに手放しますか？\n削除したあとも、しばらくは元に戻せます。",
  deleteConfirmBodyEn:
    "Let this note go quietly?\nYou can undo for a short while after deleting it.",
  cancel: "残しておく",
  cancelEn: "Keep it",
  confirmDelete: "手放す（削除）",
  confirmDeleteEn: "Release (delete)",
  undoDelete: "元に戻す",
  undoDeleteEn: "Undo",
  undoDeleteMessage: "余韻を手放しました",
  undoDeleteMessageEn: "Trace released",

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
