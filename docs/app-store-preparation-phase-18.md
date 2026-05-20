# Phase 18 App Store Preparation Report

## 目的
残心 / Zanshin を App Store 申請に向けて整理し、iOS アプリ化・提出情報・Privacy・課金・広告の前提を曖昧にしない状態を作る。

---

## 1. 現在の状態
- Web MVP: 実装済み
- Cloudflare Pages: Phase 17 で公開準備まで整理済み。接続済み環境では公開確認が必要
- localStorage: 実装済み。メモ本体と Premium mock 状態は端末内保存
- 広告枠: `AdSlot` プレースホルダーで位置確認のみ
- Premium mock: `localStorage` ベースの仮実装
- StoreKit: 未実装
- 広告SDK: 未導入
- App Privacy: 未申告。提出前に App Store Connect で整理が必要
- ATT: 未実装。トラッキング広告や IDFA を使う場合のみ要否確認が必要

---

## 2. App Store化方針
候補:
- Capacitor
- WKWebView ベースの iOS ラッパー
- React Native / SwiftUI 移植

初期推奨:
- Capacitor

理由:
- 既存の React + TypeScript + Vite 実装を活かしやすい
- App Store 提出までの最短ルートを作りやすい
- localStorage 挙動、StoreKit bridge、広告 SDK bridge を段階的に検証しやすい
- 将来ネイティブ化する場合も、まず提出要件と運用要件を見極めやすい

---

## 3. App Store申請前に必要な作業
- Capacitor などで iOS ラッパー方針を確定し、Bundle ID / Version / Build Number を整える
- 実機 iPhone と TestFlight で、作成・編集・削除・保存・検索・お気に入り・Premium 導線を確認する
- mock Premium を StoreKit 本番実装へ差し替え、購入復元も実装する
- 広告 SDK を導入するか決め、導入する場合は Privacy Manifest と収集データを確認する
- App Privacy / ATT / Privacy Policy / Review Notes / スクリーンショットを App Store 提出用に整える
- App Store Connect のメタデータを、誇大表現や医療的表現なしで確定する

---

## 4. 収益化方針
無料版:
- 基本メモ機能
- 控えめな広告枠

Premium:
- 広告削除
- 静かな余白を守る

Product ID 候補:
- `zanshin.premium.remove_ads`

補足:
- 現在の Premium は mock であり、本番課金ではない
- App Store 提出前に StoreKit の商品取得・購入・復元へ差し替える
- 課金導線は一覧下部中心に留め、書く体験を優先する

---

## 5. Privacy / ATT方針
- 広告SDK未導入: 現時点では第三者広告 SDK 由来の収集データなし
- 広告SDK導入予定: 未定。導入する場合は SDK ごとに Privacy Manifest とデータ収集内容を確認する
- トラッキング有無: 現時点では未実装。導入 SDK の仕様次第で再判定する
- ATT必要性: IDFA やクロスアプリ/サイト追跡を使う場合に必要。非パーソナライズド広告を優先検討する
- App Privacy申告項目: ローカル保存、IAP、将来導入する広告 SDK / 分析 SDK の収集データを含めて整理する

---

## 6. 審査リスク
- mock Premium を本番購入のように見せると、課金実装不備として審査で問題になりやすい
- 広告 SDK や第三者コードのデータ収集申告漏れは、App Privacy で不整合になりやすい
- トラッキング広告を使うのに ATT 対応がない場合、審査で止まりやすい
- 「癒やす」「改善する」などの強い効能表現は、メンタルヘルスや医療表現と誤認されやすい
- WebView 由来の体験が粗いと、品質不足に見える可能性がある

---

## 7. 次の作業
- iOS ラッパー作成
- StoreKit 本番実装
- 広告 SDK 選定
- Privacy 確認
- TestFlight 確認
