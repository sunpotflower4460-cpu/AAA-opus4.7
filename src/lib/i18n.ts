import type { BrushId } from "./brushPreference";
import type { UiLocale } from "../i18n/locales";
import { rescueMessages } from "../i18n/rescueMessages";

export type PoeticLines = readonly [string, ...string[]];

type NoteCount = { noteCount: number };
type VersionCount = { versionCount: number };
type DisplayDate = { displayDate: string };

type InterfaceMessages = {
  appName: string;
  taglineLines: PoeticLines;
  emptyTitleLines: PoeticLines;
  emptySubtitleLines: PoeticLines;
  notesList: string;
  searchPlaceholder: string;
  clearSearch: string;
  newNote: string;
  notesCountLabel: (args: NoteCount) => string;
  searchResultCountLabel: (args: NoteCount) => string;
  localOnly: string;
  noSearchResult: string;
  noSearchResultHint: string;
  back: string;
  backToSearch: string;
  backToRead: string;
  titlePlaceholder: string;
  bodyLabel: string;
  bodyPlaceholder: string;
  titleLengthGuide: (args: { graphemeCount: number; recommendedCount: number }) => string;
  untitled: string;
  editNote: string;
  readNote: string;
  readModeMore: string;
  emptyReadBody: string;
  readingDirection: string;
  vertical: string;
  horizontal: string;
  creationDate: (args: DisplayDate) => string;
  changeDate: (args: DisplayDate) => string;
  timeOfDay: Record<"morning" | "afternoon" | "evening" | "night", string>;
  brush: string;
  brushCurrent: (args: { brushName: string }) => string;
  brushDescription: string;
  brushSample: string;
  brushes: Record<BrushId, { label: string; description: string }>;
  saved: string;
  saving: string;
  saveError: string;
  saveErrorQuota: string;
  saveErrorUnavailable: string;
  saveErrorInvalidData: string;
  deleteSaveFailed: string;
  retrySave: string;
  nativeBackupError: string;
  nativeBackupRetry: string;
  nativeRecoveryChecking: string;
  nativeRecoveryReadError: string;
  nativeRecoveryRetry: string;
  loadError: string;
  close: string;
  language: string;
  followSystem: string;
  preferenceWriteFailed: string;
  aboutOpen: string;
  aboutLead: string;
  aboutStorageTitle: string;
  aboutStorageBody: string;
  aboutStorageCaution: string;
  aboutDeleteTitle: string;
  aboutDeleteBody: string;
  aboutPinTitle: string;
  aboutPinBody: string;
  aboutPrivacyTitle: string;
  aboutPrivacyPoints: readonly string[];
  aboutPrivacyLink: string;
  aboutSupportTitle: string;
  aboutSupportBody: string;
  aboutSupportLink: string;
  aboutSupportHint: string;
  aboutVersion: string;
  aboutVersionUnknown: string;
  aboutVersionDev: string;
  recoveryReviewOpen: string;
  recoveryReviewTitle: string;
  recoveryReviewLead: string;
  recoveryNoVersions: string;
  recoveryVersionCount: (args: VersionCount) => string;
  recoveryReviewEmpty: string;
  recoveryReviewCount: (args: NoteCount) => string;
  recoveryReviewLatestChange: (args: DisplayDate) => string;
  recoveryReviewNoDate: string;
  recoveryCandidateScreen: string;
  recoveryCandidateStored: string;
  recoveryCandidatePrimary: string;
  recoveryCandidateNative: string;
  recoveryCandidateProtected: (args: { candidateIndex: number }) => string;
  recoveryArchiveFull: string;
  recoveryArchiveFullGuide: string;
  recoveryDiscardAction: string;
  recoveryDiscardConfirmTitle: string;
  recoveryDiscardConfirmBody: (args: NoteCount) => string;
  recoveryDiscardConfirm: string;
  recoveryDiscardDone: string;
  recoveryDiscardChanged: string;
  recoveryDiscardFailed: string;
  nativeRecoveryAlternativeNotice: (args: NoteCount) => string;
  nativeRecoveryAlternativeActive: string;
  nativeRecoveryShowAlternative: string;
  nativeRecoveryShowLocal: string;
  dirtyRecoveryCandidateNotice: string;
  dirtyRecoveryScreenActive: string;
  dirtyRecoveryLocalActive: string;
  dirtyRecoveryShowScreen: string;
  dirtyRecoveryShowLocal: string;
  saveConflict: string;
  saveRecovery: string;
  storageConflictTitle: string;
  storageConflictBody: string;
  storageRecoveryTitle: string;
  storageConflictRecoveryBody: string;
  storageRecoveryCandidateCount: (args: NoteCount) => string;
  storageRecoverySaveEmpty: string;
  storageConflictLoad: string;
  storageConflictOverwrite: string;
  storageRecoverySave: string;
  favoriteOn: string;
  favoriteOff: string;
  pinned: string;
  deleteNote: string;
  deleteConfirmTitle: string;
  deleteConfirmBody: (args: { undoSeconds: number }) => string;
  cancel: string;
  confirmDelete: string;
  undoDelete: string;
  undoDeleteMessage: string;
  undoDeletePending: string;
};

export type Messages = InterfaceMessages & (typeof rescueMessages)[UiLocale];

const jaCount = (value: number) => new Intl.NumberFormat("ja", { numberingSystem: "latn" }).format(value);
const enCount = (value: number) => new Intl.NumberFormat("en", { numberingSystem: "latn" }).format(value);

const ja = {
  ...rescueMessages.ja,
  appName: "残心",
  taglineLines: ["書いたあとにも、", "心が残る。"],
  emptyTitleLines: ["ひとことでも、", "途中のままでも。"],
  emptySubtitleLines: ["入力した内容は、", "この端末に自動保存されます。"],
  notesList: "メモ一覧",
  searchPlaceholder: "題名と本文から探す",
  clearSearch: "検索を消す",
  newNote: "メモを書く",
  notesCountLabel: ({ noteCount }) => noteCount === 0 ? "まだメモはありません" : `メモ ${jaCount(noteCount)}件`,
  searchResultCountLabel: ({ noteCount }) =>
    noteCount === 0 ? "一致するメモは0件です" : `${jaCount(noteCount)}件 見つかりました`,
  localOnly: "この端末に保存",
  noSearchResult: "この言葉に一致するメモはありません",
  noSearchResultHint: "別の言葉でも探せます",
  back: "一覧へ",
  backToSearch: "検索結果へ",
  backToRead: "読み返しへ",
  titlePlaceholder: "タイトル（任意）",
  bodyLabel: "本文",
  bodyPlaceholder: "いま残したい言葉を、ここに。",
  titleLengthGuide: ({ graphemeCount, recommendedCount }) =>
    `タイトルは${jaCount(graphemeCount)}文字です。${jaCount(recommendedCount)}文字は目安です。このまま保存できます。`,
  untitled: "無題",
  editNote: "編集する",
  readNote: "読み返す",
  readModeMore: "左へ続きます",
  emptyReadBody: "本文がありません。",
  readingDirection: "読み返しの向き",
  vertical: "縦書き",
  horizontal: "横書き",
  creationDate: ({ displayDate }) => `作成日 ${displayDate}`,
  changeDate: ({ displayDate }) => `変更日時 ${displayDate}`,
  timeOfDay: { morning: "朝の余白", afternoon: "昼の余白", evening: "夕の余白", night: "夜の余白" },
  brush: "筆あと",
  brushCurrent: ({ brushName }) => `筆あと（${brushName}）`,
  brushDescription: "書いた言葉の字の表情を選びます。",
  brushSample: "心が、静かに残る。",
  brushes: {
    mincho: { label: "明朝", description: "端正で静かな活字" },
    fude: { label: "筆", description: "筆のかすれとはらい" },
    boku: { label: "墨", description: "太く、墨の溜まる字" },
    tegaki: { label: "手書き", description: "ペンの温もり" },
  },
  saved: "保存済み",
  saving: "保存中",
  saveError: "最新の変更を保存できませんでした",
  saveErrorQuota: "メモの保存領域が足りないため、最新の変更を保存できませんでした",
  saveErrorUnavailable: "端末内の保存先を利用できなかったため、最新の変更を保存できませんでした",
  saveErrorInvalidData: "この内容を安全に保存できませんでした",
  deleteSaveFailed: "削除を保存できませんでした。削除は確定していません。",
  retrySave: "もう一度保存する",
  nativeBackupError: "最新の変更は保存済みです。端末内の予備保存を更新できませんでした。",
  nativeBackupRetry: "予備保存をもう一度作る",
  nativeRecoveryChecking: "端末内の復元データを確認しています…",
  nativeRecoveryReadError: "保存データの安全確認ができませんでした。上書きを防ぐため、編集と保存を止めています。",
  nativeRecoveryRetry: "もう一度確認する",
  loadError: "保存データを安全に読み込めませんでした。上書きを防ぐため保存を止めています。",
  close: "閉じる",
  language: "言語",
  followSystem: "システム設定に従う",
  preferenceWriteFailed: "設定を保存できませんでした。この起動中は選んだ設定で使えます。次回は元に戻る場合があります。",
  aboutOpen: "このアプリについて",
  aboutLead: "静かに書き、読み返すためのメモ帳です。無料で、広告やアカウント登録はありません。",
  aboutStorageTitle: "保存について",
  aboutStorageBody: "メモはこの端末に自動で保存されます。クラウド同期はありません。端末内の予備保存は、同じ端末で内容を復旧するためのものです。機種変更後に復元できるとは限りません。",
  aboutStorageCaution: "最新の変更が保存できないときは、画面に出る操作でタイトルや本文をコピーできます。アプリの終了や再起動の前に必要な原文を控えてください。アプリの削除やデータの消去で端末内のメモは失われます。",
  aboutDeleteTitle: "削除について",
  aboutDeleteBody: "削除後10秒間は、直前の1件を「元に戻す」で取り消せます。アプリを終了・再起動した後は取り消せません。",
  aboutPinTitle: "大切なメモを先頭へ",
  aboutPinBody: "「先頭に留める」を選ぶと、金のしるしが付き、一覧の先頭のグループに置かれます。固定したメモとそのほかのメモは、それぞれ変更の新しい順に並びます。しるしの付け外しも変更として扱います。",
  aboutPrivacyTitle: "プライバシー",
  aboutPrivacyPoints: [
    "メモの内容は端末に保存され、残心から外部のサーバーへは送信しません。",
    "広告・分析・追跡の仕組みは使わず、アカウント情報や識別子を収集しません。",
    "端末内の機能には Capacitor を使っています。",
    "iOS の端末バックアップを利用している場合、アプリのデータがバックアップに含まれることがあります。",
  ],
  aboutPrivacyLink: "プライバシーポリシー（公開ページ）",
  aboutSupportTitle: "お問い合わせ",
  aboutSupportBody: "不具合や質問は GitHub Issues に投稿できます。投稿は公開されます。メモの内容や個人情報は記載しないでください。",
  aboutSupportLink: "GitHub Issues を開く（外部ブラウザ）",
  aboutSupportHint: "アプリのバージョン、表示言語、機種とOS、起きた操作、表示されたメッセージを任意で添えられます。",
  aboutVersion: "バージョン",
  aboutVersionUnknown: "取得できませんでした",
  aboutVersionDev: "開発ビルド（Web）",
  recoveryReviewOpen: "内容を確認する",
  recoveryReviewTitle: "保存内容を見比べる",
  recoveryReviewLead: "候補を選ぶとメモを読めます。閲覧のあと、保存する内容は元の画面で選びます。",
  recoveryNoVersions: "表示できる版はありません。",
  recoveryVersionCount: ({ versionCount }) => `比較できる版 ${jaCount(versionCount)}件`,
  recoveryReviewEmpty: "この保存版にはメモがありません。",
  recoveryReviewCount: ({ noteCount }) => `この版のメモ ${jaCount(noteCount)}件`,
  recoveryReviewLatestChange: ({ displayDate }) => `最後の変更日時 ${displayDate}`,
  recoveryReviewNoDate: "変更日時を確認できません。",
  recoveryCandidateScreen: "この画面の未保存の内容",
  recoveryCandidateStored: "保存先で見つかった内容",
  recoveryCandidatePrimary: "現在の本体保存",
  recoveryCandidateNative: "端末内の予備保存",
  recoveryCandidateProtected: ({ candidateIndex }) => `保護している候補 ${jaCount(candidateIndex)}`,
  recoveryArchiveFull: "保護している候補がいっぱいのため、まだ保存できません。この画面の内容は残っています。",
  recoveryArchiveFullGuide: "保護している候補の内容を確認してください。不要と確認できた候補を整理すると、この画面の内容の保存を再試行できます。",
  recoveryDiscardAction: "この候補を整理する",
  recoveryDiscardConfirmTitle: "この候補を整理しますか？",
  recoveryDiscardConfirmBody: ({ noteCount }) =>
    `この端末に保護されている候補（メモ ${jaCount(noteCount)}件）を削除します。取り消せません。必要な原文は先にコピーしてください。`,
  recoveryDiscardConfirm: "整理する",
  recoveryDiscardDone: "候補を整理しました。この画面の内容の保存を再試行できます。",
  recoveryDiscardChanged: "候補が確認後に変わりました。改めて内容を確認してください。",
  recoveryDiscardFailed: "候補を整理できたか確認できませんでした。候補の一覧を確認してください。",
  nativeRecoveryAlternativeNotice: ({ noteCount }) =>
    noteCount === 0
      ? "端末内に別の復元候補があります。この保存版にはメモがありません。"
      : `端末内に別の復元候補があります。この版のメモは${jaCount(noteCount)}件です。`,
  nativeRecoveryAlternativeActive: "端末内の別候補を表示しています。",
  nativeRecoveryShowAlternative: "端末内の別候補を見る",
  nativeRecoveryShowLocal: "元の復元候補に戻す",
  dirtyRecoveryCandidateNotice: "この画面の未保存編集と保存先の復元候補を別々に保持しています。自動では混ぜません。",
  dirtyRecoveryScreenActive: "この画面の未保存編集を表示しています。",
  dirtyRecoveryLocalActive: "保存先で見つかった復元候補を表示しています。",
  dirtyRecoveryShowScreen: "未保存編集に戻る",
  dirtyRecoveryShowLocal: "保存先の復元候補を見る",
  saveConflict: "別の変更と重なったため、保存を止めています",
  saveRecovery: "復元内容を確認するまで、保存を止めています",
  storageConflictTitle: "保存先の内容が変わっています",
  storageConflictBody: "自動保存を止めています。保存先を読み込むと、この画面の未保存編集は破棄されます。",
  storageRecoveryTitle: "保存データを確認してください",
  storageConflictRecoveryBody: "保存先のデータを確認できないため、自動保存を止めています。この画面の内容を確認してから保存できます。元の問題データも可能な範囲で保護します。",
  storageRecoveryCandidateCount: ({ noteCount }) => `表示中の復元候補にメモが${jaCount(noteCount)}件あります。`,
  storageRecoverySaveEmpty: "この内容で保存すると、保存先のメモは0件になります。",
  storageConflictLoad: "未保存編集を破棄して読み込む",
  storageConflictOverwrite: "この画面の編集で上書き",
  storageRecoverySave: "この画面の内容で保存し直す",
  favoriteOn: "先頭に留める",
  favoriteOff: "先頭固定を解除",
  pinned: "先頭に固定",
  deleteNote: "このメモを削除",
  deleteConfirmTitle: "このメモを削除しますか？",
  deleteConfirmBody: ({ undoSeconds }) =>
    `削除後${jaCount(undoSeconds)}秒間は、直前の1件を元に戻せます。\nアプリを終了・再起動すると取り消せません。`,
  cancel: "キャンセル",
  confirmDelete: "削除する",
  undoDelete: "元に戻す",
  undoDeleteMessage: "メモを削除しました",
  undoDeletePending: "このメモの削除はまだ確定していません",
} satisfies Messages;

const en = {
  ...rescueMessages.en,
  appName: "Zanshin",
  taglineLines: ["Write a little.", "Return whenever you like."],
  emptyTitleLines: ["A line is enough."],
  emptySubtitleLines: ["Your note saves as you write."],
  notesList: "Notes",
  searchPlaceholder: "Search titles and text",
  clearSearch: "Clear search",
  newNote: "New note",
  notesCountLabel: ({ noteCount }) =>
    noteCount === 0 ? "No notes yet" : noteCount === 1 ? "1 note" : `${enCount(noteCount)} notes`,
  searchResultCountLabel: ({ noteCount }) =>
    noteCount === 0 ? "No matches" : noteCount === 1 ? "1 matching note" : `${enCount(noteCount)} matching notes`,
  localOnly: "Stored on this device",
  noSearchResult: "No notes match your search.",
  noSearchResultHint: "Try a different word or phrase.",
  back: "Back to notes",
  backToSearch: "Back to search results",
  backToRead: "Back to reading",
  titlePlaceholder: "Title (optional)",
  bodyLabel: "Note text",
  bodyPlaceholder: "Write what you’d like to keep.",
  titleLengthGuide: ({ graphemeCount, recommendedCount }) =>
    `${enCount(graphemeCount)} characters. A title of ${enCount(recommendedCount)} or fewer is suggested. You can keep the full title.`,
  untitled: "Untitled",
  editNote: "Edit",
  readNote: "Read",
  readModeMore: "Continues to the left",
  emptyReadBody: "This note has no text.",
  readingDirection: "Reading direction",
  vertical: "Vertical",
  horizontal: "Horizontal",
  creationDate: ({ displayDate }) => `Created ${displayDate}`,
  changeDate: ({ displayDate }) => `Last changed ${displayDate}`,
  timeOfDay: { morning: "Morning", afternoon: "Afternoon", evening: "Evening", night: "Night" },
  brush: "Writing style",
  brushCurrent: ({ brushName }) => `Writing style (${brushName})`,
  brushDescription: "Choose how your handwriting and notes look.",
  brushSample: "A quiet thought stays.",
  brushes: {
    mincho: { label: "Mincho", description: "Crisp serif lettering" },
    fude: { label: "Brush", description: "Light, textured strokes" },
    boku: { label: "Ink", description: "Bold strokes and pooled ink" },
    tegaki: { label: "Handwriting", description: "The warmth of pen on paper" },
  },
  saved: "Saved",
  saving: "Saving",
  saveError: "Your latest changes couldn’t be saved.",
  saveErrorQuota: "There isn’t enough space to save your latest changes.",
  saveErrorUnavailable: "Local storage is unavailable. Your latest changes couldn’t be saved.",
  saveErrorInvalidData: "These changes couldn’t be saved safely.",
  deleteSaveFailed: "The deletion couldn’t be saved. It hasn’t been confirmed on this device.",
  retrySave: "Try saving again",
  nativeBackupError: "Your changes are saved. The on-device recovery copy couldn’t be updated.",
  nativeBackupRetry: "Retry recovery copy",
  nativeRecoveryChecking: "Checking for recovery copies on this device…",
  nativeRecoveryReadError: "We couldn’t verify the saved data. Editing and saving are paused to protect your notes.",
  nativeRecoveryRetry: "Check again",
  loadError: "We couldn’t safely read the saved data. Saving is paused to protect your notes.",
  close: "Close",
  language: "Language",
  followSystem: "Follow system settings",
  preferenceWriteFailed: "This setting couldn’t be saved. Your choice applies for now and may reset when you reopen the app.",
  aboutOpen: "About this app",
  aboutLead: "A quiet place to write and revisit your notes. Free to use, with no ads or sign-up.",
  aboutStorageTitle: "Saving notes",
  aboutStorageBody: "Notes are saved automatically on this device. Zanshin has no cloud sync. The on-device recovery copy helps restore notes on the same device. Recovery after switching devices isn’t guaranteed.",
  aboutStorageCaution: "If your latest changes couldn’t be saved, use the options on screen to copy the title or text before closing or restarting the app. Deleting the app or clearing its data removes the notes stored on the device.",
  aboutDeleteTitle: "Deleting notes",
  aboutDeleteBody: "Undo is available for the last deletion for 10 seconds, until you close or restart the app.",
  aboutPinTitle: "Pinning notes",
  aboutPinBody: "Choose Pin to top to mark a note in gold and move it to the top group. In each group, recently changed notes appear first. Pinning and unpinning also count as changes.",
  aboutPrivacyTitle: "Privacy",
  aboutPrivacyPoints: [
    "Notes are stored on this device. Zanshin doesn’t send them to external servers.",
    "The app has no ads, analytics, or tracking and collects no account information or identifiers.",
    "The app uses Capacitor for on-device features.",
    "If you use iOS device backups, iOS may include app data in those backups.",
  ],
  aboutPrivacyLink: "Privacy policy (website)",
  aboutSupportTitle: "Support",
  aboutSupportBody: "You can report problems or ask questions on GitHub Issues. Posts are public. Keep your notes and personal information private.",
  aboutSupportLink: "Open GitHub Issues (external browser)",
  aboutSupportHint: "If helpful, include the app version, display language, device and OS, what you did, and any message you saw.",
  aboutVersion: "Version",
  aboutVersionUnknown: "Unavailable",
  aboutVersionDev: "Development build (Web)",
  recoveryReviewOpen: "View contents",
  recoveryReviewTitle: "Compare versions",
  recoveryReviewLead: "Choose a version to read its notes. To decide what to save, return to the previous screen.",
  recoveryNoVersions: "There are no versions to display.",
  recoveryVersionCount: ({ versionCount }) =>
    versionCount === 1 ? "1 version to compare" : `${enCount(versionCount)} versions to compare`,
  recoveryReviewEmpty: "This version contains no notes.",
  recoveryReviewCount: ({ noteCount }) =>
    noteCount === 1 ? "This version contains 1 note." : `This version contains ${enCount(noteCount)} notes.`,
  recoveryReviewLatestChange: ({ displayDate }) => `Most recent change ${displayDate}`,
  recoveryReviewNoDate: "Change date unavailable.",
  recoveryCandidateScreen: "Unsaved changes on this screen",
  recoveryCandidateStored: "Version found in local storage",
  recoveryCandidatePrimary: "Currently saved on this device",
  recoveryCandidateNative: "On-device recovery copy",
  recoveryCandidateProtected: ({ candidateIndex }) => `Protected version ${enCount(candidateIndex)}`,
  recoveryArchiveFull: "All recovery slots are full, so your changes couldn’t be saved. You can still access the current text on this screen.",
  recoveryArchiveFullGuide: "Review the protected versions. Once you’ve removed a version you no longer need, you can try saving again.",
  recoveryDiscardAction: "Remove this protected version",
  recoveryDiscardConfirmTitle: "Remove this protected version?",
  recoveryDiscardConfirmBody: ({ noteCount }) => {
    const quantity = noteCount === 1 ? "1 note" : `${enCount(noteCount)} notes`;
    return `This permanently removes the protected version containing ${quantity}. Copy anything you want to keep first.`;
  },
  recoveryDiscardConfirm: "Remove version",
  recoveryDiscardDone: "The protected version was removed. You can try saving the current contents again.",
  recoveryDiscardChanged: "The protected version changed after you reviewed it. Check its contents again.",
  recoveryDiscardFailed: "We couldn’t confirm removal. Check the list of protected versions.",
  nativeRecoveryAlternativeNotice: ({ noteCount }) =>
    noteCount === 0
      ? "There’s another recovery version on this device. This version contains no notes."
      : noteCount === 1
        ? "There’s another recovery version on this device. It contains 1 note."
        : `There’s another recovery version on this device. It contains ${enCount(noteCount)} notes.`,
  nativeRecoveryAlternativeActive: "You’re viewing the other on-device version.",
  nativeRecoveryShowAlternative: "View on-device recovery copy",
  nativeRecoveryShowLocal: "Back to the previous version",
  dirtyRecoveryCandidateNotice: "Your unsaved edits and the version found in storage are held separately.",
  dirtyRecoveryScreenActive: "You’re viewing your unsaved edits.",
  dirtyRecoveryLocalActive: "You’re viewing the version found in storage.",
  dirtyRecoveryShowScreen: "Return to unsaved edits",
  dirtyRecoveryShowLocal: "View version found in storage",
  saveConflict: "Saving is paused because another version was found.",
  saveRecovery: "Saving is paused until you review the recovery version.",
  storageConflictTitle: "The saved version has changed",
  storageConflictBody: "Autosave is paused. Loading the saved version discards the unsaved edits on this screen.",
  storageRecoveryTitle: "Review the saved data",
  storageConflictRecoveryBody: "We couldn’t verify the saved data, so autosave is paused. Review the current contents before saving this version. The original data is kept where possible.",
  storageRecoveryCandidateCount: ({ noteCount }) =>
    noteCount === 1 ? "The recovery version you’re viewing contains 1 note." : `The recovery version you’re viewing contains ${enCount(noteCount)} notes.`,
  storageRecoverySaveEmpty: "Saving this version will leave zero notes in local storage.",
  storageConflictLoad: "Discard unsaved edits and load saved version",
  storageConflictOverwrite: "Replace saved version with these edits",
  storageRecoverySave: "Save the version on this screen",
  favoriteOn: "Pin to top",
  favoriteOff: "Unpin",
  pinned: "Pinned to top",
  deleteNote: "Delete this note",
  deleteConfirmTitle: "Delete this note?",
  deleteConfirmBody: ({ undoSeconds }) =>
    `You can undo the last deletion for ${enCount(undoSeconds)} seconds.\nUndo is available until you close or restart the app.`,
  cancel: "Cancel",
  confirmDelete: "Delete note",
  undoDelete: "Undo",
  undoDeleteMessage: "Note deleted",
  undoDeletePending: "The deletion hasn’t been confirmed yet.",
} satisfies Messages;

export const messages: Record<UiLocale, Messages> = { ja, en };
