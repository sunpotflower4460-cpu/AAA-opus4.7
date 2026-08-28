# Phase 20 iOS / TestFlight Runbook

## 目的

残心 / Zanshin を App Store 初回リリースへ進める前に、Web build、Capacitor iOS、実機、TestFlight の流れを再現可能な手順で確認する。

Phase 33 以降、`ios/` は生成物ではなく **native source artifact** として Git 管理する。通常作業で `npx cap add ios` は実行しない。

---

## 前提

- Apple Developer Program に登録済み
- Xcode がインストール済み
- Apple ID で Xcode にログイン済み
- CocoaPods が利用可能
- iPhone 実機で確認できる
- App Store Connect でアプリ登録できる
- Node.js 22 以上

---

## 初回リリース方針

初回リリースは以下で固定する。

- iPhoneのみ
- portraitのみ
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

## 1. クリーンなローカル準備

```bash
git checkout main
git pull
npm ci
npm run check
```

`npm ci` を使い、`package-lock.json` に固定された Capacitor / Web 依存をそのまま再現する。

`npm run check` は以下をまとめて確認する。

- TypeScript（`capacitor.config.ts` を含む）
- ESLint
- Vitest
- Production build

Node.js 20 以前ではなく Node.js 22 以上を使用する。

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
- 保存競合 / 復元UI

---

## 3. Capacitor iOS 同期

Capacitor 7 の必要パッケージは repository の `package.json` / `package-lock.json` に固定済み。

通常は以下だけを実行する。

```bash
npm run cap:sync:ios
```

このスクリプトは Web build 後に `cap sync ios` を実行する。

### 重要

- `ios/` は Git 管理対象。削除して毎回作り直さない。
- `ios/App/App/public`、生成config、Pods、build成果物は `ios/.gitignore` で除外する。
- `npx cap add ios` は初期生成済みなので通常不要。
- native project を意図せず再生成すると Xcode 側設定を失う可能性があるため行わない。

同期後、意図しない native source 差分が出ていないことを確認する。

```bash
git status --short
```

---

## 4. Xcodeを開く

```bash
npm run cap:open:ios
```

Xcodeで確認する項目:

- Bundle Identifier: `com.zanshin.notes`
- Display Name: `残心`
- Version / Build Number
- Signing Team
- Deployment Target
- App Icon（残心ブランドのアイコンになっていること）
- Launch Screen（Capacitorデフォルト画像ではないこと）
- Supported Devices（初回は iPhone のみ）
- Device Orientation（初回は portrait のみ）

署名Teamなど開発者アカウント固有情報は、実機/TestFlightの前にXcodeで設定する。

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
- [ ] 保存失敗UI
- [ ] 中断保存 / 復元UI

### iOS / WKWebView重点項目

初回リリースは **iPhone / portrait only**。iPad と landscape は未検証のまま配信対象へ含めない。

- [ ] iPhone portrait の 375 / 390 / 430px 相当で Safe Area が崩れない
- [ ] キーボード表示中も入力位置が見える
- [ ] キーボード表示/非表示を繰り返してレイアウトがずれない
- [ ] 縦書き読み返しの横スクロールが自然に動く
- [ ] 日本語長文が重くない
- [ ] 英数字混じりでも破綻しない
- [ ] background → foreground 復帰後も表示内容が正しい
- [ ] 入力直後にホームへ戻っても保存される
- [ ] 長時間background後の復帰でも保存競合を誤処理しない
- [ ] force terminate → 再起動後も確定済みメモが残る
- [ ] 中断journalがある場合はユーザー選択UIが出る
- [ ] アンインストール時はローカルデータも消えることを理解している

### 見た目

- [ ] App Icon が残心ブランドになっている
- [ ] Launch Screen が残心ブランドになっている
- [ ] 紙ノイズが汚れに見えない
- [ ] 保存後の円相余韻が派手すぎない

---

## 6. TestFlight ビルド

Xcodeで以下を行う。

1. Signing Team を確認
2. Version / Build Number を確認
3. Product > Archive
4. Organizer を開く
5. Distribute App
6. App Store Connect
7. Upload
8. App Store Connect で処理完了を待つ
9. TestFlight に追加
10. 実機でTestFlight版を確認

TestFlight版ではローカルXcode実行と同じ保存・復元・Safe Area・キーボード・縦書き項目を再確認する。

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

## 9. 完了条件

- [ ] `npm ci` がクリーン環境で成功
- [ ] `npm run check` 成功
- [ ] `npm run cap:sync:ios` 成功
- [ ] sync後に予期しないnative source差分がない
- [ ] Xcode archive成功
- [ ] 実機確認完了
- [ ] TestFlight確認完了
- [ ] App Store Connect提出情報が揃っている
- [ ] スクリーンショットが揃っている
- [ ] Privacy Policy / Support URL が用意できている

これを満たしたら、初回審査へ進める。
