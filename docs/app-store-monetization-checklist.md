# App Store Monetization Checklist

> **旧広告・Premium計画の確認項目です（2026-11-27追記）。** 現在の無料初版・日英対応では対象外です。新しい有料拡張は [「残心 綴り」](paid-experience/README.md) のP0〜P6と [AC01〜AC26](paid-experience/ACCEPTANCE.md) を使います。本書のAds欄を新商品の必須作業へ加えず、旧モックを有効化しません。以下は当時の参考資料です。現在の無料初版の提出入口は [App Store Submission Checklist](app-store-submission-checklist.md) です。

## IAP
- [ ] Phase 7/8 はモック実装であることを最終確認
- [ ] Paid Apps Agreement 確認
- [ ] App Store Connect で IAP 作成
- [ ] Product ID 確認
- [ ] StoreKit 実装
- [ ] 購入処理
- [ ] 復元処理
- [ ] Sandbox テスト
- [ ] TestFlight 確認
- [ ] Review 用スクリーンショット
- [ ] Review Notes

## Ads
- [ ] 広告 SDK 選定
- [ ] データ収集内容確認
- [ ] Privacy Manifest 確認
- [ ] App Privacy 更新
- [ ] ATT 必要性確認
- [ ] 非パーソナライズド広告設定検討
- [ ] エディタ非表示確認
- [ ] Premium 時非表示確認

## UX
- [ ] 起動直後に課金ポップアップを出していない
- [ ] 執筆中に広告を出していない
- [ ] 保存直後に広告を出していない
- [ ] 空状態の中心を広告/課金導線で壊していない
- [ ] 広告がメモカードと誤認されない
- [ ] プレミアム導線が煽りすぎていない
