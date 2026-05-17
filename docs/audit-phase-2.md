# 残心 / Zanshin Phase 2 Audit

## 監査日

2026-05-17

## 監査対象

- README.md
- docs/concept.md
- docs/design-system.md
- docs/mvp-spec.md
- docs/development-phases.md
- .github/copilot-instructions.md

すべて存在することを確認した。Phase 1の成果物に欠落はない。

---

## 1. コンセプト監査

判定: **OK**

確認内容:

- アプリ名は「残心 / Zanshin」になっている（README.md L1, docs/concept.md L1）
- 一言コンセプト「書いたあとにも、心がそこに残るメモ帳」が README.md L3 に明記されている
- 単なる和風メモ帳ではなく、「書く体験の余韻」を中心に据えていることが docs/concept.md の「中核思想」「3つのキーワード」で表現されている
- 「残心」「間」「余白」が3つのキーワードとしてUI/UXの中核に据えられている（docs/concept.md L34-55）
- 「このアプリが大切にしないもの／するもの」で、機能追加より静かに書く体験を優先する姿勢が示されている（docs/concept.md L83-99）

修正した内容:

- なし（既存記述が十分なため修正不要）

---

## 2. デザイン監査

判定: **OK（軽微な補強済み）**

確認内容:

- 和風要素は「装飾ではなく意味として使う」と明記されている（docs/concept.md L78-79, docs/design-system.md「モチーフの使い方」）
- 刀・扇・墨・和紙・金箔・円相・藍・朱がそれぞれ意味と用途付きで整理されている（docs/concept.md L60-71, docs/design-system.md L87-119）
- 「海外にも伝わる静かな現代和」「古典的な和風アプリではない」と方針が明示されている（docs/concept.md L73-79）
- 黄金比スケール `4 / 8 / 13 / 21 / 34 / 55 / 89` が明記されている（docs/design-system.md L17-23）
- 画面左右余白21px、カードpadding 21px、セクション間隔34px、FAB 55px など、具体的数値方針が定義されている（docs/design-system.md L27-34）
- カラーパレット（Washi / Sumi / Gold / Indigo / Vermilion 等）が定義されている（docs/design-system.md L38-49）
- アニメーション方針（200ms以下は使わない、300–400ms推奨など）が定義されている（docs/design-system.md L138-145）
- ただし、iPhone前提の具体方針（safe-area、キーボード表示時、タップ領域44pt等）が薄かったため補強した

修正した内容:

- `docs/design-system.md` に「iPhone前提の方針」セクションを追加
  - 基準幅 iPhone（375–430px）、左右余白21px最低確保
  - Safe Area（ノッチ／ホームインジケーター）と `env(safe-area-inset-*)` の利用
  - タップ領域 44×44px 最低確保（Apple HIG準拠）、FAB 55px
  - キーボード表示時の `100dvh` / `100svh` 対応、自動保存ステータスがキーボードに被らない配慮
  - Capacitor / iOS化への配慮（WebView上で破綻しないシンプル構成、ハードウェア依存APIをMVPで使わない）

---

## 3. MVP範囲監査

判定: **OK**

確認内容:

- MVP必須機能（一覧／作成／編集／削除／自動保存／検索／お気に入り／ローカル保存／iPhoneレスポンシブ／日英文言）が README.md と docs/mvp-spec.md の両方で一致している
- MVPでやらないこと（ログイン／クラウド同期／AI機能／課金／Markdown完全対応／複雑なタグ管理／共同編集／App Store申請／Cloudflareへの途中デプロイ）が docs/mvp-spec.md L115-129 に明示されている
- データ構造が `Note` 型としてシンプルに定義されており、Phase 3で一気に作れる粒度（docs/mvp-spec.md L83-95）
- 保存方針が `localStorage` から開始し、`lib/storage.ts` に分離して IndexedDB へ移行可能にすることが明記されている（docs/mvp-spec.md L99-111）
- 将来のCapacitor化を邪魔しない設計方針が docs/development-phases.md L114-131 のファイル構成例で意識されている
- MVPが肥大化していない。検索仕様もMVPでは厳密一致に絞り、削除はUndoなしと過剰仕様を避けている

修正した内容:

- なし

---

## 4. 開発フェーズ監査

判定: **OK**

確認内容:

- Phase 1: 設計整理（実装しない）が明記されている（docs/development-phases.md L14-52）
- Phase 2: 監査のみ（Cloudflareデプロイなし）が明記されている（docs/development-phases.md L55-81）
- Phase 3: MVP実装、Cloudflareデプロイは「MVP完成後のみ」と明記されている（docs/development-phases.md L84-135）
- Phase 4以降（多言語切替／縦書き／集中モード／同期／Capacitor／App Store）が「将来Phase候補」として MVP と分離されている（docs/development-phases.md L139-147）
- 全フェーズ共通ルールとして「Phase 3完了前にCloudflareへデプロイしない」が明記されている（docs/development-phases.md L152-157）

修正した内容:

- なし

---

## 5. Cloud Agent指示監査

判定: **OK（明示的な禁止リストを補強済み）**

確認内容:

- プロジェクトの目的（calm, Japanese-inspired iOS-first note-taking app、機能盛り盛りにしない）が冒頭に明記されている
- Core Principles で「Keep the MVP small」「Avoid unnecessary features」「Make the app beautiful on iPhone」「Protect stillness」「Respect whitespace」が明示されている
- Phase 1 / Phase 2 / Phase 3 の作業範囲が "Phase Rules" セクションで明確に分離されている
- Cloudflareデプロイ禁止ルールが Phase 1・Phase 2 で明示、Phase 3 は「MVP完成後のみ」と明示
- 実装時の技術方針（React + TypeScript + Vite + Tailwind、`lib/storage.ts` 分離、localStorageから開始、不要なライブラリを足さない）が "Coding Direction" にまとめられている
- ただし「AI機能・ログイン・同期・課金を勝手に追加しない」という禁止項目が、暗黙的にしか書かれていなかった。AI Agentが解釈で揺れないよう、明示的な禁止リストを追加した

修正した内容:

- `.github/copilot-instructions.md` に "Hard Prohibitions (Do NOT add without explicit user request)" セクションを追加
  - AI機能 / ログイン・認証 / クラウド同期・バックエンド / 課金 / 解析・トラッキング / プッシュ通知 / ソーシャル機能 / Markdown完全対応 / 複雑なタグ管理 / MVP完成前のCloudflareデプロイ
  - 必要だと感じたら「黙って追加せず、まずユーザーに確認する」と明記

---

## 追加確認

### A. 海外向け表現

OK。README.md に "Japanese minimalism / Zen / Wabi-sabi / Samurai-inspired calm focus / Mindful writing / Calm journaling" が、docs/mvp-spec.md の自動保存文言に "Saved in stillness" が含まれている。英語表現は必要箇所に限定されており、日本語アプリとしての芯は薄まっていない。

### B. iOS前提

OK（今回の修正で完全に明文化）。

- iPhone幅で美しく見える（基準幅375–430px、左右余白21px最低確保）
- タップしやすいボタンサイズ（44×44px最低、FAB 55px）
- キーボード表示時も使いやすい（`100dvh`/`100svh`対応、ステータスがキーボードに被らない）
- PWA / Capacitor化を想定（README.md / docs/design-system.md / docs/development-phases.md）
- MVPはWebアプリ、将来iOSアプリ化（README.md / docs/development-phases.md Phase 8）

### C. 「残心らしさ」の最終確認

> この設計は、ただのメモ帳ではなく「残心」と呼べるか？

**呼べる。**

- 書く体験は静か（プレースホルダー「題、あるいは無題。」「ここに言葉を置いてください。」）
- 保存体験は静か（「余韻を保存しました / Saved in stillness」、派手にしない方針）
- 読み返しに余韻がある（更新時刻、お気に入りのゴールド、将来の読み返し専用モード構造を意識）
- UIに間がある（黄金比スケール、画面左右21px、セクション間隔34px）
- 和の要素は意味として入っている（刀＝削る、扇＝ひらく、円相＝余韻、など）
- 機能は画面を騒がせていない（MVPでは Markdown完全対応・タグ・同期を排除）

---

## 6. Phase 3 実装前の最終方針

Phase 3では以下を守ること。

- **Vite + React + TypeScript + Tailwind CSS** で MVP を作る
- **localStorage** 保存から開始する。保存処理は `lib/storage.ts` に分離する
- **メモ一覧、作成、編集、削除、自動保存、検索、お気に入り** を実装する
- **iPhone-first** で設計する（基準幅 375–430px、safe-area対応、タップ領域44px最低）
- **余白と行間** を大切にする（黄金比スケール `4 / 8 / 13 / 21 / 34 / 55 / 89`）
- **機能を増やしすぎない**（"Hard Prohibitions" を遵守）
- Cloudflare Pages へのデプロイは **MVP完成後のみ** 行う

---

## 7. MVPでまだ作らないもの

- ログイン
- クラウド同期
- AI機能
- 課金
- Markdown完全対応
- 複雑なタグ管理
- 共同編集
- App Store申請
- 解析・トラッキング・プッシュ通知（追加分）

---

## 8. 総合判定

```txt
Phase 3に進んでよい
```

理由:

- Phase 1の設計ドキュメント6本がすべて揃っており、コンセプト・デザイン・MVP範囲・フェーズ・Agent指示が一貫している
- 軽微なギャップ（iPhone前提の具体方針、AI Agentの暗黙的な禁止）は本Phase 2で補強済み
- MVP範囲は肥大しておらず、Phase 3で一気に作れる粒度に保たれている
- Cloudflareデプロイは Phase 3 MVP完成後のみという方針が複数ファイルで一致している
- 「残心らしさ」の6つの問いすべてに対して、設計はYesと答えられる

Phase 2はここで完了とし、次は Phase 3（MVP実装）に進んでよい。
