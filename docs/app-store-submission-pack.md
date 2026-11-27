# App Store 掲載草案 · 残心 / Zanshin 1.0

日英候補向けの草案。校閲、iPhone、署名した Archive、公開 URL の照合が残っています。日本語を掲載の主言語とし、共通英語のメタデータを追加する想定です。掲載の主言語とアプリの既定言語は別に設定します。[日英受入記録](multilingual/ACCEPTANCE.md)

| 項目 | ソース上の候補 |
|---|---|
| Bundle ID | `com.zanshin.notes` |
| Version / Build | `1.0` / `1` |
| 端末 | iPhone、縦向き。deployment target は iOS 14.0 |
| アプリの表示言語 | 日本語・英語。対応するシステム候補がない場合は英語 |
| ホーム画面名 | 日本語は「残心」、英語は「Zanshin」 |
| 価格と機能 | 無料、広告・アプリ内課金・アカウント・クラウド同期なし |
| プライバシー | React と Capacitor を使用。メモは端末内で処理し、広告・分析・追跡の SDK は使わない |

## 日本語

| 項目 | 草案 |
|---|---|
| アプリ名 | 残心 - Zanshin Notes |
| サブタイトル | 静かに書き、読み返すメモ帳 |
| プロモーション | 書いたあとにも、心が残る。和紙のような紙面にメモを書き、縦書きでも横書きでも読み返せます。 |
| キーワード | メモ,メモ帳,日記,ノート,記録,創作,文章,和紙,余白,縦書き,筆,手書き |

### 説明

残心は、静かに書き、読み返すためのメモアプリです。和紙のような紙面に、日々の思いや創作の一行を残せます。タイトルは任意で、書いた内容は端末に自動で保存されます。

- 読み返し画面で縦書きと横書きを選べます。
- メモを題名や本文で検索できます。よく読むメモは金のしるしで先頭に留められます。
- 明朝・筆・墨・手書きの四つから筆あとを選べます。
- 削除した直前の一件は、アプリを開いたままなら10秒以内に元に戻せます。
- アプリの表示は日本語と英語から選べます。

アカウント登録は不要です。無料で使え、広告はありません。メモは端末内に保存されます。

### 更新情報の欄を使う場合

日本語と英語の表示を切り替えられるようになりました。読み返しでは縦書きと横書きを選べます。保存できないときはタイトルと本文をコピーできます。

## English

| Field | Draft |
|---|---|
| App name | Zanshin Notes |
| Subtitle | A quiet place for your words |
| Promotional text | Write a little. Return whenever you like. Revisit your notes in horizontal or vertical reading on a quiet, paper-like page. |
| Keywords | notes,journal,memo,writing,diary,paper,vertical,zanshin,notebook,calm |

### Description

Zanshin is a quiet place to write and revisit your notes. Save a passing thought or work on a draft on a page inspired by Japanese paper. A title is optional, and your changes save automatically on your device.

- Choose horizontal or vertical reading.
- Search note titles and text. Pin important notes to the top with a gold mark.
- Choose Mincho, Brush, Ink, or Handwriting.
- Undo your most recent deletion within 10 seconds while the app stays open.
- Use the app in English or Japanese.

Zanshin is free and has no ads or sign-up. Your notes stay on your device.

### What’s New, if applicable

Switch between English and Japanese, and choose horizontal or vertical reading. If saving fails, you can copy your original title or text.

## 審査確認手順

1. Launch the app. In About this app, choose English under Language. In Japanese, the entry is 「このアプリについて」 and the setting is 「言語」.
2. Choose New note / 「メモを書く」, enter a title and text, and wait for Saved / 「保存済み」. Return to the list and open the note.
3. Try Horizontal / 「横書き」 and Vertical / 「縦書き」. Choose Edit / 「編集する」, then use Pin to top / 「先頭に留める」. Use search from the home screen.
4. Open the note, edit it, and choose Delete this note / 「このメモを削除」. Confirm the deletion and use Undo / 「元に戻す」 within 10 seconds.
5. Reopen About this app / 「このアプリについて」 to read the on-device storage, recovery copy, privacy, and support information.

The app uses Capacitor for on-device functionality and requires no login. Notes are stored locally. An external link opens public GitHub Issues when selected. Device backups managed by iOS can include app data.

## URL・画像・Archive

| 項目 | 候補と確認 |
|---|---|
| Privacy Policy | 日英の原稿は [日本語](../public/privacy.html)・[English](../public/privacy-en.html)。公開 URL は未確定 |
| Support URL | 日英の原稿は [日本語](../public/support.html)・[English](../public/support-en.html)。公開 URL は未確定。窓口は公開の [GitHub Issues](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/issues) |
| App Privacy | 最終 SDK、通信、Privacy Manifest を照合し、App Store Connect に実態を申告 |
| 実 UI の参考画像 | [日英の Chromium 撮影](multilingual/evidence/README.md)。掲載画像は同じ署名候補を対象 iPhone または Simulator で撮影 |
| 画像の順番 | 読書（日本語は縦書き、英語は横書き）、入力、検索、筆あと。提出時に Apple の寸法と要件を確認 |
| 配信設定 | 価格、カテゴリ、年齢区分、配信地域、著作権、審査連絡先を提出者が実値で照合 |
| ビルドと実機 | [引継ぎ手順](multilingual/HANDOFF.md) に従い、提出用 SDK と最低実行 OS を個別に確認 |
