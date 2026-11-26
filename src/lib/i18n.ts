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
  newNote: "メモを書く",
  newNoteEn: "Place new words",
  notesCount: "余韻",
  notesCountEmpty: "まだ残した言葉はありません",
  notesCountLabel: (count: number) => `残した言葉 ${count}件`,
  searchResultCountLabel: (count: number) =>
    count === 0 ? "一致するメモは0件です" : `${count}件 見つかりました`,
  localOnly: "この端末に保存",
  openReadMode: "読み返す",
  favorites: "大切な余韻",
  favoriteBadge: "金のしるし",
  lastRemains: "最後の余韻",
  settledOn: "残した日",

  // 空状態
  emptyTitleLines: ["ひとことでも、", "途中のままでも。"] as PoeticLines,
  emptySubtitleLines: [
    "入力した内容は、",
    "この端末に自動保存されます。",
  ] as PoeticLines,
  emptyAction: "メモを書く",

  // エディタ
  // 戻る操作は、行き先で呼ぶ（D16）。既定は一覧。
  back: "一覧へ",
  backToSearch: "検索結果へ",
  backToRead: "読み返しへ",
  backEn: "Back",
  titlePlaceholder: "タイトル（任意）",
  titlePlaceholderEn: "Place a title",
  bodyPlaceholder: "いま残したい言葉を、ここに。",
  bodyPlaceholderEn: "Place the words you wish to leave, quietly.",
  untitled: "名のない余韻",
  untitledEn: "Untitled trace",
  editNote: "編集する",
  editNoteEn: "Edit",

  // 読み返し
  readNote: "読み返す",
  readNoteEn: "Read",
  readModeHint: "横へ静かに読み進める",
  readModeMore: "左へ続きます",
  exitReadMode: "書く場所へ戻る",
  exitReadModeEn: "Back to writing",
  emptyReadBody: "まだ、言葉は置かれていません。",
  emptyReadBodyEn: "No words have been placed yet.",

  // 保存・状態
  saved: "保存済み",
  savedEn: "Saved",
  saving: "保存中",
  savingEn: "Saving",
  saveError: "最新の変更を保存できませんでした",
  saveErrorEn: "Could not save",
  saveErrorQuota: "メモの保存領域が足りないため、最新の変更を保存できませんでした",
  saveErrorUnavailable: "端末内の保存先を利用できなかったため、最新の変更を保存できませんでした",
  saveErrorInvalidData: "この内容を安全に保存できませんでした",
  deleteSaveFailed:
    "削除を保存できませんでした。この端末にはまだ元のメモが残っています。",
  retrySave: "もう一度保存する",
  retrySaveEn: "Try saving again",
  nativeBackupError:
    "最新の変更は保存済みです。端末内の予備保存を更新できませんでした。",
  // このアプリについて（R04 / D15）
  aboutOpen: "このアプリについて",
  aboutTitle: "残心 / Zanshin",
  aboutClose: "閉じる",
  aboutLead:
    "静かに書き、読み返すためのメモ帳です。現在のバージョンは無料で、広告はありません。アカウント登録も不要です。",
  aboutStorageTitle: "保存について",
  aboutStorageBody:
    "メモは、この端末に自動で保存されます。クラウド同期はありません。端末内の予備保存は、同じ端末で内容を復旧するためのものです。別の端末や機種変更後に必ず戻せる仕組みではありません。",
  aboutStorageCaution:
    "保存できない案内が出た時は、最新の変更がまだ残せていないことがあります。表示された操作で確認し、必要に応じて題名や本文をコピーしてください。アプリの削除やデータの消去をすると、メモを取り戻せなくなる場合があります。",
  aboutDeleteTitle: "削除について",
  aboutDeleteBody:
    "削除後10秒間は、直前の1件を「元に戻す」で取り消せます。アプリを終了・再起動した後は取り消せません。必要な文章かを確認してから削除してください。",
  aboutPinTitle: "大切なメモを先頭へ",
  aboutPinBody:
    "「先頭に留める」を選ぶと、金のしるしが付き、一覧の先頭のグループに置かれます。固定したメモとそのほかのメモは、それぞれ変更の新しい順に並びます。しるしの付け外しも変更として扱います。",
  aboutPrivacyTitle: "プライバシー",
  aboutPrivacyPoints: [
    "メモの内容は、この端末の中にだけ保存します。外部のサーバーへは送信しません。",
    "広告・分析・追跡のための仕組みは使っていません。許可を求める画面（位置情報・連絡先・写真など）もありません。",
    "アプリは端末内の機能（Capacitor）で動作します。アカウント情報や識別子は収集しません。",
    "iOS の端末バックアップ（iCloud バックアップなど）をお使いの場合は、iOS の仕組みによりアプリのデータがそのバックアップに含まれることがあります。",
  ] as readonly string[],
  aboutSupportTitle: "お問い合わせ",
  aboutSupportBody:
    "不具合やご質問は、下の GitHub Issues からお知らせください。投稿は公開されます。メモの本文、個人情報、他の人の情報は書かず、困っている操作とアプリのバージョンをお知らせください。",
  aboutSupportLink: "GitHub Issues を開く（外部ブラウザ）",
  aboutSupportHint: "機種・iOS のバージョン・アプリのバージョン・起きた操作を添えていただくと、確認しやすくなります。",
  aboutVersion: "バージョン",
  aboutVersionUnknown: "取得できませんでした",
  aboutVersionDev: "開発ビルド（Web）",
  aboutLinkFailed: "リンクを開けませんでした。アプリへ戻って、もう一度お試しください。",
  // 復元候補の比較（R23）と保護候補の整理（R34）
  recoveryReviewOpen: "内容を確認する",
  recoveryReviewTitle: "保存内容を見比べる",
  recoveryReviewLead:
    "候補を選ぶと、含まれているメモを読めます。ここで見るだけでは、保存内容は何も変わりません。",
  recoveryReviewClose: "閉じる",
  recoveryReviewEmpty: "メモは0件です（すべて削除した内容）",
  recoveryReviewCount: (count: number) => `メモ ${count}件`,
  recoveryReviewLatestChange: (label: string) => `いちばん新しい変更日：${label}`,
  recoveryReviewReadFull: "全文を読む",
  recoveryReviewNoDate: "変更日を確認できません",
  recoveryCandidateScreen: "この画面の未保存の内容",
  recoveryCandidateStored: "保存先で見つかった内容",
  recoveryCandidateNative: "端末内の別の候補",
  recoveryCandidateProtected: (index: number) => `保護している候補 ${index}`,
  recoveryArchiveFull:
    "保護している候補がいっぱいのため、まだ保存できません。この画面の内容は残っています。",
  recoveryArchiveFullGuide:
    "保護している候補を確認し、不要と確認できたものを選んで整理すると、この画面の内容を保存できます。自動では何も消えません。",
  recoveryDiscardAction: "この候補を整理する",
  recoveryDiscardConfirmTitle: "この候補を整理しますか？",
  recoveryDiscardConfirmBody: (count: number) =>
    `この端末に保護されている候補（メモ ${count}件）を削除します。取り消せません。残したい文章は、先に「本文をコピー」で控えてください。`,
  recoveryDiscardCancel: "キャンセル",
  recoveryDiscardConfirm: "整理する",
  recoveryDiscardDone: "候補を整理しました。もう一度、この画面の内容を保存できます。",
  recoveryDiscardChanged: "確認した後に候補の内容が変わったため、何も整理していません。もう一度確認してください。",
  recoveryDiscardFailed: "候補を整理できませんでした。何も変更していません。",
  // 救済（本文・題名の取り出し）
  copyBody: "本文をコピー",
  copyTitle: "タイトルをコピー",
  copied: "コピーしました",
  copyFailed: "コピーできませんでした。下の文章を選択してコピーしてください。",
  renderFailureTitle: "表示に問題が起きました",
  renderFailureUnsaved:
    "保存できていない変更があります。再読み込みする前に、下の文章をコピーしてください。",
  renderFailureNoUnsaved:
    "保存できていない変更は確認されませんでした。再読み込みして開き直せます。",
  renderFailureUnknown:
    "保存の状況を確認できませんでした。再読み込みすると、保存されていない内容は失われることがあります。",
  renderFailureReload: "再読み込みして開き直す",
  unsavedNoteLabel: "保存できていない内容",
  nativeBackupRetry: "予備保存をもう一度作る",
  nativeRecoveryChecking: "端末内の復元データを確認しています…",
  nativeRecoveryReadError:
    "保存データの安全確認ができませんでした。上書きを防ぐため、編集と保存を止めています。",
  nativeRecoveryRetry: "もう一度確認する",
  nativeRecoveryAlternativeNotice: (count: number) =>
    count === 0
      ? "端末内にも、すべて削除済みの別の復元候補があります。自動では混ぜません。"
      : `端末内にも別の復元候補が${count}件あります。自動では混ぜません。`,
  nativeRecoveryAlternativeActive: "端末内の別候補を表示しています。",
  nativeRecoveryShowAlternative: "端末内の別候補を見る",
  nativeRecoveryShowLocal: "元の復元候補に戻す",
  dirtyRecoveryCandidateNotice:
    "この画面の未保存編集と保存先の復元候補を別々に保持しています。自動では混ぜません。",
  dirtyRecoveryScreenActive: "この画面の未保存編集を表示しています。",
  dirtyRecoveryLocalActive: "保存先で見つかった復元候補を表示しています。",
  dirtyRecoveryShowScreen: "未保存編集に戻る",
  dirtyRecoveryShowLocal: "保存先の復元候補を見る",
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
  favoriteOn: "先頭に留める",
  favoriteOff: "先頭固定を解除",
  favoriteOnEn: "Keep as a treasured trace",
  favoriteOffEn: "Remove treasured trace",

  // 削除
  deleteNote: "このメモを削除",
  deleteNoteEn: "Let this trace go",
  deleteConfirmTitle: "このメモを削除しますか？",
  deleteConfirmTitleEn: "Let this trace go?",
  deleteConfirmBody:
    "削除後10秒間は、直前の1件を元に戻せます。\nアプリを終了・再起動すると取り消せません。",
  deleteConfirmBodyEn:
    "Let this note go quietly?\nYou can undo for a short while after deleting it.",
  cancel: "キャンセル",
  cancelEn: "Keep it",
  confirmDelete: "削除する",
  confirmDeleteEn: "Release (delete)",
  undoDelete: "元に戻す",
  undoDeleteEn: "Undo",
  undoDeleteMessage: "メモを削除しました",
  undoDeleteMessageEn: "Trace released",

  // 検索結果
  noSearchResult: "この言葉に一致するメモはありません",
  noSearchResultHint: "別の言葉でも探せます",
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
