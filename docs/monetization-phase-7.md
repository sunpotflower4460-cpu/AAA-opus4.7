# Phase 7 Monetization Design

## 目的
広告とプレミアム導線を、残心の静けさを壊さない形で設計する。

## 広告方針
- エディタには出さない
- 保存直後には出さない
- メモ一覧下部を基本位置にする
- Premium では非表示
- MVP では広告 SDK ではなく `AdSlot` プレースホルダー
- 検索中や空状態では無理に出さない
- メモカードと誤認されない落ち着いた見た目にする

## Premium 方針
- 中核は広告削除
- 文言は静かに
- 強い課金圧を避ける
- 購入復元導線を用意する
- Premium は「静かな書く時間を守る支援」として扱う

## Product ID 案
- `zanshin.premium.remove_ads`
- `zanshin.premium.monthly`
- `zanshin.premium.yearly`

初期は買い切りの `zanshin.premium.remove_ads` を主軸にする。メモ帳に毎月の課金圧を持ち込みにくく、広告削除の意味も伝わりやすい。

## モック実装の扱い
- Phase 7 の購入導線は `localStorage` を使うモック実装
- `src/lib/monetization.ts` を StoreKit 置き換えレイヤーとして扱う
- `AdSlot` は広告 SDK の代わりに広告位置を確認するプレースホルダー
- 本番申請前にモック購入導線を残したままにしない

## App Privacy / ATT (App Tracking Transparency) 注意
App Store Connect では、アプリ本体だけでなく第三者 SDK が収集するデータも含めて申告する必要がある。

広告 SDK を入れる場合は以下を確認する。
- 位置情報を取るか
- 識別子を取るか
- 使用状況データを取るか
- 診断情報を取るか
- トラッキングに使うか
- 第三者広告に使うか

IDFA やクロスアプリ/サイト追跡を使う広告・測定を行う場合は ATT が必要になる可能性がある。残心では、できる限りトラッキング広告ではなく、非パーソナライズド広告または最小限の広告から検討する。

## 本番実装前 TODO
- StoreKit 実装
- App Store Connect で IAP 作成
- Product ID 一致確認
- 購入処理と復元処理の本実装
- Sandbox テスト
- TestFlight 確認
- App Review 用スクリーンショットと Review Notes の準備
- App Privacy 更新
- ATT 必要性確認
- 広告 SDK の Privacy Manifest / データ収集確認
- 非パーソナライズド広告設定の検討

## Phase 8 UI/UX監査で維持するルール
- 広告はメモ一覧下部を基本位置にし、空状態の中心やエディタには出さない
- 保存直後に広告を出さない
- Premium導線は控えめにし、書き始め体験を壊さない
- 購入復元導線は PremiumSheet または同等の導線で常にアクセス可能にする
- StoreKit実装前はモック実装であることを継続明記する

## 広告 SDK 本番導入 TODO
- 広告 SDK を選定する
- SDK の収集データ・追跡有無を確認する
- Privacy Manifest を確認する
- UI 上で残心の余白を壊さないか実機確認する
- Premium 時に確実に広告を止める
