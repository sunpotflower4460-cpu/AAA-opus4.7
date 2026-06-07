# Phase 20 App Store Prep Report

## 目的

Phase 20では、Phase 19 / 19b で磨いた残心 / Zanshin を、App Store 初回リリースへ進めるための提出前資料を整備しました。

このPhaseでは実機操作そのものは行わず、ユーザーがMac / Xcode / App Store Connectで迷わず確認できるように、ドキュメントと公開ページを追加しました。

---

## 初回リリース方針

引き続き、初回リリースは以下で固定します。

- 無料
- 広告なし
- Premiumなし
- App内課金なし
- アカウントなし
- クラウド同期なし
- 外部SDKなし
- トラッキングなし
- ローカル保存のみ

---

## 追加したもの

### 1. App Store提出文面

追加:

- `docs/app-store-submission-copy-phase-20.md`

内容:

- App Name候補
- Subtitle候補
- Promotional Text
- 日本語説明文
- 英語説明文
- Keywords
- Review Notes
- Privacy Nutrition Label 方針メモ
- スクリーンショット内コピー
- 使用しない表現

Phase 19後の実装に合わせて、Premium / 広告削除を初回リリース文面から外しました。

---

### 2. iOS / TestFlight Runbook

追加:

- `docs/ios-testflight-runbook-phase-20.md`

内容:

- ローカル準備
- Web preview確認
- Capacitor確認
- Xcode確認
- 実機確認
- TestFlightビルド
- App Store Connect提出前確認
- 審査メモ

Capacitorパッケージが環境に存在しない場合の追加インストール手順も明記しています。

---

### 3. スクリーンショット計画

追加:

- `docs/screenshot-plan-phase-20.md`

推奨構成:

1. 縦書き読み返しモード
2. エディタ画面
3. メモ一覧
4. 空状態
5. 日付印 / 紙質感

Phase 19の強みである「縦書き読み返し」を1枚目にする方針にしました。

---

### 4. Support URL用ページ

追加:

- `public/support.html`

内容:

- アプリ概要
- 基本的な使い方
- データ保存について
- よくある確認
- GitHub Issuesへの問い合わせ導線
- Privacy Policyへのリンク

App Store Connect の Support URL として使える簡易ページです。

---

### 5. Privacy Policy更新

更新:

- `public/privacy.html`

変更内容:

- 最終更新を `2026年6月` に更新
- 問い合わせ先をサポートページへ変更
- サポートページへのリンクを追加

---

## 実装しなかったこと

- iOSネイティブプロジェクト生成
- TestFlightアップロード
- App Store Connectへの入力
- スクリーンショット画像生成
- App Icon作成
- StoreKit導入
- 広告SDK導入
- 分析SDK導入

これらは、実機環境・Apple Developerアカウント・Xcode操作が必要なため、ユーザー側の確認工程として残しています。

---

## 次にやること

1. Macで `npm run check`
2. Web previewで画面確認
3. `npx cap add ios` / `npx cap sync ios`
4. Xcodeで実機起動
5. TestFlightビルド作成
6. スクリーンショット撮影
7. App Store Connectに文面入力
8. App Privacyを実装と一致させて入力
9. Review Notesを貼り付け
10. 初回審査へ提出

---

## 判断基準

App Store提出前に見るべき最終基準:

> アプリを開いた瞬間、説明される前に「静かに書けそう」と感じるか。

この感覚が残っていれば、初回リリースへ進めます。
