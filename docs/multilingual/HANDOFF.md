# 日英対応の引継ぎ

アプリ内の対象言語は日本語と英語です。アプリ情報の言語設定は `system`、日本語、English。読書方向は全メモ共通で、縦書きでは英字の単語を正立させます。横書きも選べます。[採用仕様](DESIGN.md) · [受入記録](ACCEPTANCE.md) · [掲載草案](../app-store-submission-pack.md)

## 同じ候補を使う

1. 実装コミットを確認し、`npm ci`、`npm run check`、`npm audit --omit=dev --audit-level=high`、`npm run cap:sync:ios` を実行します。同期前後で `git diff --exit-code -- ios` を確認します。
2. Mac で提出時点の対応 Xcode/SDK を [Apple の要件](https://developer.apple.com/news/upcoming-requirements/) から確認します。iOS 14.0 の deployment target は別に照合します。
3. `npm run cap:open:ios` で既存のプロジェクトを開き、Signing Team と版番号を確認します。Release の Archive を作り、commit、version/build、Xcode/SDK、Team、対象端末を記録します。
4. Archive 内の `Products/Applications/App.app` の `Info.plist` を `plutil -p` で確認します。 `CFBundleDevelopmentRegion = en`、`CFBundleLocalizations = [ja, en]`、iPhone と portrait、実際の `MinimumOSVersion` を確認します。 `en.lproj` と `ja.lproj` の `InfoPlist.strings`、同梱 JS・フォント・情報ページ、Privacy Manifest を照合します。

## iPhone と VoiceOver

実データを入れていない対象端末で、最低対応 OS と現行 OS を記録します。試験用メモは [合成データの読み替え](fixtures/README.md) に沿って用意します。

| 確認 | 再現・記録 |
|---|---|
| ML02/11/21/22/44 · OS 言語と再起動 | 端末 ja＋アプリ en、端末 en＋アプリ ja で `system` を選びます。反対のアプリ内指定でも確かめ、表示言語と iOS のキーボードや編集メニューの言語を記録します。端末設定からアプリ言語を直接変え、確定したメモへの再入場を確認します。アプリから設定アプリへの移動機能は対象外です。 |
| ML05/06/28〜33 · 実入力 | かな、韓国語、拼音、音声入力、長い貼り付けで、候補選択・確定・取消・選択置換を操作します。200 書記素前後の題名、旧 CR/CRLF、合字や制御文字で編集前後と確定保存を比較します。iOS の検索補助の挙動を記録します。 |
| ML10/12/15/17/19/34/37/39 · 組版 | MLT01〜13/21、長い URL、2,000 語・2,000 字を縦横で読みます。縦書きの英字が正立し、URL とアラビア語が読めることを確認します。筆あと4種、文字拡大、減らす動き、safe area、読書位置の復帰、実際の選択・コピーを確認します。 |
| ML18/35/36 · VoiceOver と音声操作 | ja/en の新規・戻る・編集・削除・比較、長い題名と混在本文、無題、保存失敗、候補、例外を順に操作します。可視名と音声操作名、発音・読み順・フォーカス、失敗通知を確認します。外部キーボードでは、アプリ情報・筆あと・復旧比較・削除確認で Tab と Shift+Tab を操作し、閉じた後に起点へ戻ることを確認します。 |
| ML07/08/09/20/40/41 · 保存と原文救済 | F01〜F08 の実施可能なケースを試験用データで作ります。空版の採用前説明、保存停止、比較の読取り専用性、直前1件の Undo、保護候補の整理、全文コピーと手動選択を確認します。台帳に原文一致と保存先への反映を別々に記録します。 |
| ML20/22 · オフラインと終了 | 機内モードのコールド起動から、言語切替、同梱の説明、書く・保存・全文救済を操作します。失敗の最中は終了前に原文を取り出します。再起動後は確定済み本体と journal/native の候補を確認します。RAM の救済に残っていた本文はプロセス終了で失われ得ます。 |
| ML16 · 時刻と日付 | 同じ保存 ISO を、日付境界を含む端末タイムゾーン2種で ja/en 表示します。作成と変更を区別し、言語切替でタイムゾーン・ISO・順序が動かないことを確認します。 |

## 校閲と掲載

- [文言台帳](translation-ledger.json) の各グループで日英の文言、表示条件、操作の結果を照合します。MRS01〜04 と F01〜08 を使い、現在保存されている内容、次の操作、失われる可能性を確認者に説明してもらいます。
- `npm run copy:check` は現行の指紋、メッセージの網羅、空訳を検査します。承認対象とは異なる変更があれば `node scripts/check-copy.mjs --refresh` で該当グループを要確認に戻します。校閲・実画面の証拠を記入した後に `npm run copy:release` を通します。
- 管理する Privacy / Support の日英 URL を確定し、サインインなしで本文を読めること、相互の言語リンク、問い合わせの公開範囲、対象版を確認します。
- 同じ Archive の iPhone または Simulator で日本語・英語を撮影します。App Store Connect の primary language、URL、プライバシー回答、画像、掲載文を同じ候補と照合します。
