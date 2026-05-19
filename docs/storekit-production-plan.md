# StoreKit Production Plan

## 目的
残心 Premium の mock 実装を、本番の StoreKit 実装へ差し替えるための計画。

---

## Product ID
初期推奨:

```txt
zanshin.premium.remove_ads
```

種別:

Non-Consumable

理由:
- 広告削除に向いている
- 残心の静かな世界観に合う
- サブスク圧が少ない

---

## 将来候補
- `zanshin.premium.monthly`
- `zanshin.premium.yearly`

サブスクにする場合は、継続価値が必要。

例:
- iCloud同期
- 複数端末同期
- 追加テーマ
- 縦書き
- エクスポート
- AI整理

---

## 必要実装
- StoreKit商品取得
- 購入処理
- 購入復元
- entitlement確認
- Premium状態永続化
- Premium時広告非表示
- エラー表示
- Sandboxテスト
- TestFlight確認

---

## 実装メモ
- 現在の `src/lib/monetization.ts` は StoreKit 置き換え前提のモック層として扱う
- mock フラグを残したまま本番提出しない
- 購入復元は Premium 画面から常に辿れるようにする
- StoreKit 差し替え後も、書く体験を止めない静かな導線を維持する

---

## mock実装の扱い
- 開発中は mock 可
- App Store 提出前に本番 StoreKit へ差し替える
- mock購入ボタンを本番に残さない
- docsに未実装状態を明記する

---

## Review Notes
審査提出時には以下を明記する。

- Premium removes ads
- Restore purchase is available
- No login required
- Notes are stored locally
