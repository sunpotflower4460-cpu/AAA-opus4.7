# iOS Wrapper Plan

> これは導入前の計画記録です。2026-11-26現在、Capacitor 7、Git管理されたiosプロジェクト、端末内の予備保存は導入済みです。通常作業でiosを削除・再生成しません。現在の作業は [iOS / TestFlight Runbook](ios-testflight-runbook-phase-20.md) と [品質改善指示書](store-release-polish/README.md) を参照してください。下記のStoreKit/広告検討は初版には適用しません。

## 推奨
Capacitor

## 理由
- 既存Web実装を活かせる
- App Store提出ルートを作りやすい
- 将来ネイティブ機能を追加できる

## 必要作業
- Capacitor追加
- iOS platform追加
- Xcode project生成
- Bundle ID設定
- App icon設定
- Splash screen設定
- WKWebView表示確認
- localStorage挙動確認
- StoreKit bridge検討
- 広告SDK bridge検討

## 注意
- この Phase では導入計画までに留める
- 実装開始は別 Phase とし、Capacitor 導入後に実機検証を行う
- WebView 品質不足に見えないよう、オフライン保存と iOS らしい操作感を整える
