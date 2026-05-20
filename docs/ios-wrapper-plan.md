# iOS Wrapper Plan

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
