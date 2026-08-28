# Phase 32 — Lifecycle Recovery / Interrupted Save Hardening

## 目的

Phase 31 では、複数タブ・複数画面からの stale overwrite を保存直前比較と競合UIで止めた。

Phase 32 ではさらに、**保存処理そのものが途中で失敗・中断した場合**と、**iOS/WKWebView の suspend / resume や lifecycle 境界**で最新の言葉を失う可能性を重点的に潰す。

残心では、保存成功率を上げるだけでなく、失敗時に存在する版を黙って捨てず、ユーザーが選択できることを品質基準にする。

---

## 発見した主要リスク

### 1. backup と primary の二段書き込みだけでは途中中断を判定できない

最新版を backup → primary の順で保存すると、primary 書き込みで失敗した場合は backup に最新版が残る。

しかし再起動時に primary 自体が正常な旧版だと、単純な loader は primary を正常扱いして最新版 backup を見ない。

結果として「最新版は残っているのに復旧候補へ出せない」状態が起こり得る。

### 2. backup 書き込み失敗後に primary だけ進めると復旧保証が崩れる

保存成功なのに recovery backup が古い状態を作らないため、backup の確定を primary より先にし、backup 失敗時は primary へ進まない必要がある。

### 3. force overwrite 時の別画面版を通常 backup と混ぜると役割が衝突する

通常 backup は「現在採用されている最新版の mirror」であるべき。

一方、競合時にユーザーがローカル版を明示優先した場合は、上書きされる remote 版も残したい。

そのため通常 mirror と競合退避を分離した。

### 4. pending journal が current primary と無関係になるケース

通常の中断では `primary == journal.baseRaw`、完了済みcleanup失敗では `primary == journal.nextRaw` になる。

しかし旧バージョン混在、外部書換え、極めて近い複数writerの競合などでは、**primary が base / next のどちらとも一致しない孤立 journal** が残り得る。

この状態を「正常primaryがあるから」と無視すると、次の保存が journal を上書きし、未確定候補を silent discard できてしまう。

Phase 32 最終版では孤立 journal も recovery conflict として表へ出す。

### 5. recovery candidate を優先表示するだけでは、正常な保存済み版を選べない

保存途中の next を画面へ表示するのは安全側だが、ユーザーが「直前まで確定していた primary に戻したい」場合もある。

そのため正常primaryが存在する中断保存では、

- 中断候補を採用する
- 保存済みprimaryを採用する

の二択を出す。

選ばれなかった版は退避してから解決を確定する。

### 6. 3版競合では conflict backup 1枠だけでは不足する

孤立 pending B、current primary C、画面上の local D が同時に存在し、Dをforce採用する場合、BとCの両方を残す必要がある。

そのためsecondary conflict backupを追加した。

### 7. iOS/WKWebView では storage event だけに依存できない

長時間 suspend や background / foreground 復帰では、通常Webタブと同じタイミングで storage event を受け取ることを前提にしにくい。

`pageshow` / `visibilitychange` 復帰時にも、ローカル未編集なら保存先を再確認する。

### 8. 連続入力で debounce が無限に後ろ倒しされる

500ms debounce だけだと、500ms未満の間隔で入力が続く限り保存されない。

モバイルで長文入力中に突然 background / terminate が起きることを考え、最大待機時間を設けた。

### 9. Phase 31 の旧 backup semantics から安全に移行する必要がある

Phase 31 の backup は「1世代前を退避する」意味を含んでいた。

Phase 32 では通常 backup を「最新正常状態の mirror」に変更したため、更新直後の既存端末でも安全に移行する必要がある。

---

## 保存領域

### primary

`zanshin.notes.v1`

現在確定しているデータ。

### latest-valid mirror

`zanshin.notes.backup.v1`

現在採用されている最新正常状態の mirror。

### primary conflict backup

`zanshin.notes.conflict.backup.v1`

競合解決で採用しなかった最優先候補を保持する。

### secondary conflict backup

`zanshin.notes.conflict.secondary.backup.v1`

pending候補とcurrent primaryの両方を退避する必要がある3版競合時に、もう一方の正常版を保持する。

### pending save journal

`zanshin.notes.pending.v1`

保存開始時の `baseRaw` と保存予定の `nextRaw` を記録する。

### corrupt raw backup

`zanshin.notes.corrupt.backup`

破損primaryのrawを可能な範囲で退避する。

---

## 実装

### 1. 保存 journal

保存開始前に以下を記録する。

- version
- writerId
- baseRaw
- nextRaw

判定:

- primary == nextRaw → primary保存完了済み。backup修復 + journal cleanup
- pendingが存在しprimary != nextRaw → nextをrecovery candidateとして表へ出す
- primaryが正常なら `storedPrimaryAvailable=true` とし、保存済み版も選択可能にする
- primaryがbase/nextのどちらとも違う孤立journalも黙って無視しない

空配列の `nextRaw` も「全削除を保存しようとした」という正当な候補なので、件数ではなく `recoveryCandidate` フラグで扱う。

### 2. writerId による保存元の識別

同じ画面自身が途中保存に失敗した後、さらに入力した場合まで永遠に conflict へ固定しないため、画面ごとの `writerId` を journal に保持する。

- 同一 writer + active journal → より新しい編集への再試行を許可
- 別 writer → conflict
- owner-less journal → 保守的に扱う
- orphaned journal → writerに関係なく通常保存では上書きしない

### 3. backup-first persistence

通常保存の順序:

1. journal を記録
2. latest-valid backup を確定
3. primary を確定
4. journal を削除

backup失敗時はprimaryへ進まない。

primary失敗時はjournal + backupにnext候補が残る。

cleanupのみ失敗した場合は、次回ロードでprimary == nextRawを確認して自己修復する。

### 4. 中断保存の二択 recovery

正常primaryが存在する場合は、画面ではpending nextを先に見せながら、次の2択を出す。

1. 保存済みprimaryを採用
2. 表示中の中断候補を採用

#### primary を採用する場合

確定順序:

1. pending next を conflict backupへ退避
2. current primary を latest-valid backupへmirror
3. pending journalを削除
4. UIをprimaryへ切り替える

途中で失敗した場合はjournalを残し、候補を再提示できる状態を維持する。

#### pending candidate を採用する場合

force saveとして扱う。

candidateと異なる正常primaryがあれば、それをconflict backupへ退避してからcandidateをprimary + latest mirrorへ確定する。

### 5. 3版競合の退避

orphan pending B + current primary C + local D があり、Dをforce採用する場合:

1. B → conflict backup
2. C → secondary conflict backup
3. D → pending journal
4. D → latest-valid backup
5. D → primary
6. journal cleanup

必要な退避に失敗した場合はDへの上書きを開始しない。

### 6. Phase 31 backup の安全な移行

正常primaryをロードしpendingが無い場合、通常backupがprimaryと一致していなければ最新版mirrorへ更新する。

Phase31の旧backupが正常で、conflict backupが空なら旧版をそこへ残してからmirrorを更新する。

### 7. runtime recovery

実行中にprimaryだけ消えた場合も、clean画面ではbackupを復元候補として表示する。

自動保存は再開せず、ユーザーが確認して明示保存するまでguardを維持する。

### 8. resume refresh

- `pageshow`
- `visibilitychange` でvisibleへ戻った時

clean状態なら`loadNotes()`を再実行する。

dirty状態ではremoteを勝手に採用せず、保存境界で競合を検知する。

### 9. debounce max wait

通常debounceは500ms。

dirty区間が続いても最大3秒で途中保存を試す。

### 10. lifecycle duplicate flush guard

`pagehide` / `beforeunload` 等が近接しても、成功保存後にdirty flagを落とし、同一snapshotを重複保存しない。

---

## 異常系の保証

### journal書き込み失敗

backup / primaryを変更しない。

### recovery backup書き込み失敗

primaryを変更しない。journalにnext候補を残す。

### primary書き込み失敗

旧primaryを維持し、journal + backupからnextを復旧候補として提示する。

### completed journal cleanup失敗

primary == nextRawを確認して次回ロードで再修復できる。

### primary recovery時のcandidate退避失敗

primary採用を確定しない。journalを残す。

### primary recovery時のmirror更新失敗

primary採用を確定しない。journalを残す。

### primary recovery時のjournal削除失敗

candidate conflict backupとprimary mirrorを保持しつつ、journalも残すため再度候補を提示できる。

### force時の競合退避失敗

primary overwriteを開始しない。

---

## 回帰テスト

Phase 32ではstorage / App / StrictModeの回帰テストを大幅追加した。

### storage

以下を含む。

- 正常保存後にjournalが残らない
- primary / backupが同じ最新版になる
- journal書き込み失敗時にprimary / backupを変更しない
- backup失敗時にprimaryを変更しない
- primary失敗時にjournal + backupから復旧候補を返す
- empty array保存中断でも全削除意図を保持
- cleanup失敗後のcompleted journal自己修復
- 不正journalが正常primaryを壊さない
- 別writerのactive journalを通常保存で上書きしない
- 同一writerのactive journalを安全に再試行
- orphaned journalを正常primaryがあっても無視しない
- orphaned journal存在中は通常保存でjournalを上書きしない
- 保存済みprimary採用時にpending候補を退避
- candidate退避失敗時は解決を確定しない
- primary mirror失敗時もjournalを残す
- journal削除失敗時も候補を再提示可能
- 3版force時にpending/currentの両方を別backupへ保持
- pending candidate採用時に直前primaryを退避
- Phase31旧backupをPhase32 mirror semanticsへ移行
- 将来unknown field差分も競合検知

### App / StrictMode

以下を含む。

- 長時間連続入力でも3秒以内に途中保存
- pagehide連続発火で重複保存しない
- clean画面はstorage eventでremoteへ追従
- primary消失時はruntime recovery candidateを表示
- pageshow復帰時に取りこぼしたremote更新へ追従
- dirty状態の復帰ではremoteを勝手に採用しない
- storage eventがなくても保存境界で競合検知
- force overwrite時にremoteを専用退避
- 専用退避失敗時にremoteを保持して競合状態を継続
- interrupted candidateと保存済みprimaryの二択を表示
- pending candidate採用時に旧primaryを退避
- primary採用時にpending candidateを退避
- empty candidateでも自動的に旧メモを復活させない

---

## CI hygiene / review

GitHub Actions:

- `actions/checkout@v4` → `actions/checkout@v7`
- `actions/setup-node@v4` → `actions/setup-node@v7`
- project Node 22を維持
- production audit gateを維持
- CodeRabbitの指摘を受け、checkoutに`persist-credentials: false`を追加

repository-controlledな`npm ci` / `npm run check`へ不要なcheckout credentialを残さない。

production dependency gate:

```bash
npm audit --omit=dev --audit-level=high
```

は0 vulnerabilitiesで通過している。

一方、dev/toolingを含む`npm ci`全体では12 vulnerabilities（2 low / 1 moderate / 9 high）が表示されるため、全依存解消済みとは扱わない。

CodeRabbitのレビューではmerge riskはLow。Docstring coverage警告は、TS/Reactの内部関数へ80% docstringを要求するreview設定由来であり、機能・安全性の問題ではないため、無意味なコメント増加は行わない。

---

## 意図的に残している限界

### localStorage の完全な atomic transaction ではない

journalにより途中中断への復旧性は大幅に上がったが、localStorage自体には複数タブ横断のcompare-and-set transactionがない。

理論上は複数writerが極めて近接して検証・書き込みする競合余地は残る。

完全に閉じる候補:

- Web Locks API
- revision / generation token
- IndexedDB transaction

### localStorage容量コスト

安全性のためprimary・mirror・pending・競合退避を持つため、単一コピーより容量を使う。

現時点ではsilent loss回避を優先している。大規模データへ拡張する場合はIndexedDB等への移行が適切。

### iOS native project はまだ検証対象外

repositoryには`ios/` native projectがまだ存在せず、Web CI greenはXcode / WKWebView / TestFlightの再現性保証ではない。

次フェーズでは以下を優先する。

- Capacitor dependencies / configの再現可能性
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

> 保存の途中でアプリが止まっても、存在する正常版・中断版を黙って捨てず、再起動後にユーザーが選べること。

単に`setItem()`が成功する正常系ではなく、**途中のどの書き込み点で止まっても silent loss を起こしにくく、複数候補がある場合は未採用版も退避してから確定する保存構造**へ進めた。
