# App Store Submission Checklist

## 現在の初版方針（2026-11-26）

初版はiPhone / portrait、日本語UI、無料・広告なし・Premiumなし・StoreKitなし・アカウントなし・クラウド同期なしです。[featureFlags.ts](../src/lib/featureFlags.ts) と実配信ビルドを照合してください。

品質改善の全37項目と証拠の記録は [store-release-polish/ACCEPTANCE.md](store-release-polish/ACCEPTANCE.md)、作業順は [IMPLEMENTATION.md](store-release-polish/IMPLEMENTATION.md) を使います。本書のチェック欄は、実際に確認した環境・コミットとともに更新します。設計済み・コード実装済み・実機確認済みを区別します。

署名・アップロード・審査提出・配信開始は、その時点の利用者の依頼に従います。準備完了だけで自動提出しません。

## Apple Developer / App Store Connect

- [ ] Apple Developer Program登録済み
- [ ] App Store Connectでアプリ作成
- [ ] Bundle ID作成
- [ ] SKU決定
- [ ] アプリ名確認
- [ ] カテゴリ決定
- [ ] 年齢制限設定
- [ ] 価格設定
- [ ] 配信国設定

## Build

- [ ] 追跡済みのCapacitor 7 / iOSプロジェクトと依存ロックを使用
- [ ] iosを再生成せず、cap sync後の意図しない差分を確認
- [ ] 提出時点のApple SDK要件とXcodeバージョンを確認して記録
- [ ] Bundle Identifier設定
- [ ] Version / Build Number設定
- [ ] iPhone実機確認
- [ ] TestFlight確認
- [ ] Release build作成
- [ ] Xcode Archive
- [ ] App Store Connectへアップロード

## Core App

- [ ] メモ作成
- [ ] メモ編集
- [ ] メモ削除
- [ ] 自動保存
- [ ] localStorageまたはiOS保存確認
- [ ] 検索
- [ ] お気に入り
- [ ] 日付印
- [ ] 保存アニメーション
- [ ] 全37項目の状態・証拠・未確認条件を記録
- [ ] 初版で広告・Premium・モック購入/復元導線が表示されない

## StoreKit / Premium（将来、明示的に採用した時のみ）

初版では対象外です。以下を初版の必須作業として実装しないでください。

- [ ] App Store ConnectでIAP作成
- [ ] Product ID確認
- [ ] StoreKit実装
- [ ] 商品情報取得
- [ ] 購入処理
- [ ] 購入復元
- [ ] Sandboxテスト
- [ ] TestFlightテスト
- [ ] mock購入削除または本番では無効化

## Ads（将来、明示的に採用した時のみ）

初版ではSDKを追加せず、広告が出ないことをCore Appで確認します。

- [ ] 広告SDKを入れるか決定
- [ ] 広告表示位置確認
- [ ] エディタ広告非表示
- [ ] 保存直後広告非表示
- [ ] Premium時広告非表示
- [ ] SDKのPrivacy Manifest確認
- [ ] SDKのデータ収集内容確認

## Privacy

- [ ] Privacy Policy URL用意
- [ ] アプリ内の到達しやすい入口からポリシーを読め、メモの文脈へ戻れる
- [ ] App Privacy入力
- [ ] 第三者SDKの収集データ確認
- [ ] トラッキング有無確認
- [ ] ATT必要性確認
- [ ] トラッキングなしの実装とATT表示方針が一致する
- [ ] 年齢区分・対象ユーザーの申告が実態と一致する

## Metadata

- [ ] アプリ説明文
- [ ] サブタイトル
- [ ] キーワード
- [ ] プロモーションテキスト
- [ ] スクリーンショット
- [ ] アイコン
- [ ] サポートURL
- [ ] プライバシーポリシーURL
- [ ] Review Notes
- [ ] 日本語UIと対応言語の申告が一致する
- [ ] Capacitor使用を踏まえ、「第三者SDKなし」と断言しない
- [ ] 実際に管理する問い合わせ窓口を確認。架空の連絡先を入れない
- [ ] 最終TestFlightビルドに一致する画面からスクリーンショットを作る

## Final Review

- [ ] 誇大表現なし
- [ ] 医療/治療表現なし
- [ ] 初版の利用者画面に広告が表示されない
- [ ] 初版の利用者画面にPremium・購入・復元購入の導線が表示されない
- [ ] 残心の世界観が壊れていない

## 公式要件の確認記録

2026-11-26確認時点では、2026-04-28以降のアップロードにXcode 26以降・iOS 26 SDK以降が必要です。これは提出用SDKの条件であり、最低対応OSをiOS 26へ変更する指示ではありません。提出直前に [Apple公式要件](https://developer.apple.com/news/upcoming-requirements/?id=04282026a) を再確認してください。

プライバシー導線は [App Review Guidelines 5.1.1(i)](https://developer.apple.com/app-store/review/guidelines/#privacy) を参照し、App Store ConnectのURLとアプリ内の入口の両方を確認します。
