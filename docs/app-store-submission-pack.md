# App Store 提出パック（v1.0 / 最終版）

このファイルが提出内容の**唯一の正**です。App Store Connect へはここから貼り付けます。
過去フェーズの草案（`app-store-metadata-draft.md` / `app-store-submission-copy-phase-20.md`）より優先します。

---

## 0. 提出時点のアプリ仕様

| 項目 | 内容 |
|------|------|
| Bundle ID | `com.zanshin.notes` |
| Version / Build | `1.0` / `1`（`MARKETING_VERSION` / `CURRENT_PROJECT_VERSION`） |
| 対応端末 | iPhone のみ・縦向きのみ（iOS 14.0 以上） |
| 価格 | 無料 |
| 広告 / 課金 | なし（`ADS_ENABLED` / `PREMIUM_ENABLED` = false。mock Premium は UI から到達不可） |
| 外部SDK・通信 | なし（アカウント・分析・クラッシュレポート・トラッキングなし） |
| 暗号化 | 独自・非免除の暗号化なし → `ITSAppUsesNonExemptEncryption = false` を Info.plist に設定済み |
| Privacy Manifest | `PrivacyInfo.xcprivacy`（トラッキングなし・収集データなし・FileTimestamp C617.1） |

---

## 1. App Store Connect 入力内容（日本語・プライマリ）

**アプリ名**（30字以内 / 18字）
```text
残心 - Zanshin Notes
```

**サブタイトル**（30字以内 / 13字）
```text
静かに書き、読み返すメモ帳
```

**プロモーションテキスト**（170字以内 / 49字）
```text
書いたあとにも、心が残る。残心は、静かに書き、縦書きで読み返せる、余白を大切にしたメモアプリです。
```

**説明文**
```text
残心は、静かに書き、静かに読み返すためのメモアプリです。

和紙のような質感、余白を大切にした画面、控えめな日付印で、日々の思いや創作メモを落ち着いて残せます。

書くときは、シンプルな横書きエディタで。
読み返すときは、縦書きの余韻として。

言葉を急いで整理するのではなく、その日の余白にそっと置いておくようなメモ体験を目指しました。

【主な機能】
・メモの作成・編集・削除（削除後は少しの間、元に戻せます）
・自動保存
・検索
・お気に入り（金のしるし）
・日付印
・縦書きの読み返しモード
・筆あと（明朝・筆・墨・手書きから字の表情を選べます）
・端末内保存

【安心してお使いいただくために】
・アカウント登録は不要です
・広告は表示されません
・メモは端末内に保存され、外部のサーバーへは送信されません
・トラッキングや分析は行いません
```

**キーワード**（100字以内 / 約50字）
```text
メモ,メモ帳,日記,日記帳,ノート,記録,創作,文章,和紙,和風,余白,縦書き,筆,毛筆,手書き
```

**新機能（What's New）**: 初回リリースのため不要。

**著作権**: `© 2026 （提出者名）` ← 要入力

## 2. 英語ローカライズ（任意・推奨）

**Name**: `Zanshin Notes`
**Subtitle**（30字以内 / 28字）: `A quiet place for your words`
**Promotional Text**:
```text
Even after writing ends, a trace remains. Zanshin is a calm notebook shaped by stillness and space, with a vertical reading mode.
```
**Description**
```text
Zanshin Notes is a quiet note-taking app for writing, and for returning to your words.

A Japanese-inspired paper texture, generous space, subtle date marks and a vertical reading mode come together in a calm writing experience.

Write in a simple horizontal editor.
Return to your notes in vertical reading mode, like traces left on paper.

FEATURES
• Create, edit and delete notes (with a short undo window after deleting)
• Automatic saving
• Search
• Favorites
• Subtle date marks
• Vertical reading mode
• Choice of writing styles: Mincho, Brush, Ink, and Handwriting
• Stored on your device

PRIVATE BY DESIGN
• No account required
• No ads
• Your notes stay on your device and are never sent to a server
• No tracking or analytics
```
**Keywords**（100字以内 / 77字）
```text
notes,journal,memo,writing,diary,paper,minimal,vertical,zanshin,notebook,calm
```

## 3. 分類・年齢・配信

| 項目 | 設定 |
|------|------|
| プライマリカテゴリ | 仕事効率化（Productivity） |
| セカンダリカテゴリ | ライフスタイル（Lifestyle） |
| 年齢制限 | すべての質問に「なし」→ **4+** |
| 価格 | 無料（Tier 0） |
| 配信国 | 日本を必須。海外は英語ローカライズ登録後に任意で追加 |
| 子ども向けカテゴリ | 該当しない |

## 4. App プライバシー（App Store Connect の回答）

**「データを収集していない（Data Not Collected）」** を選択します。

- 広告・分析・追跡のSDKは使っていません。アプリは端末内の機能のために Capacitor（オープンソースのフレームワーク）を使用しており、メモを外部のサーバーへ送信しません（`package.json` の依存は React / Capacitor 関連のみ。Privacy Manifest は収集データなし・トラッキングなし）。
- トラッキングなし → ATT ダイアログは不要（`NSUserTrackingUsageDescription` は付けない）。
- 権限ダイアログなし（Info.plist に `NS*UsageDescription` は不要）。

## 5. URL

| 項目 | 値 |
|------|----|
| プライバシーポリシーURL | `https://<公開ドメイン>/privacy.html` ← 要入力（`public/privacy.html`） |
| サポートURL | `https://<公開ドメイン>/support.html` ← 要入力（`public/support.html`） |
| マーケティングURL | 任意 |

公開は `npm run deploy`（Cloudflare Workers）でできます。公開後、2つの URL がブラウザで開けることを必ず確認してください。

## 6. 審査用情報（Review Notes）

ログイン情報: 不要（「サインインが必要」はオフ）。連絡先の氏名・電話・メールは App Store Connect に入力。

```text
This is a simple, fully local note-taking app with a calm Japanese-inspired design.

- No account or login is required.
- No ads, no in-app purchases, no analytics and no tracking. The app uses the open-source Capacitor framework for on-device features; it contains no advertising, analytics or tracking SDKs.
- Notes are stored only on the device and are never sent to a server. The app makes no network requests.

How to review:
1. On the home screen, tap "言葉を置く" (the + button) to create a note.
2. Type a title and body. The note is saved automatically; no save button is needed.
3. Tap back to return to the list, then tap a note to open it in vertical reading mode.
4. Tap "言葉を直す" to edit. The gold dot button marks a note as a favorite; the trash icon deletes it (a confirmation is shown, and Undo is offered for a few seconds).
5. Use the search field on the home screen to find notes.

The UI is in Japanese. "残心" (zanshin) is a Japanese term meaning a lingering, mindful presence after an action.
```

## 7. スクリーンショット

`store/screenshots/` に生成済み（各サイズ5枚・キャプション付き・JPEG・alphaなし）。

| 用途 | ファイル | サイズ |
|------|----------|--------|
| 6.9インチ（iPhone 16/17 Pro Max 等・必須） | `6.9inch-1320x2868-{home,edit,read,brush,search}.jpg` | 1320×2868 |
| 6.5インチ（任意） | `6.5inch-1284x2778-{home,edit,read,brush,search}.jpg` | 1284×2778 |

推奨アップロード順: `home` → `read` → `brush` → `edit` → `search`。

> **注意**: これらは Web ビルドをモバイル幅で撮影した画像です（フォントは実機の Hiragino 明朝に近い Noto Serif JP）。
> 審査上は問題になりにくいものの、可能なら Xcode Simulator（iPhone 17 Pro Max）で同じ5画面を撮り直して差し替えると最も確実です。
> 再生成は `store/tools/capture-screenshots.cjs` のコメントを参照。

## 8. ビルド・アップロード手順（Mac / Xcode が必要）

```bash
git checkout <このブランチ>
npm ci
npm run check            # typecheck + lint + test + build
npm run cap:sync:ios     # dist を ios/ に同期
npm run cap:open:ios     # Xcode を開く
```

Xcode で:
1. `App` ターゲット → Signing & Capabilities → **Team を選択**（自動署名）
2. Version `1.0` / Build `1` を確認
3. 実機で一度起動し、`docs/ios-testflight-runbook-phase-20.md` §5 を確認
4. 実行先を **Any iOS Device (arm64)** にして **Product → Archive**
5. Organizer → **Distribute App → App Store Connect → Upload**
6. App Store Connect で処理完了後、TestFlight で確認 → 審査に提出

## 9. 提出者にしかできないこと（残タスク）

- [ ] Apple Developer Program への登録・有効化
- [ ] App Store Connect で App 作成（Bundle ID `com.zanshin.notes`、SKU 任意）
- [ ] プライバシーポリシー / サポートページの公開と URL の入力（§5）
- [ ] **サポートの連絡手段の確定**: 現在 `support.html` は GitHub Issues のみ。リポジトリが非公開だとユーザーは問い合わせできず、Apple は有効なサポート連絡先を求めます。公開メールアドレスまたは公開フォーム等に差し替えてください。
- [ ] Xcode で Signing Team を設定し、実機・TestFlight で動作確認
- [ ] 著作権表記・審査連絡先の入力
- [ ] （推奨）スクリーンショットを Simulator 撮影に差し替え

## 9.5 同梱フォントのライセンス

「筆あと」用に Yuji Syuku / Yuji Boku / Klee One（いずれも SIL Open Font License 1.1）をアプリへ同梱しています（通信なしで動くため端末内に持たせています）。
ライセンス全文は `public/licenses/fonts-OFL.txt`（サポートページからリンク）。アプリ容量は Web 資産が約 20MB 増えます。

## 10. 提出前の最終確認

- [x] 広告・課金・mock Premium が UI に出ない
- [x] メモを外部へ送信しない／広告・分析・追跡のSDKなし（Capacitor は使用。「第三者SDKなし」とは書かない）
- [x] 暗号化の申告（Info.plist）
- [x] Privacy Manifest
- [x] アプリアイコン 1024×1024（アルファなし）/ 起動画面が残心ブランド
- [x] iPhone のみ・縦向きのみ
- [x] 入力欄は 16px 以上（iOS の自動ズーム回避）
- [x] 誇大表現・医療/治療表現なし
- [x] `npm audit --omit=dev` が 0 件（`@capacitor/*` を 7.6.11 へ更新して critical 脆弱性を解消）
- [x] `npm run check` 成功（typecheck / lint / 164 tests / build）
