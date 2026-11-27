# 綴りの引継ぎ

[受入記録](ACCEPTANCE.md) · [素材とライセンス](MATERIALS.md) · [実装判断](DECISIONS.md) · [販売草案](STORE_DRAFT.md)

## 同じ候補で確認する

1. 実装コミットを指定し、Node 22 で `npm ci`、`npm run check`、`npm audit --omit=dev --audit-level=high`、`npm run cap:sync:ios` を実行します。
2. PlaywrightとPopplerを入れ、Chromiumで [evidence/check.py](evidence/check.py) を実行します。

```sh
python -m http.server 4381 --bind 127.0.0.1 --directory dist
npm run dev -- --host 127.0.0.1 --port 4382
python docs/paid-experience/evidence/check.py http://127.0.0.1:4381 /tmp/tsuzuri-evidence --dev-origin http://127.0.0.1:4382
```

3. Mac、対応XcodeとSDK、署名チーム、初期化可能なiPhoneを用意します。iOS 14で基本制作・基本PDF・バックアップを確認します。購入の試験にはStoreKit 2が使えるiOS 15以降を用意します。
4. 署名した同一候補でアプリ言語、絵文字と異体字、文字拡大、VoiceOver、外部キーボード、縦横の複数面、動きを減らす設定をja/enで確認します。墨紙では入力キャレット、選択、日付、保存状態を見ます。

## 保存と原文

- 合成メモを選んでから別画面で元メモを変更します。そのまま綴じ、三者の比較から変更を採用し、別冊と旧版の原文を照合します。
- 機内モードで終了と起動を行い、冊子の本体と予備を照合します。容量不足、native読込失敗、遅い書込みで直前版が残り、候補とRAM上の下書きへ別々に到達できることを確認します。
- 同じIDで異なる本文を復元中に終了します。メモの復旧画面で保存状況を確定し、「復元を再開」を選びます。途中で別のメモ更新があれば差分を再確認します。
- メモ単独、冊子単独、全文章の削除を順に試します。全削除の途中と直後に終了し、本体、journal、復旧候補、native予備、共有用一時ファイルが復活しないことを確認します。

## 出力

- 無題、一行、2,000字、10,000字、長いURL、混在文をA5・A6で生成します。実機の「ファイル」とPDFビューアで冒頭・末尾、選択・コピー・検索、縦書き順、空白面、字形、寸法を照合します。
- PNGは長辺2048 pxです。全篇、複数面、選んだ一節、ZIPの面順、固定見本を照合します。共有の終了や取消を端末外への保存成功と混同しないことを確かめます。
- PDFの見える文字はCanvasで組版し、検索・選択のための原文テキスト層にフォントを埋め込みます。PDFビューアごとの縦書き選択順と代替字形は個別に確認します。10篇と100篇の時間、ピークメモリ、出力バイト数を同じ候補で記録します。

## StoreKit

1. Xcodeの試験専用StoreKit構成に非消耗型 `zanshin.tsuzuri` を作ります。その構成だけで `ZanshinTsuzuriSalesEnabled` を有効にします。
2. 価格取得、購入、キャンセル、承認待ち、通信失敗、復元、取消を試します。同じ見本への復帰、未購入の2冊目、複数冊の復元、取消後の既存編集と基本PDFを照合します。
3. App Store Connectの契約と商品を確認し、Sandbox、その後にTestFlightで別の証拠を取ります。復元の明示ボタンから `AppStore.sync()` を確認します。
4. `npm run copy:release` のグループに日英の文言、実画面、候補版を登録します。StoreKitの表示価格と掲載草案、実際の素材を照合します。
