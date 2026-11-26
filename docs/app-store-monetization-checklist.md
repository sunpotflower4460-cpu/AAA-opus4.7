# App Store Monetization Checklist

> 初版では対象外（2026-11-26）。広告・Premium・StoreKitを有効化しない方針です。本書は将来それらを明示的に採用した時の参考資料であり、初版公開の必須作業ではありません。現在の入口は [App Store Submission Checklist](app-store-submission-checklist.md) と [品質改善の指示書](store-release-polish/README.md) です。

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
