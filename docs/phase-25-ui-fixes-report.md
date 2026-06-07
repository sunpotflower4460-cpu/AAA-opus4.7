# Phase 25 UI Fixes Report

## 目的

ユーザー指摘に基づき、残心 / Zanshin のUIを3点修正しました。

1. カードと検索バーの虹色のムラを除去
2. 検索バー右端のテクスチャ見切れを修正
3. 円相ロゴの金点を円周上でゆっくり回転

---

## 1. 虹色のムラ除去

`src/phase25.css` で、紙面系コンポーネントの疑似要素へ以下を適用しました。

- `mix-blend-mode: multiply`
- `filter: saturate(0) grayscale(1)`
- 低不透明度の `feTurbulence` ノイズ

対象:

- `.paper-card`
- `.editor-paper`
- `.paper-surface`
- `.zanshin-note-card`
- `.zanshin-search-bar`
- `.read-mode-paper`
- `.zanshin-paper-slip`

背景側の `body::after` にも同じくグレースケール化の保険を追加しました。

---

## 2. 検索バー右端の見切れ修正

`.zanshin-search-bar` に `overflow: hidden` を指定し、疑似要素には `border-radius: inherit` を適用しました。

これにより、検索バー内部のテクスチャが角丸の外へはみ出さないようにしています。

---

## 3. 円相ロゴの点の回転

`ZanshinMark.tsx` の金点を、SVG内の `<g>` に入れました。

CSS側で `.zanshin-logo-dot-orbit` を中心回転させています。

- 1周: 16秒
- 等速回転
- 発光・残像なし
- `prefers-reduced-motion: reduce` では停止

---

## 追加・変更ファイル

- `src/components/ZanshinMark.tsx`
- `src/phase25.css`
- `src/main.tsx`
- `docs/phase-25-ui-fixes-report.md`

---

## 確認ポイント

- カードと検索バーに虹色ムラが残っていない
- テクスチャが無彩色〜茶系に見える
- 検索バー右端のテクスチャが角丸内に収まる
- 円相ロゴの点がゆっくり時計回りに回る
- 動きを減らす設定では点が止まる
- 可読性が落ちていない

---

## 判断基準

> 和紙の静けさを壊す色と動きを消し、必要な気配だけを残す。
