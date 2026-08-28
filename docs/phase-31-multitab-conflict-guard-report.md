# Phase 31 — Multi-tab Conflict Guard / Persistence Hardening

## 目的

Phase 30 では、破損データの上書き・終了時保存・古い未編集タブによる巻き戻しを修正した。

Phase 31 では、さらに一段深く、**古い画面を開いたまま別画面で更新し、その後古い画面でも編集した場合**の silent overwrite を防ぐ。

残心は「言葉を預ける」アプリであるため、便利な自動マージよりも、競合時に黙って言葉を消さないことを優先する。

---

## 発見した主要リスク

### 1. stale tab が編集を始めると別タブ更新を消せる

Phase 30 で「開いただけの古いタブを閉じる」事故は防いだが、以下は残っていた。

1. Tab A が古いメモ一覧を保持
2. Tab B がメモを追加・更新・削除して保存
3. Tab A がその後1文字編集
4. Tab A の古い配列全体が保存される
5. Tab B の変更が失われ得る

これはメモアプリとして高優先度のデータ保全問題。

### 2. storage event だけでは不十分

`storage` event は別コンテキスト変更を知らせるが、保存安全性をイベント到着だけへ依存すると、

- イベント処理前に lifecycle flush が走る
- テスト・WebView差異・タイミング差

などに弱い。

そのため、イベント監視に加えて**保存直前の比較検証**を入れた。

### 3. 将来スキーマの未知フィールドを古い画面が消す可能性

競合比較を既知の `Note` フィールドだけで行うと、将来追加されたフィールドだけが別画面で更新されても差分を検知できない。

Phase 31 では、永続化されたNoteオブジェクト全体を比較対象にし、古いコードから将来フィールドを silent overwrite しにくくした。

### 4. 競合解決後にエラー表示だけ残る

「保存先の内容を採用」を選んで本文は最新へ切り替わっても、Note id が同じためエディタのローカル `saveState` が conflict error のまま残るケースがあった。

保存先採用後に正常状態をエディタへ通知し、表示も回復させる。

### 5. CI Node とCloudflareツールチェーンの要求バージョンが不一致

CI は Node 20 固定だったが、現在の以下の依存は Node 22 以上を要求していた。

- Wrangler 4.98
- Miniflare 4 系
- Cloudflare関連依存

警告のまま進めると将来の更新で突然CIが壊れ得るため、CIを Node 22 へ更新した。

---

## 実装

### Optimistic conflict detection

`saveNotes(notes, { expectedNotes })` を追加。

保存前に、

- この画面が最後に正常に知っていたメモ集合
- 現在 localStorage に存在するメモ集合

を比較する。

一致しなければ `reason: "conflict"` を返し、保存しない。

これにより storage event が間に合わなくても、保存境界で silent overwrite を止める。

### force save

競合時、ユーザーが明示的に「この画面の編集で上書き」を選んだ場合のみ `force: true` を使う。

force save 前には現在の正常な primary を backup へ退避する。

つまり、明示上書き時も別画面版を即座に捨てない。

### outgoing validation

`saveNotes()` 自身が保存対象を再検証する。

以下のような壊れた状態を、アプリ内部のバグから新たに永続化しない。

- duplicate id
- invalid date
- invalid locale
- invalid structure

不正なら `reason: "invalid_data"` で保存拒否する。

### clean tab sync / dirty tab pause

別画面から `storage` event を受けた場合:

#### ローカル未編集

保存先の最新版へ自動追従する。

#### ローカル未保存編集あり

自動追従しない。
自動保存もしない。
競合UIを表示する。

ユーザーが以下から選ぶ。

- 未保存編集を破棄して保存先を読み込む
- この画面の編集で上書き

### corrupt recovery は通常競合と分離

元 primary が破損しており backup 等から復元表示している場合、「保存先を読み込む」は成立しない。

そのため復旧中は、意味のない読み込みボタンを表示しない。

元の破損 raw は既存の corrupt backup へ退避したまま、復元内容を確認して明示的に保存し直す導線だけを出す。

### lifecycle snapshot

`pagehide` は入力直後に来る可能性があるため、flush用の最新notes参照を `useLayoutEffect` で更新する。

---

## UI / UX 原則

競合時に自動マージを行わない。

理由:

- Tab A で削除、Tab B で編集
- 同じnoteを両方で別内容へ編集
- 一方がfavorite変更、一方が本文変更

などは、単純な `updatedAt` winner や配列mergeでは意図を壊す可能性がある。

残心では「便利に勝手に決める」より「黙って消さない」を優先する。

また、保存先採用ボタンはローカル未保存編集を破棄するため、文言を明示的にした。

---

## 回帰テスト

### storage unit tests

- expected baseline と primary が違えば conflict
- baseline と primary が一致すれば保存成功
- force save で現在primaryをbackupへ残す
- invalid outgoing notes を保存拒否
- 将来の未知フィールドだけが変化していても conflict

### real App / StrictMode tests

React StrictMode で実Appをマウントして確認。

- 未編集タブは外部更新へ追従
- storage event が来なくても保存直前比較で競合検知
- pagehide でもremote版を破壊しない
- conflict message を表示
- 明示上書き時はremote版をbackupへ保存
- 保存先採用時はローカル未保存編集を破棄してremoteへ切替
- 保存先採用後に古い conflict 表示を残さない
- corrupt recovery 中は成立しない「保存先を読み込む」を表示しない

---

## CI / security hygiene

CI の Node を 20 → 22 へ更新し、現在のCloudflareツールチェーン要求へ合わせた。

さらに以下をCIへ追加。

```bash
npm audit --omit=dev --audit-level=high
```

全依存のauditには開発ツール由来の警告も含まれるため、出荷物へ直接影響するproduction dependencyのhigh以上をまずmerge gateにする。

開発依存の脆弱性は別途依存更新として安全に評価する。

---

## 意図的に今回入れていないもの

### 自動三者マージ

導入していない。
削除・編集競合の意図判定が必要で、誤マージはsilent overwriteと同じくらい危険。

### 完全なtransactional CAS

localStorage には、複数コンテキストを跨いだ compare-and-set transaction がない。

Phase 31 の保存直前比較は通常の競合を大幅に減らすが、理論上は2画面がほぼ同時に

1. 同じbaselineを読む
2. 両方が比較に成功
3. 両方が順番にsetItem

という極小レースは残る。

完全に閉じる場合の候補:

- Web Locks API で保存クリティカルセクションを直列化
- revision / generation token を持つ永続化モデル
- IndexedDB transaction
- Capacitor/iOS側のnative storage coordinator

初回iOSリリースのローカル単一WebViewでは優先度は低いが、Web版を複数タブで積極利用する場合は次の強化候補。

---

## Phase 31 の判断基準

> 別の画面に新しい言葉があるなら、古い画面は勝手に消さない。

競合を完全に見えなくするのではなく、**競合した瞬間に保存を止め、ユーザーへ選択権を戻す**ことを品質基準とした。
