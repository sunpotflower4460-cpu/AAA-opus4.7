# Phase 20 App Store Submission Copy

## 初回リリース方針

初回リリースでは、審査リスクと実装リスクを抑えるため、以下の状態で提出する。

- 無料
- 広告なし
- Premiumなし
- App内課金なし
- アカウントなし
- クラウド同期なし
- 外部SDKなし
- トラッキングなし
- メモは端末内保存のみ

---

## App Store Connect 入力案

### App Name

第一候補:

```text
残心 - Zanshin Notes
```

代替候補:

```text
Zanshin Notes
```

判断:

- 日本向けに出すなら `残心 - Zanshin Notes`
- 海外展開を強く見るなら `Zanshin Notes`
- ただし、App Store Connect で文字数・使用可否を最終確認する

---

### Subtitle

```text
静かに書き、読み返すメモ帳
```

代替:

```text
心の余白に言葉を残すメモ帳
```

---

### Promotional Text

```text
書いたあとにも、心が残る。残心は、静かに書き、縦書きで読み返せる、余白を大切にしたメモアプリです。
```

注意:

- 「癒やす」「心が整う」「不安を改善する」などの効能表現は使わない
- 世界観は体験とスクリーンショットで伝える

---

### Description / Japanese

```text
残心は、静かに書き、静かに読み返すためのメモアプリです。

和紙のような質感、余白を大切にした画面、控えめな日付印で、日々の思いや創作メモを落ち着いて残せます。

書くときは、シンプルな横書きエディタで。
読み返すときは、縦書きの余韻として。

言葉を急いで整理するのではなく、その日の余白にそっと置いておくようなメモ体験を目指しました。

主な機能:
- メモの作成・編集・削除
- 自動保存
- 検索
- お気に入り
- 日付印
- 縦書き読み返しモード
- 端末内保存

アカウント登録は不要です。
メモは端末内に保存され、外部サーバーへ送信されません。
```

---

### Description / English

```text
Zanshin Notes is a quiet note-taking app for writing and returning to your words.

It combines a Japanese-inspired paper texture, spacious layout, subtle date marks, and a vertical reading mode to create a calm writing experience.

Write in a simple horizontal editor.
Return to your notes in a vertical reading mode, like traces left on paper.

Features:
- Create, edit, and delete notes
- Auto save
- Search
- Favorites
- Subtle date marks
- Vertical reading mode
- Local device storage

No account is required.
Your notes are stored locally on your device and are not sent to an external server.
```

---

### Keywords / Japanese

```text
メモ,日記,ノート,記録,創作,文章,和紙,余白,シンプル,縦書き
```

代替候補:

```text
メモ帳,日記帳,ノート,文章,記録,創作メモ,和風,余白,縦書き,日付
```

注意:

- 他社アプリ名・商標を入れない
- 医療・心理改善系ワードを入れない
- `マインドフルネス` は効能連想が強くなるため初回は避ける

---

### Keywords / English

```text
notes,journal,memo,writing,paper,minimal,diary,zanshin,vertical,local
```

---

## Review Notes

```text
This app is a simple local note-taking app with a calm Japanese-inspired design.

No account login is required.
No ads are included in the current release.
No in-app purchases are included in the current release.
No analytics, tracking, or third-party SDKs are included.
Notes are stored locally on the device and are not sent to an external server.

Main flows to review:
1. Create a new note from the list screen.
2. Edit the title or body. The note is auto-saved locally.
3. Return to the list.
4. Open an existing note to view it in vertical read mode.
5. Tap the edit button to return to the editor.
6. Use search or favorite if needed.
7. Delete a note and optionally undo deletion.
```

---

## Privacy Nutrition Label 方針メモ

初回リリースの現状に基づく方針:

- アカウント: なし
- 位置情報: なし
- 連絡先: なし
- 写真/メディア: なし
- ヘルス/フィットネス: なし
- ユーザーコンテンツ送信: なし（端末内保存のみ）
- 識別子: なし
- 使用状況データ: なし
- 診断データ: なし（クラッシュSDKなし）
- トラッキング: なし

App Store Connect では、最終的に実装と一致するように確認する。
第三者SDKを追加した場合は、この方針を必ず更新する。

---

## スクリーンショット内コピー

### 1. 縦書き読み返し

```text
静かに、読み返す。
```

補助:

```text
書いた言葉が、紙に残るように。
```

### 2. エディタ

```text
心の余白に、言葉を置く。
```

### 3. メモ一覧

```text
日々の余韻を、紙片のように。
```

### 4. 空状態

```text
最初の余白をひらく。
```

### 5. 日付印 / 保存余韻

```text
その日のしるしが、静かに残る。
```

---

## 使用しない表現

以下は初回リリースでは避ける。

- 癒やす
- 心を整える
- 不安を軽くする
- メンタル改善
- マインドフルネス効果
- 瞑想効果
- 治療
- 診断
- セラピー

代わりに使う表現:

- 静かに書く
- 静かに読み返す
- 言葉を残す
- 余白を大切にする
- 端末内に保存する
- 縦書きで読み返す
