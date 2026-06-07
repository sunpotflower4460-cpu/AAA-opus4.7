# Phase 28 Sepia Washi Fix Report

## 目的

スクリーンショット確認後の追加調整として、以下の3点を修正しました。

1. グレーになりすぎた紙ムラを茶系の濃淡へ戻す
2. 背景の地の紙の和紙感を少し強める
3. 検索バー右端の見切れ対策を維持・強化する

---

## 1. 茶系の濃淡へ戻す

Phase 25〜27では虹色対策のため `grayscale(1)` を強く使っていましたが、紙ムラが灰色に見えやすくなっていました。

Phase 28では、紙面ノイズに以下を適用しています。

```css
filter: sepia(0.45) saturate(0.6) brightness(1.05);
```

これにより、虹色を抑えつつ、和紙らしい温かい茶系の濃淡を戻しています。

---

## 2. 背景の地の紙を強める

`body::after` の繊維ノイズを以下へ調整しました。

- opacity: `0.07`
- baseFrequency: `0.013`
- numOctaves: `2`
- filter: `sepia(0.4) saturate(0.55) brightness(1.04)`

さらに `body` / `body::before` に茶系の大きな radial-gradient を複数追加し、光に透かした和紙のような雲状ムラを強めました。

---

## 3. 検索バーの見切れ対策

Phase 27と同様、検索バーは以下を維持・強化しています。

- `overflow: hidden`
- `isolation: isolate`
- `contain: paint`
- `clip-path: inset(0 round 9999px)`
- `::after` は完全無効化
- `::before` のみを角丸内に収める

---

## 追加したファイル

- `src/phase28.css`
- `docs/phase-28-sepia-washi-fix-report.md`

## 更新したファイル

- `src/main.tsx`
  - `phase28.css` を最後に読み込み

---

## 確認ポイント

- カードのムラが灰色ではなく茶系の濃淡に見える
- 背景に少しだけ和紙繊維と雲状ムラが増えている
- 虹色っぽさが戻っていない
- 検索バー右端が切れていない
- 文字の可読性が落ちていない

---

## 判断基準

> 虹色でも灰色でもなく、茶系の紙の濃淡として見えるか。
