# Phase 32 — Lifecycle Recovery / Interrupted Save Hardening

## 目的

Phase 31 では、複数タブ・複数画面からの stale overwrite を保存直前比較と競合UIで止めた。

Phase 32 ではさらに、**保存処理そのものが途中で失敗・中断した場合**と、**iOS/WKWebView の suspend / resume や lifecycle 境界**で最新の言葉を失う可能性を重点的に潰す。

残心では、保存成功率を上げるだけでなく、失敗したときに「どの版が残っているか」を追跡できることを品質基準にする。

---

## 発見した主要リスク

### 1. backup と primary の二段書き込みだけでは途中中断を判定できない

最新版を backup → primary の順で保存すると、primary 書き込みで失敗した場合は backup に最新版が残る。

しかし再起動時に primary 自体が正常な旧版だと、単純な loader は primary を正常扱いして最新版 backup を見ない。

結果として「最新版は残っているのに復旧候補へ出せない」状態が起こり得る。

### 2. backup 書き込み失敗後に primary だけ進めると復旧保証が崩れる

保存成功なのに recovery backup が古い状態を作らないため、backup の確定を primary より先にし、backup 失敗時は primary へ進まない必要がある。

### 3. force overwrite 時の別画面版を通常 backup と混ぜると役割が衝突する

通常 backup は「現在採用されている最新版のミラー」であるべき。

一方、競合時にユーザーが明示的にローカル版を優先した場合は、上書きされる remote 版も残したい。

同じキーでは両方を同時に満たせないため、競合退避を専用領域へ分離した。

### 4. iOS/WKWebView では storage event だけに依存できない

長時間 suspend や background / foreground 復帰では、Web の通常タブと同じタイミングで storage event を受け取ることを前提にしにくい。

そのため `pageshow` / `visibilitychange` 復帰時にも、ローカル未編集なら保存先を再確認する。

### 5. 連続入力で debounce が無限に後ろ倒しされる

500ms debounce だけだと、500ms未満の間隔で入力が続く限り保存されない。

モバイルで長文入力中に突然 background / terminate が起きることを考えると、一定時間以内には途中保存した方が安全。

### 6. Phase 31 の旧 backup semantics から安全に移行する必要がある

Phase 31 の backup は「1世代前を退避する」意味を含んでいた。

Phase 32 では通常 backup を「最新正常状態の mirror」に変更したため、更新直後の既存端末でも安全に移行する必要がある。

---

## 実装

### 1. 保存 journal

`zanshin.notes.pending-save.v1` を追加した。

保存開始前に以下を記録する。

- version
- writerId
- baseRaw
- nextRaw

これにより再起動時に、

- primary == baseRaw → 保存途中で止まった可能性が高い。nextRaw を復旧候補として提示
- primary == nextRaw → primary 保存までは完了済み。backup を修復して journal を片付ける
- primary がどちらとも違う → 別画面更新等の可能性があるため勝手に採用しない

と判定できる。

### 2. writerId による保存元の識別

同じ画面自身が途中保存に失敗した後、さらに入力した場合まで永遠に conflict へ固定しないため、画面ごとの `writerId` を journal に保持する。

- 同一 writer の中断 journal → 現在の編集の安全な再試行・更新を許可
- 別 writer の中断 journal → silent overwrite を防ぐため conflict
- Phase 32導入前の owner-less journal → 保守的に扱う

### 3. backup-first persistence

通常保存の順序を概念的に以下へ整理した。

1. journal を記録
2. 最新正常 backup を確定
3. primary を確定
4. journal を削除

backup の書き込みに失敗した場合は primary を変更しない。

primary の書き込みに失敗した場合は journal と backup に最新版候補が残る。

journal cleanup のみ失敗した場合は、次回ロードで primary == nextRaw を確認して安全に後片付けできる。

### 4. 通常 backup と conflict backup を分離

- `zanshin.notes.backup.v1`
  - 現在採用されている最新正常状態の mirror
- `zanshin.notes.conflict.backup.v1`
  - 明示的な force overwrite 前に退避する別画面版

force overwrite では remote の退避に失敗した場合、上書きそのものを中止する。

### 5. Phase 31 backup の安全な移行

正常 primary をロードしたとき、通常 backup が primary と一致していなければ最新版 mirror へ更新する。

旧 backup が正常で、競合退避領域がまだ空いている場合は、旧版を conflict backup 側へ残してから mirror を更新する。

これによりアップデート直後の端末でも、旧 recovery copy を無条件に捨てずに新 semantics へ移行できる。

### 6. runtime recovery

実行中に primary だけ消えた場合も、clean な画面では backup を復元候補として表示する。

ただし自動保存は再開せず、ユーザーが復元候補を確認して明示保存するまで recovery guard を維持する。

### 7. resume refresh

以下を追加・強化した。

- `pageshow`
- `visibilitychange` で visible に戻ったとき

ローカルが clean の場合だけ `loadNotes()` を再実行し、suspend 中に取りこぼした remote 更新へ追従する。

ローカル dirty の場合は remote を勝手に採用せず、保存境界で conflict とする。

### 8. debounce max wait

通常の autosave debounce は 500ms を維持しつつ、dirty 区間が長く続く場合は最大 3秒で一度保存する。

これにより連続入力でも保存が永遠に延期されない。

### 9. lifecycle duplicate flush guard

`pagehide` / `beforeunload` 等が近接して複数回来ても、1回の成功保存後は dirty flag を落とし、同一 snapshot を重複保存しない。

---

## 異常系の保存保証

### journal 書き込み失敗

backup / primary は変更しない。

### backup 書き込み失敗

primary は変更しない。
journal に next candidate を残す。

### primary 書き込み失敗

旧 primary を維持する。
最新 backup と journal から次回起動時に復旧候補を提示できる。

### journal cleanup 失敗

primary == nextRaw を確認できるため、次回ロードで「保存完了済み」と判定し、backup を修復して journal を削除できる。

### force overwrite の conflict backup 失敗

remote primary を上書きしない。
remote は primary と通常 backup に残り、競合状態も継続する。

---

## 回帰テスト

Phase 32終了時点で CI 上 70 tests が通過する構成。

### storage unit tests

以下を含む。

- 正常保存後に journal が残らない
- primary / backup が同じ最新版になる
- journal 書き込み失敗時に primary / backup を変更しない
- backup 失敗時に primary を変更しない
- primary 失敗時に journal + backup から復旧候補を返す
- empty array の保存途中中断でも「全削除」の意図を復旧候補として扱う
- cleanup 失敗後に completed journal を自己修復
- 不正 journal が正常 primary を壊さない
- 別 writer の interrupted journal を通常保存で上書きしない
- 同一 writer の journal を安全に再試行できる
- force overwrite 前に remote を conflict backup へ退避
- conflict backup 退避失敗時は primary を変更しない
- Phase 31旧backupをPhase 32 mirror semanticsへ移行
- 旧backupを可能な場合 conflict backupへ保持

### App / StrictMode tests

以下を含む。

- 長時間連続入力でも3秒以内に途中保存
- pagehide の連続発火で重複保存しない
- clean画面は storage event でremoteへ追従
- primary消失時は runtime recovery candidate を表示
- pageshow復帰時に取りこぼしたremote更新へ追従
- dirty状態の復帰ではremoteを勝手に採用しない
- storage eventがなくても保存境界で競合検知
- force overwrite時にremoteを専用退避
- 専用退避失敗時にremoteをprimary/backupへ保持し競合状態を継続
- interrupted save candidate を起動時UIへ表示
- empty recovery candidate でも自動保存せず確認を求める

---

## CI hygiene

GitHub Actions のアクションランタイムも更新した。

- `actions/checkout@v4` → `actions/checkout@v7`
- `actions/setup-node@v4` → `actions/setup-node@v7`

プロジェクト本体の検証 Node は 22 を維持する。

これにより GitHub Actions 側の Node 20 runtime deprecated 警告を除去した。

production dependency gate:

```bash
npm audit --omit=dev --audit-level=high
```

は継続し、最新CIで 0 vulnerabilities。

一方、dev/tooling を含む `npm ci` 全体では 12 vulnerabilities（2 low / 1 moderate / 9 high）が表示されるため、全依存が解消済みとは扱わない。

---

## 意図的に残している限界

### localStorage の完全な atomic transaction ではない

journal により途中中断への復旧性は大幅に上がったが、localStorage 自体には複数タブ横断の compare-and-set transaction がない。

理論上は複数 writer が極めて近接して検証・書き込みする競合余地は残る。

Webで完全に閉じる候補:

- Web Locks API
- revision / generation token
- IndexedDB transaction

### iOS native project はまだ検証対象外

現在のrepositoryには `ios/` native project がまだ存在せず、Web CI green は Xcode / WKWebView / TestFlight の再現性保証ではない。

次フェーズでは以下を優先する。

- Capacitor dependencies / config の再現可能性
- `npx cap sync ios`
- Xcode project generation
- safe area
- keyboard resize
- background / foreground
- force terminate / relaunch
- localStorage persistence
- vertical read mode in WKWebView
- 375 / 390 / 430 widths

---

## Phase 32 の判断基準

> 保存の途中でアプリが止まっても、「最後に書こうとした言葉」が残っているなら、次に開いたとき見つけられること。

単に `setItem()` が成功する正常系だけでなく、**途中のどの書き込み点で止まっても silent loss を起こしにくい保存構造**へ進めた。
