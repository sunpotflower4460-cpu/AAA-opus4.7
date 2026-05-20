# 残心 — 開発フェーズ / Development Phases

## フェーズ全体像

| フェーズ | 内容 | Cloudflareデプロイ |
|----------|------|-------------------|
| Phase 1 | 設計整理 | しない |
| Phase 2 | 監査 | しない |
| Phase 3 | MVP実装 | MVP完成後のみ |
| Phase 4 | UI/UXおまかせアレンジ | しない |
| Phase 5 | デバッグ・最終調整 | しない |
| Phase 6 | 残心体験の徹底強化・UI/UX再設計 | しない |
| Phase 7 | App Store向け広告・Premium枠組み | しない |
| Phase 8 | UI/UX総合監査・残心品質ブラッシュアップ | しない |
| Phase 9〜16 | UI/UX磨き込み | しない |
| Phase 17 | 最終デバッグ・Cloudflare Pages公開準備 | 接続済みの場合のみ |
| Phase 18 | App Store申請準備・Privacy/ATT整理 | しない |

---

## Phase 1: 設計整理

**ステータス：** 🟢 実施中

### 目的

- README/docsを整える
- コンセプトを固定する
- UI/UX方針を固定する
- MVP範囲を固定する
- Cloud Agent向けの作業ルールを明文化する

### 成果物

```
README.md
docs/concept.md
docs/design-system.md
docs/mvp-spec.md
docs/development-phases.md
.github/copilot-instructions.md
```

### Cloudflareデプロイ

**しない**

### 完了条件

- [ ] README.md が作成/更新されている
- [ ] docs/concept.md がある
- [ ] docs/design-system.md がある
- [ ] docs/mvp-spec.md がある
- [ ] docs/development-phases.md がある
- [ ] .github/copilot-instructions.md がある
- [ ] Cloudflareへデプロイしていない
- [ ] MVP実装を開始していない
- [ ] 「残心」「間」「余白」「現代和」「黄金比」の方針が明記されている

---

## Phase 2: 監査

**ステータス：** ⬜ 未着手

### 目的

- Phase 1の設計にズレがないか確認する
- MVP実装前の懸念点を洗い出す
- 実装に入る前に設計を微修正する

### 作成予定

```
docs/audit-phase-2.md
```

### 内容例

- コンセプトと仕様に矛盾がないか
- デザインシステムがMVP仕様に対応できるか
- 技術スタックの選定に問題がないか
- ファイル構成の初期案を確認する

### Cloudflareデプロイ

**しない**

---

## Phase 3: MVP実装

**ステータス：** ⬜ 未着手

### 目的

- 動くMVPを作る
- iPhoneで使えるUIにする
- ローカル保存つきメモ帳として成立させる

### 実装予定

```
Vite + React + TypeScript + Tailwind CSS
```

| 機能 | 概要 |
|------|------|
| メモ一覧 | Notes List 画面 |
| メモ作成 | Editor 画面（新規） |
| メモ編集 | Editor 画面（既存） |
| メモ削除 | 確認ダイアログ付き |
| 自動保存 | デバウンス処理 |
| 検索 | リアルタイム検索 |
| お気に入り | トグル・フィルタ |
| localStorage保存 | `lib/storage.ts` に分離 |
| iPhone向けレスポンシブUI | safe-area / viewport 対応 |

### 想定ファイル構成（参考）

```
src/
  components/
    NoteCard.tsx
    NoteList.tsx
    Editor.tsx
    SearchBar.tsx
    FavoriteButton.tsx
    EmptyState.tsx
  lib/
    storage.ts
    utils.ts
  types/
    note.ts
  App.tsx
  main.tsx
  index.css
```

### Cloudflareデプロイ

**MVP完成後のみ**

---

## Phase 6: 残心体験の徹底強化・UI/UX再設計

**ステータス：** 🟢 実施

### 目的

- 「何が残心なのか」が説明なしでも伝わる状態に近づける
- 書いた直後の保存体験を、機械的な処理ではなく余韻として感じられるようにする
- メモ一覧を単なるリストではなく、過去に残した心の気配が並ぶ場として磨き直す

### 成果物

```
docs/zanshin-experience-phase-6.md
```

### 完了条件

- ホーム画面で残心の意味が短く伝わる
- 空状態が最初の入口として機能する
- 保存表示が「余韻を保存しました / Saved in stillness」になる
- メモカードが余韻の断片として感じられる
- iPhone幅で崩れず、既存MVP機能を壊していない

---

## Phase 7: App Store向け広告・Premium枠組み

**ステータス：** 🟢 実施

### 目的

- 広告枠とPremium導線を、残心の静けさを壊さない配置で追加する
- 購入復元導線を用意し、App Store申請準備を進める
- SDK/StoreKit本実装前の検証用モックレイヤーを整える

### 成果物

```
docs/monetization-phase-7.md
docs/app-store-monetization-checklist.md
```

### 完了条件

- エディタに広告を出さない
- 保存直後に広告を出さない
- Premium時に広告を非表示にできる
- 購入復元導線が存在する
- モック実装であることをdocsに明記する

### Cloudflareデプロイ

**しない**

---

## Phase 8: UI/UX総合監査・残心品質ブラッシュアップ

**ステータス：** 🟢 実施

### 目的

- 広告・Premium導線追加後も「書く体験の静けさ」が維持されているかを総合監査する
- 上部の課金圧や広告ノイズを抑え、iPhone中心の可読性と余白を調整する
- 機能追加ではなく、残心らしくない要素の削減と整形を行う

### 成果物

```
docs/uiux-integrity-review-phase-8.md
```

### 完了条件

- エディタ画面で広告とPremium導線を表示しない
- 保存直後に広告を表示しない
- 空状態の中心を広告/課金導線で壊さない
- Premium導線が煽りすぎない
- iPhone幅で崩れない
- build成功を確認する
- Cloudflare Pagesへはデプロイしない

### Cloudflareデプロイ

**しない**

---

## Phase 17: 最終デバッグ・Cloudflare Pages公開準備

**ステータス：** 🟢 実施

### 目的

- Phase 11〜16で整えたUI/UXを含め、アプリ全体を最終確認する
- Cloudflare Pages 公開前提の build / 表示 / Premium mock 状態を整理する
- App Store 申請前に残る課題を明確にする

### 成果物

```
docs/phase-17-final-debug-and-deploy-report.md
```

### 完了条件

- build成功を確認する
- メモ作成 / 編集 / 削除 / 保存 / 検索 / お気に入りを再確認する
- Premium mock と広告配置を再確認する
- Cloudflare Pages 接続時の設定と確認項目を整理する

### Cloudflareデプロイ

**接続済みの場合のみ**

---

## Phase 18: App Store申請準備

**ステータス：** 🟢 実施

### 目的

- App Store 申請前に必要な情報を docs として整理する
- StoreKit 本番化、広告 SDK、App Privacy、ATT の責任範囲を明確にする
- mock Premium を本番扱いしない前提を固定する

### 成果物

```
docs/app-store-preparation-phase-18.md
docs/app-store-submission-checklist.md
docs/app-store-metadata-draft.md
docs/privacy-and-tracking-notes.md
docs/storekit-production-plan.md
docs/ios-wrapper-plan.md
docs/app-review-risk-notes.md
```

### 完了条件

- App Store申請準備docsが作成されている
- StoreKit本番化計画がある
- 広告SDK / App Privacy / ATT の注意が整理されている
- Metadata草案とスクリーンショット方針がある
- 審査リスクが整理されている
- mock Premium を本番扱いしていない

### Cloudflareデプロイ

**しない**

---

## 将来 Phase 候補

| フェーズ | 内容 |
|----------|------|
| Phase 19 | iOSラッパー / Capacitor導入 |
| Phase 20 | StoreKit / 広告SDK 本番実装 |
| Phase 21 | TestFlight / App Store Connect 最終提出準備 |

---

## 重要なルール（全フェーズ共通）

1. 「間」「余白」「残心」の思想をUIに込め続ける
2. 機能追加よりも体験の質を優先する
3. Phase 3完了前にCloudflareへデプロイしない
4. 新機能追加は、既存の静けさを壊さないか確認してから行う
