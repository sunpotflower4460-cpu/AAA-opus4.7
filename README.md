# 残心 / Zanshin

> 書いたあとにも、心がそこに残るメモ帳。  
> A note-taking app where the heart lingers, even after the writing ends.

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
| 多言語文言設計 | 日本語・英語を意識した言葉づかい |

---

## 技術方針

- **Vite** — 高速な開発環境
- **React + TypeScript** — 型安全なコンポーネント設計
- **Tailwind CSS** — 余白と間を制御しやすいユーティリティCSS
- **localStorage / IndexedDB** — MVPはローカル保存から
- **PWA対応** — ブラウザからでもiOS的体験を
- **Capacitor（将来）** — ネイティブiOSアプリ化への備え

---

## 開発フェーズ

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

詳細は [docs/development-phases.md](docs/development-phases.md) を参照。  
Phase 4 の最終調整レポートは [docs/final-polish-and-deploy-phase-4.md](docs/final-polish-and-deploy-phase-4.md) を参照。
Phase 6 の体験強化レポートは [docs/zanshin-experience-phase-6.md](docs/zanshin-experience-phase-6.md) を参照。
Phase 8 のUI/UX監査レポートは [docs/uiux-integrity-review-phase-8.md](docs/uiux-integrity-review-phase-8.md) を参照。
Phase 9 のタイポグラフィ・質感レポートは [docs/zanshin-typography-texture-phase-9.md](docs/zanshin-typography-texture-phase-9.md) を参照。
Phase 10 の改行・紙質感・月モチーフ改善レポートは [docs/japanese-wrap-paper-moon-phase-10.md](docs/japanese-wrap-paper-moon-phase-10.md) を参照。
Phase 11〜16 のUI/UX磨き込みと監査レポートは `docs/phase-11-*` 〜 `docs/phase-16-*` を参照。

---

## Cloudflare Pagesルール

- Phase 1ではデプロイしない
- Phase 2でもデプロイしない
- **Phase 3のMVP完成後のみ**、必要に応じてCloudflare Pagesへのデプロイ準備を行う

---

## セットアップと起動

Phase 3 でMVPを実装しました。以下のコマンドで動かせます。

```bash
# 依存関係のインストール
npm install

# 開発サーバー起動（http://localhost:5173）
npm run dev

# 本番ビルド（dist/ に出力）
npm run build

# ビルド成果物のプレビュー
npm run preview
```

要件：

- Node.js 18 以上
- npm 9 以上

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
| 日本語/英語を意識した文言設計 | ✅ |

---

## Monetization / Premium（Phase 7）

- Phase 7 では広告 SDK や StoreKit の本番実装ではなく、広告位置確認用の `AdSlot` と購入状態のモック層を追加しています。
- 現在の Premium 切り替えは `localStorage` ベースの仮実装です。**App Store 申請前に StoreKit と実際の restore 処理へ差し替えが必要です。**
- Phase 8 の監査方針として、広告はエディタや保存直後に出さず、空状態の中心も壊さない配置を維持します。
- 詳細は [docs/monetization-phase-7.md](docs/monetization-phase-7.md) と [docs/app-store-monetization-checklist.md](docs/app-store-monetization-checklist.md) を参照してください。

---

## Cloudflare Pages デプロイ方針

Phase 3 のMVP完成後、Phase 4 で最終調整を行いました。  
Cloudflare Pages 接続済みであれば、現状の `main` ブランチからそのままデプロイ可能です。  
**Phase 3 の途中ではデプロイしません。**

推奨設定：

| 項目 | 値 |
|------|----|
| Framework preset | None / Vite |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node.js version | 18 以上 |
| 環境変数 | 不要 |

ビルド成果物は静的ファイルのみで、サーバーサイドや外部APIには依存しません。  
データはユーザーの端末の `localStorage`（キー: `zanshin.notes.v1`）に保存されます。

### Cloudflare Pages の手動接続手順（未接続の場合）

1. Cloudflare ダッシュボード → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
2. このリポジトリを選択し、ブランチを `main` に設定
3. ビルド設定で上表の値を入力
4. **Save and Deploy** を押下
5. 発行された `*.pages.dev` ドメインで動作確認

> SPA ルーティング（react-router 等）を使っていないため、`_redirects` 等の追加設定は不要です。

---

## ドキュメント

| ファイル | 内容 |
|----------|------|
| [docs/concept.md](docs/concept.md) | 「残心」の思想と世界観 |
| [docs/design-system.md](docs/design-system.md) | UI/UXとデザインシステム |
| [docs/mvp-spec.md](docs/mvp-spec.md) | MVP仕様 |
| [docs/development-phases.md](docs/development-phases.md) | 開発フェーズ |
| [docs/final-polish-and-deploy-phase-4.md](docs/final-polish-and-deploy-phase-4.md) | Phase 4 最終調整・デプロイ報告 |
| [docs/zanshin-experience-phase-6.md](docs/zanshin-experience-phase-6.md) | Phase 6 残心体験強化レポート |
| [docs/monetization-phase-7.md](docs/monetization-phase-7.md) | Phase 7 の広告 / Premium 設計 |
| [docs/uiux-integrity-review-phase-8.md](docs/uiux-integrity-review-phase-8.md) | Phase 8 UI/UX監査レポート |
| [docs/app-store-monetization-checklist.md](docs/app-store-monetization-checklist.md) | App Store monetization 申請チェックリスト |
| [docs/japanese-wrap-paper-moon-phase-10.md](docs/japanese-wrap-paper-moon-phase-10.md) | Phase 10 日本語改行・紙質感・月モチーフ改善レポート |
| [docs/phase-16-uiux-integrity-polish-report.md](docs/phase-16-uiux-integrity-polish-report.md) | Phase 16 総合UI/UX監査・過剰演出削ぎ落としレポート |
| [.github/copilot-instructions.md](.github/copilot-instructions.md) | Cloud Agent / Copilot向け作業ルール |
