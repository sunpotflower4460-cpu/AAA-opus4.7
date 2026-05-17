# 残心 — 開発フェーズ / Development Phases

## フェーズ全体像

| フェーズ | 内容 | Cloudflareデプロイ |
|----------|------|-------------------|
| Phase 1 | 設計整理 | しない |
| Phase 2 | 監査 | しない |
| Phase 3 | MVP実装 | MVP完成後のみ |
| Phase 4〜 | 将来拡張 | 別途検討 |

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

## 将来 Phase 候補

| フェーズ | 内容 |
|----------|------|
| Phase 4 | 多言語切り替え（ja / en） |
| Phase 5 | 縦書きモード |
| Phase 6 | 集中モード（UI最小化） |
| Phase 7 | iCloud / Supabase同期 |
| Phase 8 | CapacitorでiOS化 |
| Phase 9 | App Store準備 |

---

## 重要なルール（全フェーズ共通）

1. 「間」「余白」「残心」の思想をUIに込め続ける
2. 機能追加よりも体験の質を優先する
3. Phase 3完了前にCloudflareへデプロイしない
4. 新機能追加は、既存の静けさを壊さないか確認してから行う
