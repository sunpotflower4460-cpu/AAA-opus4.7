# 日英候補の Chromium 証拠

製品コードは `efbdcafa6cc40755d9b43fec37681332a2fce577`。Linux Chromium 156.0.8078.79 を使用し、最終 Web ビルドをローカル配信しました。画像は390×844 CSS px、標準文字、Asia/Tokyo、合成メモです。Apple 向けの掲載画像は署名候補の iPhone または Simulator から撮影します。[受入記録](../ACCEPTANCE.md) · [掲載草案](../../app-store-submission-pack.md)

| 実画面 | 日本語 | English |
|---|---|---|
| 入力 | [入力](screens/ja-editor.jpg) | [Editor](screens/en-editor.jpg) |
| 検索 | [検索](screens/ja-search.jpg) | [Search](screens/en-search.jpg) |
| 読み返し | [縦書き](screens/ja-read.jpg) | [Horizontal reading](screens/en-read.jpg) · [Vertical reading with upright Latin letters](screens/en-read-vertical.jpg) |
| 保存に失敗 | [領域不足と救済操作](screens/ja-save-failure.jpg) | [Quota and copy actions](screens/en-save-failure.jpg) |
| 候補の閲覧 | [未保存原文と保存版の比較](screens/ja-recovery.jpg) | [Compare and copy originals](screens/en-recovery.jpg) |
| アプリ情報 | [言語設定・同梱情報](screens/ja-about.jpg) | [Language and on-device help](screens/en-about.jpg) |

## 再現

Playwright の Python パッケージと Chromium が入った環境で、同じ製品ビルドを配信して実行します。

```bash
npm ci
npm run build
python3 -m http.server 4174 --bind 127.0.0.1 --directory dist
```

別のターミナルで実行します。

```bash
python3 docs/multilingual/evidence/browser_check.py http://127.0.0.1:4174 --output /tmp/zanshin-evidence
```

疑似翻訳も再現する場合は、`npm run dev -- --host 127.0.0.1` を別に起動し、上のコマンドに `--pseudo-origin http://127.0.0.1:5173` を追加します。開発サーバーから取得した辞書だけを書き換え、別の言語設定を製品へ追加せず長い表記を試します。

## 実施範囲

- 375×667、390×844、430×932 の日英で作成・編集・検索・言語変更・読書・先頭固定・削除・Undo を操作。文字サイズを CSS で2倍にし、画面に収まることと操作への到達を確認。
- 約2,000字と2,000語、長いURL、日本語・英語・アラビア語の混在を縦横で確認。末尾の印を画面内に出し、先頭・末尾LFや空行を含む原文を DOM 選択と Chromium の Clipboard から照合。
- journal 書込みだけに容量エラーを注入。日英でメッセージを確認し、実 Clipboard の本文と保存済み版の両方を照合。比較画面の原文を読み取り専用で開く。
- 設定だけの容量不足、空の復旧候補の選択と別タブの言語変更、Unicode 検索、RTL の URL 抜粋を操作。Chromium で Segmenter を無効にした状態も確認。
- ロード後に Chromium をオフラインにして辞書と同梱説明を操作。プライバシーとサポートの言語相互リンクをローカルで確認。

iOS WKWebView、OS 側の文字拡大、タッチの範囲選択、VoiceOver、native の起動と保存は [実機手順](../HANDOFF.md) に残しています。
