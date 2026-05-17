# 残心 / Zanshin

> 書いたあとにも、心がそこに残るメモ帳。  
> A note-taking app where the heart lingers, even after the writing ends.

---

## アプリ概要

「残心」は、和の美意識・間・余白・静けさを大切にした、シンプルなiOS向けメモアプリです。

大量の機能で埋めるのではなく、  
書くこと、読み返すこと、書いたあとに残る余韻を美しくすることを目指します。

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
| メモ一覧 | 書いたメモを静かに並べる |
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

詳細は [docs/development-phases.md](docs/development-phases.md) を参照。

---

## Cloudflare Pagesルール

- Phase 1ではデプロイしない
- Phase 2でもデプロイしない
- **Phase 3のMVP完成後のみ**、必要に応じてCloudflare Pagesへのデプロイ準備を行う

---

## ドキュメント

| ファイル | 内容 |
|----------|------|
| [docs/concept.md](docs/concept.md) | 「残心」の思想と世界観 |
| [docs/design-system.md](docs/design-system.md) | UI/UXとデザインシステム |
| [docs/mvp-spec.md](docs/mvp-spec.md) | MVP仕様 |
| [docs/development-phases.md](docs/development-phases.md) | 開発フェーズ |
| [.github/copilot-instructions.md](.github/copilot-instructions.md) | Cloud Agent / Copilot向け作業ルール |