# Phase 30 — Data / Search / A11y Hardening Report

## 目的

Phase 29 で UI/UX の「間」「所作」「紙片性」を整えた後、Phase 30 では見た目では発見しにくい不具合を優先して監査した。

今回の基準は次の4つ。

1. データを失わない
2. 保存状態について嘘をつかない
3. 検索・読み返し・ダイアログで操作上の矛盾を作らない
4. 今回直した事故が将来復活したら CI で検知する

---

## 修正1 — 破損ロード直後の pagehide が元データを空配列で上書きする可能性

### 問題

従来は破損データ検知時に autosave を一度止めるガードがあったが、`beforeunload` / `pagehide` の強制保存はそのガードを無視していた。

破損主データ → `loadNotes()` が空配列を返す → 画面を閉じる、という流れで、元の raw データを `[]` で上書きできる状態だった。

### 修正

- 破損復旧中は、ユーザー自身の明示的な編集が入るまで保存禁止を維持
- autosave / pagehide / beforeunload / visibilitychange のすべてが同じ保存ガードを参照
- 復旧確認だけして閉じても元データを変更しない

---

## 修正2 — 開いただけの古いタブが新しいタブの保存内容を巻き戻す可能性

### 問題

従来の lifecycle 保存は、そのタブで編集していなくても `pagehide` 時に全 notes を書き戻していた。

例:

1. タブA / B が同じ状態を読む
2. A で編集して保存
3. 古い状態の B を閉じる
4. B の `pagehide` が古い配列を書き戻す

### 修正

- `notesDirtyRef` を導入
- このタブ自身が変更した場合だけ lifecycle flush を許可
- 開いただけのタブは localStorage を一切書き換えない
- `visibilitychange` で hidden になった場合も、未保存変更がある場合だけ補完保存

### 回帰テスト

実際に `App` を React StrictMode 配下へマウントし、外部で storage を新しい内容に差し替えた後に `pagehide` を発火して、古いタブが上書きしないことを検証する。

---

## 修正3 — 作っていたバックアップを復旧時に使っていなかった

### 問題

`saveNotes()` は `zanshin.notes.backup.v1` を保存していたが、`loadNotes()` は主データが壊れてもバックアップを読んでいなかった。

### 修正

- 主データが corrupt / invalid_structure の場合、元 raw を corrupt backup へ保存
- 直前バックアップが完全に正常なら復元候補として使用
- 主データ内で救える正常要素とバックアップを ID 単位で統合
- 同じ ID は `updatedAt` が新しい方を採用
- 復元候補を表示しても `ok:false` のままとし、自動上書きはしない

---

## 修正4 — 一部だけ壊れた配列を「正常」と判定していた

### 問題

以前は `parsed.filter(isNote)` を返して `ok:true` としていたため、100件中1件だけ不正でもその1件を黙って捨てた状態を正常と見なし、その後の autosave で元配列を上書きできた。

### 修正

一つでも不正要素があれば `invalid_structure` として扱い、正常要素は復元候補として見せるが、ユーザーが明示的に編集するまで保存しない。

---

## 修正5 — 重複IDによる複数メモ同時編集 / 同時削除リスク

### 問題

更新・削除は ID 一致で処理するため、localStorage に同一 ID のメモが複数あると一操作で複数件に影響する。

### 修正

- ロード時に重複 ID を `invalid_structure` と判定
- 復元表示では `updatedAt` が新しい方だけを採用
- 不正日時 / 空 ID / 不正 locale も同様に正常扱いしない

---

## 修正6 — 正常バックアップを破損主データで上書きし得た

### 問題

`saveNotes()` は保存前の current を無条件に backup へコピーしていた。

復旧後の最初の保存時に current が破損 raw のままだと、正常だった backup を破損 raw で潰してから主データ保存を試すことになる。

### 修正

current が完全に正常と検証できた場合だけ backup を更新する。

主データ保存に失敗しても既存の正常 backup を維持する。

---

## 修正7 — バックアップ領域だけ読めない場合に救出済みメモまで失う

### 問題

主データから正常要素を救出した後、backup の `getItem()` が SecurityError 等で失敗すると outer catch に入り、救出済み要素まで捨てて空配列を返し得た。

### 修正

backup 読み出しを独立した失敗境界へ分離。backup だけ読めなくても primary から救えた正常メモは返す。

---

## 修正8 — 保存済み表示が実保存の成功ではなく時間で決まっていた

### 問題

Phase 29 で 500ms autosave より遅い 650ms へ表示をずらしたが、まだ「650ms 経った = 保存成功」という推測だった。

localStorage が quota / unavailable でもタイミング次第で一瞬成功表示を出す余地があった。

### 修正

- `App` の実 `saveNotes()` 結果を `NoteEditor` へ渡す
- 実保存成功後のみ `saved`
- 実保存失敗は `error`
- 1200ms タイマーは「実際に成功した saved 表示を静かに消す」用途だけに限定

---

## 修正9 — 空白だけの検索で一覧が消える

### 問題

検索判定側は raw query を使い、`isSearching` は trim 後を使っていた。

`"   "` や全角空白だけを入力すると全メモが非一致になる一方、UIは「検索中ではない」と判定する不整合があった。

### 修正

- `normalizeSearchQuery()` を共通化
- 前後の半角 / 全角空白を除去
- 空白だけなら未検索として全件表示
- `sortNotes` / `matchesNote` を `src/lib/notesLogic.ts` へ抽出

---

## 修正10 — 検索テストが本番コードを検証していなかった

### 問題

既存 `notesLogic.test.ts` は production の関数を import せず、同じような関数をテストファイル内に再実装していた。

そのため本番だけ壊れてもテストが緑になり得た。

### 修正

テストから production `notesLogic.ts` を直接 import する。

空白検索・全角空白・大小文字・ソート不変性を本番実装そのものに対して検証する。

---

## 修正11 — 検索文脈が読み返し後に消える

### 問題

検索 query が `NotesList` ローカル state だったため、メモを開いて戻ると NotesList が再マウントされ、検索条件が消えていた。

### 修正

query state を `App` へ移動。

- 検索結果を開く → 戻る: 検索条件を維持
- 新規メモを作る: 新規メモが見えなくならないよう検索条件を解除

---

## 修正12 — SearchBar の interactive HTML 構造と Safari 二重 clear

### 問題

検索バー全体が `<label>` で、その内部に input と独立した button があった。

また `type=search` の Safari/WebKit 標準 clear と独自 clear が二重表示される可能性があった。

### 修正

- wrapper を `div` へ
- `useId()` で input と sr-only label を明示関連付け
- wrapper を押した場合は input へ focus
- clear button は独立した正しい button semantics
- `phase30.css` で native search decoration / cancel button を非表示

---

## 修正13 — 読み返しで本文の意図した余白を削っていた

### 問題

`ReadMode` が表示内容自体へ `trim()` を適用していたため、ユーザーが意図して残した冒頭・末尾の改行が消えていた。

### 修正

`trim()` は空本文判定だけに使い、実表示は `note.body` 原文をそのまま使用する。

---

## 修正14 — 不正日時が「夜の余白」と表示される

### 問題

Invalid Date の `getHours()` は NaN となり、朝/昼/夕の条件をすべて抜けて最後の「夜の余白」を返していた。

### 修正

- 日付変換前に valid date 判定
- 不正日時は label / date とも空文字
- `ZanshinDateStamp` は不正日時では描画しない
- 回帰テスト追加

---

## 修正15 — 削除ダイアログの残りのアクセシビリティ

Phase 29 で focus trap / Escape は入っていたが、Phase 30 で次も追加した。

- 背景 body scroll lock
- Cancel / Escape / backdrop close 後に削除トリガーへ focus 復帰
- Cancel / Delete の最低44pxタッチターゲット
- 空状態 CTA も最低44pxへ

---

## テスト強化

今回追加・更新した主な検証:

- corrupt JSON raw 退避
- 正常バックアップから復旧
- non-array primary から backup 復旧
- 一部不正配列を `ok:false` にする
- duplicate ID の新しい方を復元候補へ
- invalid timestamp / locale の拒否
- backup 読み出しだけ失敗しても primary survivor を維持
- corrupt primary が正常 backup を上書きしない
- whitespace-only / full-width-space search
- production の sort/search 実装を直接テスト
- invalid date が夜扱いされない
- React StrictMode で App を実マウントし、古い idle tab の pagehide 上書きを防止
- React StrictMode で corrupt recovery 中の pagehide 上書きを防止

---

## 今回あえて扱っていないもの

### 2つのタブで同時に積極編集した場合の競合解決

今回、**編集していない古いタブが閉じるだけで巻き戻す事故**は防止した。

一方で、2タブが同時に別々の変更を行う場合の完全な自動マージには、削除 tombstone / revision / conflict UI などの設計が必要になる。

初回 iOS リリースは単一 WebView を主対象とするため Phase 30 では無理に複雑化しない。Web版で複数タブ編集を正式サポートする場合は別フェーズで optimistic concurrency を導入する。

---

## Validation

GitHub Actions `Check`:

- TypeScript typecheck
- ESLint
- Vitest
- Vite production build

すべて成功を完了条件とする。

## 判断

Phase 29 は「残心らしく見える / 触れる」品質を上げた。

Phase 30 はその裏側で、**言葉を預けても消えにくい、保存状態を誤魔化さない、壊れた時にも救おうとする**プロダクトへ寄せるフェーズとした。
