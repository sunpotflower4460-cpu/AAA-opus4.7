# 残心 / Zanshin — 多言語化の着手基準

確認日：2026年11月27日（日本時間）  
対象コミット：`4ec10d10b1ef099f417f0bbd8dfdba50b3e9f8d1`（PR #51 統合後の main）  
比較元：2026年11月26日の多言語調査2回分。両調査のコード基準は `6b40f44fe630b094aa0aad4fb1e79f5def3bc5b9`。

## 1. この文書の役割と確認範囲

旧調査から進んだ実装を確認し、多言語化の開始時に引き継ぐ現在地と安全上の契約を記録する。旧調査の問題をそのまま現行不具合へ移したり、設計を書いたことを実装完了へ読み替えたりしない。

今回行ったのは、対象コミットのコード、既存のテスト定義、[ストア改善の受入記録](../store-release-polish/ACCEPTANCE.md)の読取りである。テスト・ビルド・ブラウザ操作・実 iPhone / Xcode / Archive の再確認は行っていない。本書で「記録あり」と書く結果は、既存資料に残された確認結果であり、本書作成時の再実行結果ではない。

本文のソース位置はすべて上記コミットを基準とする。着手時の HEAD が進んでいたら、対応する関数・型・呼出しを再照合する。ストア改善の既存記録と多言語化の合否は別に管理する。

### 現在地

- 保存失敗の継続表示、native 復帰時の比較、描画例外時の RAM 救済、候補比較と明示整理、アプリ情報画面などが追加されている。これらを多言語化のために作り直したり、旧実装へ戻したりしない。
- UI は引き続き日本語中心の静的な `copy` オブジェクトを使う。日英辞書の選択、UI 言語設定、実効言語の解決、言語切替は未実装である。
- native の言語宣言は日本語へ更新済み。旧調査にある「現行の developmentRegion は en」という説明は、この基準では成立しない。
- 日英版の横書き読書、比較用 NFC・水平空白処理、200 の計数単位整理、言語別の異常時表示などは、引き続き導入・確認が必要である。

## 2. 最新コードの棚卸し

「反映済み」は下表に記載した範囲を指す。関連する多言語要件全体の合格を意味しない。

| 項目 | 4ec10d1 の状態・旧調査との差 | 多言語化で扱う残り・制約 | 主なソース |
|---|---|---|---|
| 辞書と型 | `copy` は日本語と一部の `...En` キーを同居させた静的オブジェクト。`as const` と `Copy = typeof copy` は継続。新しい救済・情報・復旧画面の文言が増えた | 完成した ja/en の同形辞書、引数契約、実効言語での参照は未実装。日本語の文字列リテラルそのものを英語辞書の型制約にしない。旧調査時のキー数を現在の翻訳範囲に流用しない | [src/lib/i18n.ts](../../src/lib/i18n.ts)、[src/main.tsx](../../src/main.tsx) |
| 辞書外の UI 文言 | カードの「作成日」「先頭に固定」、読み上げ日付、筆あと選択、アプリ情報の一部リンク等に日本語の直接記述がある | `i18n.ts` の差替えだけで完成としない。表示文・aria・title・日付説明・失敗時の文を、到達できる画面単位で抽出する | [NoteCard.tsx](../../src/components/NoteCard.tsx) の `spokenDate` / `accessibleName`、[BrushPicker.tsx](../../src/components/BrushPicker.tsx)、[AboutScreen.tsx](../../src/components/AboutScreen.tsx) |
| 言語設定・初期化 | 言語専用の設定保存・解決器・Provider はない。HTML の `lang` は ja 固定。別機能の「筆あと」には独立した設定保存が存在する | UI 言語の希望と実効値を分ける。言語の設定失敗でメモ保存を止めない。筆あと設定を言語設定や本文言語の代用にしない | [index.html](../../index.html)、[brushPreference.ts](../../src/lib/brushPreference.ts)、[main.tsx](../../src/main.tsx) |
| Note の locale | `Locale` は ja/en。validator は省略・ja・en のみ許容。新規作成は依然 `locale: "ja"` 固定 | UI 言語を `Note.locale` へコピーしない。既存値は文章言語の証拠にしない。新規で省略する案は validator と整合するが、既存メモを書き換える移行は行わない | [src/types/note.ts](../../src/types/note.ts)、[storage.ts](../../src/lib/storage.ts) の `isNote`、[App.tsx](../../src/App.tsx) の `createNote` |
| 保存失敗の表示 | エディタ再入場でも `saveResult.ok === false` を優先する `displayedSaveState` が追加済み。削除の保存失敗、満杯理由も区別 | 旧「再入場だけで失敗表示が消える」を現行未修正として再掲しない。各理由・対象版・操作を ja/en で同じ意味にする | [NoteEditor.tsx](../../src/components/NoteEditor.tsx) の `displayedSaveState`、[saveFailureUi.ts](../../src/lib/saveFailureUi.ts)、[App.tsx](../../src/App.tsx) の `applySaveResult` |
| native 保存表示 | `editVersionRef` と `nativeBackupErrorVersion` による対象版の判定、旧版結果を無視する処理、本体失敗中に予備保存警告を優先しない処理が追加済み | 翻訳の更新だけで世代番号を増やさず、旧 native 結果を現在の保存成功に見せない。予備保存の失敗を本体未保存と同じ訳にしない | [App.tsx](../../src/App.tsx) の `persistDurableSnapshot`、`showNativeBackupWarning` |
| 復帰時の比較 | 正常形式でも baseline と異なる local は、native の安全確認へ送る処理が追加済み。各復帰入口を扱うテスト定義がある | 起動・pageshow・visibilitychange・native active の比較、probe の世代確認、dirty 候補の保全を維持。言語切替を復旧候補の再読込・自動採用へ接続しない | [App.tsx](../../src/App.tsx) の `refreshCleanNotesFromStorage` / `probeNativeRecovery`、[App.resume-divergence.test.tsx](../../src/__tests__/App.resume-divergence.test.tsx) |
| 復旧比較・保護枠 | `RecoveryReview` が追加され、候補の件数・変更日・全文・コピーを確認できる。`recovery_archive_full` と、確認した raw に一致する候補だけを整理する処理が追加済み | 比較・採用・保存・コピー・不可逆な整理の意味を別に訳す。読むだけで書き込まない契約を維持。整理の確認対象を言語切替で入れ替えない | [RecoveryReview.tsx](../../src/components/RecoveryReview.tsx)、[storage.ts](../../src/lib/storage.ts) の `listProtectedRecoveryCandidates` / `discardProtectedRecoveryCandidate` |
| 復旧の翻訳済み state | `ReviewCandidate.label` は文字列で、App が作成時の `copy` を候補 state に格納する。`RecoveryReview.notice` も翻訳済み文字列を保持する | 辞書だけを切り替えると、開いたままの候補名・結果通知が旧言語に残り得る。候補の種別・番号・結果 code を持ち、表示時に翻訳する。候補本体・id・raw・選択・確認状態を作り直す必要はない | [App.tsx](../../src/App.tsx) の `buildReviewCandidates` / `reviewCandidates`、[RecoveryReview.tsx](../../src/components/RecoveryReview.tsx) の `ReviewCandidate` / `notice` |
| 0件と件数の意味 | 旧 `nativeRecoveryAlternativeNotice(0)` の「すべて削除済み」は残存。新しい `recoveryReviewEmpty` も「すべて削除した内容」と述べる。候補案内の count はメモ件数 | この指摘は現行にも残る。0件は空の有効版という事実までを説明し、削除履歴を推測しない。noteCount と保存版の数を区別する。単純に古い日本語を全訳しない | [i18n.ts](../../src/lib/i18n.ts) の `recoveryReviewEmpty` / `nativeRecoveryAlternativeNotice` / `storageRecoveryCandidateCount`、[RecoveryReview.tsx](../../src/components/RecoveryReview.tsx) |
| 描画例外と原文救済 | `draftRescue` は React の外で最後に記録したメモと確認済み版を保持。実際の `AppErrorBoundary` から未保存の題名・本文を表示し、コピーできる | 旧「例外画面が再読込しか示さない」は解消した構造。今後の翻訳 Provider / formatter が壊れても最小救済へ到達させる。RAM 救済はプロセス終了・再読込を越えない | [draftRescue.ts](../../src/lib/draftRescue.ts)、[AppErrorBoundary.tsx](../../src/components/AppErrorBoundary.tsx)、[App.tsx](../../src/App.tsx) の `recordDraftRescue` 呼出し |
| 原文コピー | `CopyTextButton` は受け取ったモデル文字列を `clipboard.writeText` へ渡す。拒否・利用不可では成功表示せず、読取り専用 textarea を示す | 既にある救済を利用する。コピー成功を保存成功にしない。DOM の選択コピーや textarea の改行表現と、明示コピーへ渡すモデル文字列の一致は別に確認する | [CopyTextButton.tsx](../../src/components/CopyTextButton.tsx)、[NoteEditor.tsx](../../src/components/NoteEditor.tsx)、[RecoveryReview.tsx](../../src/components/RecoveryReview.tsx) |
| 題名編集・200制限 | 単一行 input から、高さ可変の textarea へ変更済み。`maxLength={200}` は残る。編集時の改行を空白へ変換し、通常の Enter は本文へ移動、変換中 Enter は横取りしない | 旧 input の改行除去を現行エディタの挙動として扱わない。200 の UTF-16 制限は未整理。表示単位の目安・超過入力・IME・既存の長い題名の保持を設計する。復旧の読取り専用題名 input は別に存在する | [NoteEditor.tsx](../../src/components/NoteEditor.tsx) の `handleTitle` / `handleTitleKeyDown` / 題名 textarea、[App.title-input.test.tsx](../../src/__tests__/App.title-input.test.tsx)、[storage.ts](../../src/lib/storage.ts) の `isNote` |
| 入力支援 | 本文は引き続き `event.target.value` 全体を受け取る。検索は `autoComplete="off"` / `spellCheck={false}`、autoCorrect / autoCapitalize は未指定 | 検索の入力支援方針を明示する。本文・題名へ同じ抑制を機械的に適用しない。かな・韓国語・拼音・音声入力・貼付けの実機挙動は未確認 | [SearchBar.tsx](../../src/components/SearchBar.tsx)、[NoteEditor.tsx](../../src/components/NoteEditor.tsx) |
| 無題・検索抜粋 | 旧 `NoteCard.preview` はなく、`noteDisplay.ts` が本文由来の見出し・一致箇所の抜粋を作る。保存タイトルは書き換えない。検索強調は未実装 | 旧 preview の `replace(/\s+/g, " ")` による再現を、そのまま現行実関数の結果としない。現行の通常抜粋・検索抜粋・CSS 表示を基準に再確認する。表示用見出しを保存原文へ流用しない | [noteDisplay.ts](../../src/lib/noteDisplay.ts) の `getCardDisplay` / `matchExcerpt`、[NoteCard.tsx](../../src/components/NoteCard.tsx) |
| 書記素の短縮 | `Intl.Segmenter` があれば書記素で処理。取得不能時の fallback は `Array.from(text)`。既存 fallback テストはサロゲート片側を残さないことを確認する定義 | fallback はコードポイント分割であり、家族絵文字・肌色・結合アクセント等を一まとまりに保つ保証ではない。R19 の記録を ML15 の全環境合格へ拡張しない。最低 OS と代替処理を決める | [noteDisplay.ts](../../src/lib/noteDisplay.ts) の `splitGraphemes`、[noteDisplay.test.ts](../../src/lib/__tests__/noteDisplay.test.ts) |
| 検索の比較 | `notesLogic` は trim と引数なしの `toLocaleLowerCase`、題名・本文への includes。NFC・水平空白等価化はない。抜粋側は `toLowerCase` と長さ比較を使い、別の比較経路を持つ | 比較用 NFC・TAB/Zs の統一・UI 非依存の大小文字処理を、結果判定と抜粋で整合させる。元の index と比較後の index を直結しない。日付印は検索対象に含まれない | [notesLogic.ts](../../src/lib/notesLogic.ts)、[noteDisplay.ts](../../src/lib/noteDisplay.ts) の `matchExcerpt` |
| 不可視文字 | 無題・本文の有無・検索中判定に trim を使う。ZWSP 等の表示上見えない値を識別可能な見出しへ置換する専用判定はない | 保存値の掃除で解決しない。不可視文字を含む入力済みメモを「未操作」と判定しない。識別用の代替表示と原文保持を分離する | [noteDisplay.ts](../../src/lib/noteDisplay.ts)、[ReadMode.tsx](../../src/components/ReadMode.tsx)、[SearchBar.tsx](../../src/components/SearchBar.tsx)、[App.tsx](../../src/App.tsx) の `untouchedDraftId` |
| 読み方向・本文構造 | 紙外枠と `.read-mode-scroll` を分離し、文書側が vertical-rl / mixed。横書き読書への切替は未実装。本文は p 内で LF ごとの span に分割し、空行には表示用 U+200B を置く構造へ変化 | 旧「原文一本を p にそのまま置く」前提のまま実装しない。混在段落の方向・空行・選択・OS コピーを現行構造で確認する。日英版の横書き経路は追加要件。本文へ表示用制御文字を保存しない | [ReadMode.tsx](../../src/components/ReadMode.tsx)、[release.css](../../src/release.css) の `.read-line` / `.read-mode-scroll` |
| 書体・装飾 | 筆あと4種と独立キー `zanshin.prefs.brush.v1` があり、Yuji Syuku / Yuji Boku / Klee One の日本語・Latin フォントを同梱。利用者依頼による追加と既存受入記録に記載 | 旧「同梱フォントがない」前提に戻さない。UI 言語変更だけで本人の書体選択を変えない。フォントのカバー範囲・文字体系別の連結・欠けを実機確認し、未対応字形を保証しない | [brushPreference.ts](../../src/lib/brushPreference.ts)、[BrushPicker.tsx](../../src/components/BrushPicker.tsx)、[main.tsx](../../src/main.tsx)、[ACCEPTANCE.md §13.4](../store-release-polish/ACCEPTANCE.md#134-意図的に未実装保留にしたもの) |
| 情報・プライバシー・支援 | `AboutScreen` と日本語本文が追加済み。重ねて表示し、閉じても元画面を維持する。外部窓口は GitHub Issues、公開ページの基底 URL は空文字 | 「アプリ内入口がない」を再指摘しない。新しい同梱本文・aria・公開ページを翻訳対象に含め、無料/広告なし/同期なし/10秒Undo等の意味を保つ。未設定 URL や非公開窓口を用意済みとしない | [AboutScreen.tsx](../../src/components/AboutScreen.tsx)、[appInfo.ts](../../src/lib/appInfo.ts)、[public/privacy.html](../../public/privacy.html)、[public/support.html](../../public/support.html) |
| native の言語・最低 OS | Info.plist の DevelopmentRegion は ja、Localizations は ja のみ。pbxproj の developmentRegion/knownRegions も ja 側へ更新済み。iOS Deployment Target の設定は 14.0 | 英語公開時には完成した辞書・Web fallback・native 宣言を同じ方針へ揃える。旧 en 値の「維持」ではなく、現行 ja からの意図した変更として扱う。実効アプリ言語を Web へ渡す実装は未確認ではなく現行コードに未導入 | [Info.plist](../../ios/App/App/Info.plist)、[project.pbxproj](../../ios/App/App.xcodeproj/project.pbxproj)、[AppDelegate.swift](../../ios/App/App/AppDelegate.swift)、[package.json](../../package.json) |
| 日付・件数・並び | 日付印は createdAt を閲覧環境の Date で YYYY.MM.DD にする。時間帯とカード読み上げは日本語。復旧画面は各メモの updatedAt から最新変更日を表示。印操作も updatedAt を更新する | locale と時刻帯を混同しない。日付印の作成日、メモの変更日、保存版の記録時刻を区別する。先頭固定・同群内変更順と復旧判定を維持。R37 の作成時 TZ スキーマは保留のまま | [zanshinDate.ts](../../src/lib/zanshinDate.ts)、[NoteCard.tsx](../../src/components/NoteCard.tsx)、[RecoveryReview.tsx](../../src/components/RecoveryReview.tsx)、[notesLogic.ts](../../src/lib/notesLogic.ts)、[App.tsx](../../src/App.tsx) の `updateNote` |
| 戻る・新規・Undo | 行き先別の戻る文言、カード位置/フォーカス復帰、未操作新規だけの取消が追加済み。削除は直前1件・10秒・現在起動中。読書位置の保持は既存記録で未実装 | 言語切替で検索語・起点・メモ id・Undo 期限・削除確認対象を初期化しない。文言変更を入力操作とみなして未操作フラグを消さない。読書位置保持は多言語化で自動的に解消した扱いにしない | [App.tsx](../../src/App.tsx)、[NoteEditor.tsx](../../src/components/NoteEditor.tsx)、[ACCEPTANCE.md](../store-release-polish/ACCEPTANCE.md) の R15 / R21 / R25 |

## 3. 壊してはいけない契約

### 3.1 言語とメモデータを分離する

1. UI 言語・地域書式・読み方向・書体は、本文の内容とは別の設定とする。言語変更だけで Note 配列、題名、本文、createdAt、updatedAt、isFavorite、既存 locale、未知のフィールド、復旧 raw を変更しない。
2. 旧 `Note.locale` は既存スキーマの値として保存する。新しい UI 言語コードを流し込んだり、本文の文字種を推測して埋めたり、未知 locale を勝手に置換して validator を通したりしない。
3. 設定はメモの primary / backup / pending / recovery キーと別に保存する。設定保存失敗は設定の問題として扱い、メモの save guard・dirty・保存成功を変更しない。設定の遅い読込み・書込み結果で直近の明示選択を巻き戻さない。
4. App・エディタ・復旧画面へ locale を key として付けて作り直さない。本文 value を再取得・再正規化せず、IME 中の DOM、選択、キャレット、画面位置、検索、確認中の対象を保持する。

### 3.2 保存と復旧の事実を変えずに訳す

1. 本体の確認済み版、現在表示する版、native 予備保存の対象版を混同しない。翻訳は既存の `SaveResult.reason`・対象版・候補の種別から作り、文言を状態判定のキーにしない。
2. `getSaveFailureMessage` は現在、日本語の完成文字列を返す。多言語化では表示時に訳せる境界へ変更できるが、quota / unavailable / invalid_data / conflict / recovery_archive_full / 削除未確定の区別、再試行可能条件、エラーの優先順位を保つ。
3. 翻訳済み候補名や通知を state に保持する箇所は、意味を持つ code・kind・引数へ移す。翻訳を更新するためだけに候補を再ロード・統合・破棄しない。選択 id、確認中 id、保護 slot、expectedRaw は維持する。
4. 空配列は有効な候補。候補なし、読み取り不能、0件の有効版を区別する。0件から「全件削除した」という履歴を推定しない。件数はメモ数なのか保存版数なのかを引数名と説明で固定する。
5. 本体成功を確認してから通常の native 同期へ進む既存経路を維持する。非同期結果の版確認、probe 世代、native 書込み直列化を外さない。native の missing と I/O error を同一視しない。
6. primary / backup / journal、expectedNotes 比較、writerId、同一内容 no-op、未採用候補の保護を維持する。言語追加を理由に保存基盤の全面置換や既存データの再シリアライズ移行を行わない。
7. 保護枠満杯では、確認・取り出し・利用者が選んだ整理・再保存という出口を保つ。未確認候補の自動削除、確認後に変わった raw の削除、成功表示だけを出す強制上書きをしない。
8. 容量不足では削除の保存自体も失敗し得る。単に「メモを削除すれば直る」と訳さない。過去の約4.02倍という保存時値文字列量は合成モデルの観測であり、現行 iPhone の容量保証や最大件数ではない。

### 3.3 原文救済・入力・表示の境界を守る

1. `draftRescue` は最後に記録できたモデルに届く RAM 上の救済である。OS のアプリ言語変更・強制終了・再読込を越えて、任意の未保存版が復元できるとは説明しない。
2. OS 設定へ案内する経路を追加するなら、現在版の保存状態を先に扱う。失敗・競合時は原文取り出しと移動中止を選べるようにする。コピーを完了しても保存済みにしない。
3. 通常の翻訳 Provider、言語設定、Intl formatter の障害で例外画面まで使えなくしない。最小救済の文言と保持モデルへのアクセスは、それらの正常動作だけに依存させない。
4. 明示コピーはモデル文字列を渡す。カード抜粋、DOM の innerText、行装飾、読取り専用 input の value から保存原文を再構成しない。clipboard 書込み失敗と手動選択の代替を残す。
5. 題名は現在 textarea であり、アプリ側で改行を空白へ変える編集契約がある。旧 input の標準挙動と取り違えない。開く・戻る・言語変更だけで既存の長い題名や改行コードを書き換えない。200 の仕様整理で既存データを切断・不正化しない。
6. 検索用の正規化・水平空白処理・大小文字比較は派生値だけへ適用する。原文の NBSP、字下げ、改行、ZWJ / ZWNJ / variation selector を掃除しない。水平空白の等価化で行・段落を跨がせない。
7. 全文 value を受け取る入力方式と、題名の変換中 Enter を尊重する処理を保つ。IME 途中の slice、言語切替によるキーボード強制、原文の自動翻訳を追加しない。
8. 先頭固定は既存仕様を継続する。updatedAt は印を含むメモ全体の変更時刻であり、復旧側でも使う。翻訳上の都合で「本文編集時刻」と呼んだり、印操作だけ時刻更新を止めたりしない。

## 4. 旧調査をそのまま実装指示へ移せない箇所

| 旧資料の記述・再現 | 現在の読み替え |
|---|---|
| エラー画面に再読込しかない | モデルからの読取りとコピーが実装済み。次は救済画面の多言語化と翻訳基盤からの独立性を扱う |
| 復旧候補を一覧比較できない／保護満杯から抜けられない | 比較と明示整理の画面・結果 code が追加済み。既存処理を引き継ぎ、文言・件数・選択中の言語変更を確認する |
| 題名は単一行 input である | 高さ可変 textarea へ変更済み。200 の計数単位は残件。通常 Enter と IME 確定の扱いも現行から引き継ぐ |
| `NoteCard.preview` が内部空白をすべて畳む | 関数は置換済み。通常表示と検索用 `matchExcerpt` の構造、CSS による空白表示、結果判定を今のコードで確認する |
| 絵文字の短縮は UTF-16 slice のみ | Segmenter 経路が追加済み。ただし不在時の fallback はコードポイント単位で、複合書記素の保全は別に必要 |
| 本文は1つの p へ原文をそのまま置く | p の内部に改行ごとの span と空行用 U+200B が入る。段落方向の候補実装はこの差分を含めて比較する |
| アプリ情報の入口がない | 入口と同梱本文は追加済み。翻訳と実在する公開 URL の照合が残る |
| native の developmentRegion は en | 現在は ja。日英公開の既定を en とする設計を採るなら、Web / bundle / 完成辞書を揃える意図した変更として扱う |
| 0件を「すべて削除済み」と呼ぶ | 現行にも残り、新しい比較画面にも同様の文言がある。ここは修正対象として維持する |
| 過去の監査で通常 check が環境エラーになった | それは当時の環境結果。既存 ACCEPTANCE §13 には別の実装環境で通常 check が成功した記録がある。どちらも今回の再実行結果ではない |

## 5. 既存 W0〜W5 と検証記録の引継ぎ

[ACCEPTANCE.md](../store-release-polish/ACCEPTANCE.md) §13 は、対象コミット `9c6bc77`、Linux / Node v22.23.5 / Chromium での通常 `npm run check` 成功（34ファイル・258テスト）、cap sync、Web 描画の確認を記録している。今回の基準はその作業の main 統合後だが、記録を `4ec10d1` の本書による再検証と表記し直さない。実 iPhone、Xcode Archive、TestFlight の合格記録もない。

| 既存範囲 | 引き継ぐ状態 | 多言語化での扱い |
|---|---|---|
| W1：R02 / R03 / R07 / R23 / R33〜R36 | 対応コードと自動確認の記録あり。R23 は実機・200%未確認 | 同じ異常条件に言語変更を重ねる。旧監査の「問題が存在する」assertion を修正後テストとして流用しない |
| W1：R24 | コピー・手動選択は追加。安全確認中の busy / disabled の全操作反映は既存記録で未完 | 翻訳できたことを、操作制御も完成した根拠にしない |
| W2：R01 / R05 / R06 / R11 / R31 | CSS・構造変更、Web 自動確認の記録あり。実機未確認 | 構造を旧版へ戻さず、長い翻訳・横書き・混在文字の代表条件で確認する |
| W2：R08 / R09 / R13 / R27 | 一部対応。透明度整理・文字トークン・一部フォーカス・旧 phase CSS 等に残件 | 多言語化の完了表へ残件を消して転記しない |
| W2：R10 | Dynamic Type / アプリ内文字サイズは未対応・要実機 | 200%相当や OS 文字拡大を多言語受入でも確認する。単なる辞書追加では合格にならない |
| W3：R14〜R20 / R22 | 対応コードと自動確認の記録あり | 無題識別・検索・未操作下書き・印・日時の契約を保持。R19 の fallback の保証範囲は本書 §2 のとおり限定する |
| W3：R21 / R25 / R26 / R32 | 読書位置保持、連続削除・Undo位置、遷移時フォーカス、キーボード実機等に未完・未確認あり | UI 言語切替で文脈を追加で失わないことを確認し、元の未完も追跡する |
| W4：R04 / R28 / R29 | アプリ内情報、日本語 native 宣言、文面等は進展。公開 URL / 非公開窓口 / 最終実機画像等は残件 | 日本語単独版から日英版への差分を明記。英語の説明・画像・支援範囲は新たな確認対象 |
| W5 / R30 | M01〜M16、Archive / TestFlight 等は既存記録で未実施 | ML01〜ML44 の設計・fixture を実機成功とみなさない。内部実装の完了と提出・公開の完了を分ける |
| R37 | 作成時タイムゾーンは初版保留、スキーマ変更なし | 言語・地域の formatter 導入で、作成時 TZ を推定・保存する変更を混ぜない |

### 引継ぐ主な回帰確認の入口

以下は既存テストの所在であり、本書での実行済み一覧ではない。

- 保存表示と削除未確定：`src/__tests__/App.save-failure-continuity.test.tsx`、`App.save-state-versions.test.tsx`、`App.global-save-failure.test.tsx`。
- 復帰・三候補・native：`src/__tests__/App.resume-divergence.test.tsx`、`App.native-durable-snapshot.test.tsx`、`App.native-lifecycle.test.tsx`。
- 描画例外と候補整理：`src/__tests__/App.render-failure-rescue.test.tsx`、`App.recovery-review.test.tsx`、`src/lib/__tests__/storage.test.ts`。
- 中断 journal / no-op / native キュー：`src/lib/__tests__/storage.phase32-orphaned-pending.test.ts`、`storage.phase36-noop.test.ts`、`nativeDurableSnapshot.test.ts`、`nativeDurableSnapshot.secondary-recovery.test.ts`。
- 入力・無題・検索・文脈：`src/__tests__/App.title-input.test.tsx`、`App.navigation-context.test.tsx`、`App.pin-order.test.tsx`、`App.keyboard-layout.test.tsx`、`src/lib/__tests__/noteDisplay.test.ts`、`notesLogic.test.ts`。

## 6. 多言語実装の開始時に記録すること

1. 実装対象 HEAD と本書の基準を比較し、上表でさらに解消・変更された箇所を記録する。
2. 現在到達できる UI と異常時画面を基に辞書の必須範囲を確定する。筆あと、情報、復旧比較、救済など、旧調査後の追加画面も含める。無効な広告・Premium を有効化しない。
3. 旧記録の成功、新規に行った確認、今回未実施の条件を分ける。既存テストが通るだけで言語切替・最低 OS・実機の受入を完了扱いにしない。
4. 実装のための内部作業と、署名・配信・公開 URL 更新・ストア提出を区別する。本書は main への実装マージ、デプロイ、配信、審査提出を新たに許可する文書ではない。

本書は現況の基準であり、多言語機能の実装報告ではない。原文を自動翻訳する機能、クラウド送信、アカウント、分析・追跡などは、この導入へ追加しない。
