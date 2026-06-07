# Phase 27 Washi / Search Fix Report

## 目的

ユーザー提供スクリーンショットを踏まえ、以下を修正しました。

- 背景の和紙感をもう少し自然に上げる
- 紙面・検索欄の虹色感をさらに抑える
- 検索バー右端の途切れ・はみ出しを止める

---

## 実装方針

前段の複数CSSレイヤーに、直線・色付きグラデーション・疑似要素が残っていたため、Phase 27を最後に読み込む最終補正レイヤーとして追加しました。

### 1. 背景

- 直線・格子は使わない
- 左上主光源のみ
- 雲状のradial-gradient
- 無彩色feTurbulenceノイズ
- `filter: saturate(0) grayscale(1)` を背景ノイズに適用

### 2. 紙面

対象:

- `.paper-card`
- `.editor-paper`
- `.paper-surface`
- `.zanshin-note-card`
- `.zanshin-paper-slip`
- `.read-mode-paper`

上記の背景を、茶系グラデーション + 無彩色SVGノイズだけに再定義しました。

### 3. 検索バー

`.zanshin-search-bar` は特に強く補正しました。

- `overflow: hidden`
- `clip-path: inset(0 round 9999px)`
- `contain: paint`
- `isolation: isolate`
- `::after` は完全に無効化
- `::before` のみを角丸内に収める

これにより、右端のテクスチャ見切れや白いループ状のはみ出しを抑えます。

---

## 変更ファイル

- `src/phase27.css`
- `src/main.tsx`
- `docs/phase-27-washi-search-fix-report.md`

---

## 確認ポイント

- 背景に和紙の雲状ムラが少し増えている
- 虹色のムラが目立たない
- 検索バー右端に白いループやはみ出しが出ない
- 文字の可読性が落ちていない
- 円相の点の動きは前回のまま維持されている

---

## 判断基準

> 和紙の気配は増やすが、UI部品が色づいたり、検索欄から何かがはみ出したりしないこと。
