# App Store Metadata Draft

> 初期の候補を残した草案です。2026-11-26現在、初版は日本語UI・無料・広告なし・Premiumなしです。提出用の文章は [Phase 20提出コピー](app-store-submission-copy-phase-20.md) と [品質改善設計](store-release-polish/DESIGN.md) を起点に、最終ビルドへ合わせて確定してください。英語の説明文は英語UIの実装を意味しません。

## アプリ名候補
- 残心 - Zanshin Notes
- Zanshin Notes

日本向けでは「残心」を前に出しやすい。海外向けでは `Zanshin Notes` の方が意味を伝えやすい可能性がある。

---

## サブタイトル候補
### 日本語
心の余白に言葉を残すメモ帳

### 英語
A quiet place for words that remain

---

## 短い説明
残心は、言葉と日付を静かに残すためのメモアプリです。  
和紙のような質感、余白を大切にした画面、控えめな日付印で、日々の思いや創作メモを落ち着いて書き残せます。

---

## 英語説明
Zanshin Notes is a quiet note-taking app inspired by Japanese stillness, paper texture, and mindful space.  
Write your thoughts, leave them with a subtle date mark, and return to them like small traces on paper.

---

## キーワード候補
### 日本語
メモ,日記,ノート,和風,余白,記録,創作,シンプル,日付,メモ帳

### 英語
notes,journal,memo,zanshin,writing,paper,calm,minimal,diary,stillness

注意:
- 他社商標や関係ない有名アプリ名を入れない
- 医療、治療、心理改善を示すキーワードは使わない
- `zen` のような広すぎる単語は、審査や検索意図との相性を見て慎重に採用する

---

## プロモーションテキスト案
### 日本語
書いたあとにも、心がそこに残る。  
残心は、余白と静けさを大切にしたメモ体験を届けます。

### 英語
Even after writing ends, a trace remains.  
Zanshin brings a calm note-taking experience shaped by stillness and space.

---

## Review Notes候補
This app is a simple note-taking app with a calm Japanese-inspired design.  
No account login is required.  
No ads or in-app purchases are included in the current release.  
No advertising or analytics SDKs are included, and the app does not perform tracking.  
The app uses Capacitor and official plugins for app lifecycle events and on-device file storage.  
Notes are stored locally on the device and are not sent to an external server.

最終ビルドの実装状況に合わせて更新します。初版ではPremium・購入・復元購入を利用者へ表示せず、本番機能として説明しません。

---

## スクリーンショット方針
現在の構成案は [受入条件のスクリーンショット確認](store-release-polish/ACCEPTANCE.md#93-スクリーンショットの確認) に合わせます。最終実ビルドを使い、次の価値を示します。

1. 読み返し: 日本語を縦書きで読む
2. エディタ: 題名なしのひとことから、横書きで書く
3. 検索・一覧: 残した言葉を見つける
4. 保存: この端末へ保存する

スクショ内コピー候補:
- 書いたあとにも、心が残る。
- 心の余白に言葉を置く。
- 日付が、静かなしるしになる。
- 和紙のような質感で、日々を残す。

注意:
- 文字を詰めすぎない
- スクショ内でも余白を守る
- 未実装の機能や、初版で無効のPremium・広告を紹介しない
