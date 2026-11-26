# 残心 / Zanshin

> 書いたあとにも、心がそこに残るメモ帳。  
> A note-taking app where the heart lingers, even after the writing ends.

## 現在の作業入口（2026-11-26）

Phase 42までのWebアプリ・Capacitor iOS・端末内の保存保護が実装されています。現在は、ストア公開前の見やすさ・書きやすさ・保存の信頼性を仕上げる段階です。

**[ストア公開前の設計・実装指示書](docs/store-release-polish/README.md)** に、2回のレビュー全37項目、採用する画面仕様、実装順、受入条件、監査原文を統合しています。実装担当へは [キックオフプロンプト](docs/store-release-polish/KICKOFF.md) を渡してください。

文書を収録した段階で、37項目のアプリ改修・実機確認が完了したわけではありません。進捗は [ACCEPTANCE.md](docs/store-release-polish/ACCEPTANCE.md) で区別して記録します。

初版の方針は **iPhone / portrait、日本語UI、無料・広告なし・Premiumなし・アカウントなし・クラウド同期なし** です。古いPhase文書は当時の記録として参照し、初版の実装に課金・広告を追加しないでください。

---

## アプリ概要

「残心」は、和の美意識・間・余白・静けさを大切にした、シンプルなiOS向けメモアプリです。

大量の機能で埋めるのではなく、  
書くこと、読み返すこと、書いたあとに残る余韻を美しくすることを目指します。

- 詩的コピーは自動折り返し任せにせず、行ごとに静かに組む
- 背景は白いUIではなく、古い紙・和紙の気配を多層で整える
- 円モチーフは記号ではなく、月のような静かな情緒として扱う

残心とは、  
**書き終えたあとにも、言葉と心の気配が静かに残っていること。**  
このアプリは、その感覚を説明ではなく、ホーム・保存・読み返しの体験で伝えるために設計されています。

---

## ターゲット

**日本向け**

- シンプルで美しいメモ帳が欲しい人
- 和のデザインが好きな人
- 日記、詩、創作メモ、アイデアメモを書く人
- 静かで落ち着いたUIを好む人

**海外向け**

- Japanese minimalism / Zen / Wabi-sabi
- Samurai-inspired calm focus
- Mindful writing / Calm journaling

---

## MVP機能

| 機能 | 説明 |
|------|------|
| メモ一覧 | 最後の余韻が静かに並ぶ |
| メモ作成 | 新しい言葉を置く |
| メモ編集 | 言葉を直す |
| メモ削除 | 言葉を手放す |
| 自動保存 | 静かに、気配なく保存する |
| 検索 | 過去の言葉を手繰り寄せる |
| お気に入り | 大切な言葉を残す |
| ローカル保存 | まずはデバイスの中に |
| iPhone向けUI | 手のひらに収まる静けさ |
| 文言設計 | 日本語UI。英語の補助文はあるが、英語UI切替は未実装 |

---

## 技術方針

- **Vite** — 高速な開発環境
- **React + TypeScript** — 型安全なコンポーネント設計
- **Tailwind CSS** — 余白と間を制御しやすいユーティリティCSS
- **localStorage** — 本体、復旧コピー、中断保存journal、競合保護
- **Capacitor Filesystem** — iOS端末内の複数世代の予備保存。クラウドバックアップではない
- **Web / WKWebView** — ブラウザ確認とネイティブ実機確認を分ける
- **Capacitor 7** — iOSプロジェクトは導入済み・Git管理対象。通常作業で再生成しない

---

## 開発フェーズ

以下は初期フェーズの履歴です。現在の作業は [W0〜W5の実装指示](docs/store-release-polish/IMPLEMENTATION.md) と [Phase 42報告](docs/phase-42-native-startup-divergence-report.md) を参照してください。

| フェーズ | 内容 | Cloudflareデプロイ |
|----------|------|-------------------|
| **Phase 1** | README/docsに設計を入れる | しない |
| **Phase 2** | 監査フェーズ（設計確認・微修正） | しない |
| **Phase 3** | MVPまで一気に作る | MVP完成後のみ |
| **Phase 4** | UI/UXアレンジと静かな磨き込み | しない |
| **Phase 5** | デバッグ・最終調整 | しない |
| **Phase 6** | 残心体験の徹底強化・UI/UX再設計 | しない |
| **Phase 7** | App Store向け広告・Premium枠組み | しない |
| **Phase 8** | UI/UX総合監査・残心品質ブラッシュアップ | しない |
| **Phase 9** | タイポグラフィ・紙感・書字体験の磨き込み | しない |
| **Phase 10** | 日本語改行品質・紙質感・月モチーフ改善 | しない |
| **Phase 17** | 最終デバッグ・Cloudflare Pages公開準備 | 接続済みの場合のみ |
| **Phase 18** | App Store申請準備・Privacy/ATT整理 | しない |

詳細は [docs/development-phases.md](docs/development-phases.md) を参照。  
Phase 4 の最終調整レポートは [docs/final-polish-and-deploy-phase-4.md](docs/final-polish-and-deploy-phase-4.md) を参照。
Phase 6 の体験強化レポートは [docs/zanshin-experience-phase-6.md](docs/zanshin-experience-phase-6.md) を参照。
Phase 8 のUI/UX監査レポートは [docs/uiux-integrity-review-phase-8.md](docs/uiux-integrity-review-phase-8.md) を参照。
Phase 9 のタイポグラフィ・質感レポートは [docs/zanshin-typography-texture-phase-9.md](docs/zanshin-typography-texture-phase-9.md) を参照。
Phase 10 の改行・紙質感・月モチーフ改善レポートは [docs/japanese-wrap-paper-moon-phase-10.md](docs/japanese-wrap-paper-moon-phase-10.md) を参照。
Phase 11〜16 のUI/UX磨き込みと監査レポートは `docs/phase-11-*` 〜 `docs/phase-16-*` を参照。
Phase 17 の最終デバッグ・公開準備レポートは [docs/phase-17-final-debug-and-deploy-report.md](docs/phase-17-final-debug-and-deploy-report.md) を参照。
Phase 18 の App Store 申請準備レポートは [docs/app-store-preparation-phase-18.md](docs/app-store-preparation-phase-18.md) を参照。

---

## Cloudflare Pagesルール

- Phase 1ではデプロイしない
- Phase 2でもデプロイしない
- **Phase 3のMVP完成後のみ**、必要に応じてCloudflare Pagesへのデプロイ準備を行う

---

## セットアップと起動

Phase 3 でMVPを実装しました。以下のコマンドで動かせます。

```bash
# ロックファイルどおりの依存関係をインストール
npm ci

# 開発サーバー起動（http://localhost:5173）
npm run dev

# 本番ビルド（dist/ に出力）
npm run build

# 型検査・lint・テスト・ビルド
npm run check

# ビルド成果物のプレビュー
npm run preview
```

要件：

- Node.js 22 以上（package.json / CIの要件に合わせる）
- npm 9 以上

監査環境ではCloudflare Vite pluginの `uv_interface_addresses` エラーにより標準のテスト起動ができませんでした。一時設定でのテスト成功と、元の `npm run check` 成功は別に記録します。詳細は [検証範囲](docs/store-release-polish/README.md#進捗と証拠) を参照してください。

---

## MVP 実装機能

| 機能 | 状態 |
|------|------|
| メモ一覧（お気に入り優先・更新日時降順） | ✅ |
| メモ作成 | ✅ |
| メモ編集（タイトル / 本文） | ✅ |
| メモ削除（確認ダイアログ付き） | ✅ |
| 自動保存（debounce） | ✅ |
| 検索（タイトル + 本文） | ✅ |
| お気に入り切り替え | ✅ |
| localStorage 永続化 | ✅ |
| iPhone 向けレスポンシブ UI（safe-area 対応） | ✅ |
| 日本語UI・英語補助文の定義 | ✅（英語UI切替は未実装） |

---

## 広告・Premium（初版は無効）

- Phase 7 では広告 SDK や StoreKit の本番実装ではなく、広告位置確認用の `AdSlot` と購入状態のモック層を追加しています。
- 現在は [featureFlags.ts](src/lib/featureFlags.ts) の `APP_STORE_INITIAL_RELEASE=true`、`ADS_ENABLED=false`、`PREMIUM_ENABLED=false` により、初版の広告・課金導線を無効化しています。
- **初版公開のためにStoreKitや広告SDKを導入する必要はありません。** 公開ビルドにモックの購入・復元操作が出ないことを確認します。
- [Phase 7の設計](docs/monetization-phase-7.md) と [monetization checklist](docs/app-store-monetization-checklist.md) は、将来その機能を明示的に採用した時の参考資料です。

---

## Web公開の扱い

現在の開発設定はCloudflare Vite pluginを使い、`npm run deploy` は `wrangler deploy` を呼びます。以下のPages接続手順は過去の案内です。現実の接続先や公開URLを確認せず、新しい公開先を作ったり既存サイトを上書きしたりしないでください。

ストア品質改善の実装作業にWeb公開は含めません。公開を依頼された時は、その時点の `vite.config.ts` / `wrangler.jsonc` と指定された公開先に合わせて進めます。

過去のPages用設定例：

| 項目 | 値 |
|------|----|
| Framework preset | None / Vite |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node.js version | 22 以上 |
| 環境変数 | 不要 |

メモ本体は端末の `localStorage`（キー: `zanshin.notes.v1`）に保存され、iOSでは端末内ファイルの予備保存も使用します。Web公開先の運用と、アプリ内のメモ保存を混同しないでください。

### Cloudflare Pages の手動接続手順（未接続の場合）

1. Cloudflare ダッシュボード → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
2. このリポジトリを選択し、ブランチを `main` に設定
3. ビルド設定で上表の値を入力
4. **Save and Deploy** を押下
5. 発行された `*.pages.dev` ドメインで動作確認

> SPA ルーティング（react-router 等）を使っていないため、`_redirects` 等の追加設定は不要です。

### Phase 17 時点の公開状況

- この作業時点では **Cloudflare Pages 未接続前提** として、接続手順と設定のみを維持しています。
- 公開時は `npm run build` 成功後に Pages を実行してください。
- Phase 17当時はPremium mockも確認対象でした。初版の現在の確認では、広告・Premium・モック購入が利用者へ表示されないことを確認します。

---

## App Store申請前 TODO

- [全37項目の受入条件](docs/store-release-polish/ACCEPTANCE.md) に沿い、対応状況と証拠を記録する
- 保存・復旧・縦書き・キーボード・文字拡大・VoiceOverを、最終ビルドで確認する
- アプリ内のプライバシー・サポート導線、実在する公開URLと問い合わせ窓口を揃える
- 日本語UIと対応言語の申告、Capacitor使用とSDK説明を一致させる
- 広告・Premium・モック課金が初版に表示されないことを確認する
- 使用Xcode/SDK、Archive、TestFlightの実機結果を記録する

提出の入口は [App Store Submission Checklist](docs/app-store-submission-checklist.md) です。署名、アップロード、審査提出、配信開始は、その時点の利用者の依頼に従います。

---

## ドキュメント

| ファイル | 内容 |
|----------|------|
| [docs/store-release-polish/README.md](docs/store-release-polish/README.md) | 現在の設計・実装指示・R01〜R37の受入条件への入口 |
| [docs/store-release-polish/KICKOFF.md](docs/store-release-polish/KICKOFF.md) | 実装担当へ渡すキックオフプロンプト |
| [docs/concept.md](docs/concept.md) | 「残心」の思想と世界観 |
| [docs/design-system.md](docs/design-system.md) | UI/UXとデザインシステム |
| [docs/mvp-spec.md](docs/mvp-spec.md) | MVP仕様 |
| [docs/development-phases.md](docs/development-phases.md) | 開発フェーズ |
| [docs/final-polish-and-deploy-phase-4.md](docs/final-polish-and-deploy-phase-4.md) | Phase 4 最終調整・デプロイ報告 |
| [docs/zanshin-experience-phase-6.md](docs/zanshin-experience-phase-6.md) | Phase 6 残心体験強化レポート |
| [docs/monetization-phase-7.md](docs/monetization-phase-7.md) | Phase 7 の広告 / Premium 設計 |
| [docs/uiux-integrity-review-phase-8.md](docs/uiux-integrity-review-phase-8.md) | Phase 8 UI/UX監査レポート |
| [docs/app-store-monetization-checklist.md](docs/app-store-monetization-checklist.md) | App Store monetization 申請チェックリスト |
| [docs/app-store-preparation-phase-18.md](docs/app-store-preparation-phase-18.md) | Phase 18 App Store 申請準備レポート |
| [docs/app-store-submission-checklist.md](docs/app-store-submission-checklist.md) | App Store 提出全体チェックリスト |
| [docs/app-store-metadata-draft.md](docs/app-store-metadata-draft.md) | App Store Connect 用メタデータ草案 |
| [docs/privacy-and-tracking-notes.md](docs/privacy-and-tracking-notes.md) | App Privacy / ATT / SDK確認メモ |
| [docs/storekit-production-plan.md](docs/storekit-production-plan.md) | StoreKit 本番化計画 |
| [docs/ios-wrapper-plan.md](docs/ios-wrapper-plan.md) | iOS ラッパー導入計画 |
| [docs/app-review-risk-notes.md](docs/app-review-risk-notes.md) | App Review の事前リスク整理 |
| [docs/japanese-wrap-paper-moon-phase-10.md](docs/japanese-wrap-paper-moon-phase-10.md) | Phase 10 日本語改行・紙質感・月モチーフ改善レポート |
| [docs/phase-16-uiux-integrity-polish-report.md](docs/phase-16-uiux-integrity-polish-report.md) | Phase 16 総合UI/UX監査・過剰演出削ぎ落としレポート |
| [docs/phase-17-final-debug-and-deploy-report.md](docs/phase-17-final-debug-and-deploy-report.md) | Phase 17 最終デバッグ・Cloudflare Pages公開準備レポート |
| [.github/copilot-instructions.md](.github/copilot-instructions.md) | Cloud Agent / Copilot向け作業ルール |
