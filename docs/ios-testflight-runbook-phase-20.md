# Phase 20 iOS / TestFlight Runbook

## 目的

残心 / Zanshin を App Store 初回リリースへ進める前に、Web build、Capacitor iOS、実機、TestFlight の流れを確認する。

このRunbookは、ユーザーがMac上で実行する手順として書く。

---

## 前提

- Apple Developer Program に登録済み
- Xcode がインストール済み
- Apple ID で Xcode にログイン済み
- iPhone実機で確認できる
- App Store Connect でアプリ登録できる

---

## 初回リリース方針

初回リリースは以下で固定する。

- 無料
- 広告なし
- Premiumなし
- StoreKitなし
- アカウントなし
- クラウド同期なし
- トラッキングなし
- 外部SDKなし
- ローカル保存のみ

---

## 1. ローカル準備

```bash
git checkout main
git pull
npm install
npm run check
```

`npm run check` は以下をまとめて確認する。

- TypeScript
- ESLint
- Vitest
- Production build

---

## 2. Web preview確認

```bash
npm run dev
```

または Cloudflare preview を使う場合:

```bash
npm run preview
```

確認幅:

- 375px
- 390px
- 430px
- PC幅

確認する画面:

- 空状態
- メモ一覧
- 新規メモ作成
- エディタ
- 読み返し縦書きモード
- 削除確認
- 削除Undo

---

## 3. Capacitor パッケージ確認

このリポジトリでは Capacitor 設定ファイルは存在するが、環境によっては `@capacitor/*` がローカルに入っていない可能性がある。

不足している場合のみ、以下を実行する。

```bash
npm install -D @capacitor/cli @capacitor/core @capacitor/ios
```

その後:

```bash
npm run build
npx cap sync ios
```

まだ iOS プロジェクトが存在しない場合:

```bash
npx cap add ios
npx cap sync ios
```

注意:

- `ios/` は生成物として `.gitignore` 対象
- 生成された `ios/` は必要に応じてローカルで管理する
- App Store提出用のBundle IDは `capacitor.config.ts` の `appId` と整合させる

---

## 4. Xcode確認

```bash
npx cap open ios
```

Xcodeで確認する項目:

- Bundle Identifier: `com.zanshin.notes`
- Display Name: `残心`
- Version / Build Number
- Signing Team
- Deployment Target
- App Icon
- Launch Screen
- Supported Devices

---

## 5. 実機確認

iPhone実機で確認する。

### 基本機能

- [ ] 起動できる
- [ ] 新規メモ作成
- [ ] タイトル編集
- [ ] 本文編集
- [ ] 自動保存
- [ ] アプリ再起動後にメモが残る
- [ ] 検索
- [ ] お気に入り
- [ ] 削除確認
- [ ] 削除Undo

### Phase 19 / 19b

- [ ] 既存メモをタップすると縦書き読み返しモードに入る
- [ ] `言葉を直す` で編集画面へ入れる
- [ ] 縦書きの横スクロールがiOS WebViewで自然に動く
- [ ] 長文が重くない
- [ ] 英数字混じりでも破綻しない
- [ ] 紙ノイズが汚れに見えない
- [ ] 保存後の円相余韻が派手すぎない
- [ ] キーボード表示時に入力欄が使える
- [ ] Safe Area が崩れない

---

## 6. TestFlight ビルド

Xcodeで以下を行う。

1. Product > Archive
2. Organizer を開く
3. Distribute App
4. App Store Connect
5. Upload
6. App Store Connect で処理完了を待つ
7. TestFlight に追加
8. 自分の端末でTestFlight版を確認

TestFlight確認では、Web previewと同じ項目を確認する。

---

## 7. App Store Connect 提出前確認

- [ ] アプリ名
- [ ] サブタイトル
- [ ] 説明文
- [ ] キーワード
- [ ] プロモーションテキスト
- [ ] スクリーンショット
- [ ] Privacy Policy URL
- [ ] Support URL
- [ ] Review Notes
- [ ] App Privacy
- [ ] 年齢制限
- [ ] カテゴリ
- [ ] 配信国

---

## 8. 審査メモ

Review Notes には次を明記する。

```text
This app is a simple local note-taking app.
No account is required.
No ads are included.
No in-app purchases are included.
No analytics, tracking, or third-party SDKs are included.
Notes are stored locally on the device and are not sent to an external server.
```

---

## 9. よくある判断

### App内課金は入れる？

初回は入れない。

理由:

- StoreKit未実装
- 審査リスクを下げる
- コア体験を先に確認する

### 広告は入れる？

初回は入れない。

理由:

- 静けさを壊しやすい
- Privacy申告が複雑になる
- Phase 19の体験確認を優先する

### クラウド同期は入れる？

初回は入れない。

理由:

- アカウント・バックエンド・プライバシー対応が必要になる
- 残心の最小体験から外れる

---

## 完了条件

- [ ] `npm run check` 成功
- [ ] 実機確認完了
- [ ] TestFlight確認完了
- [ ] App Store Connect提出情報が揃っている
- [ ] スクリーンショットが揃っている
- [ ] Privacy Policy / Support URL が用意できている

これを満たしたら、初回審査へ進める。
