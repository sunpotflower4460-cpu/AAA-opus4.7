# Phase 39 — Cross-Layer Recovery Choice Hardening Report

## 目的

Phase 38 で `localStorage` と iOS native filesystem の二層耐久化を導入した後も、両層に異なる正常世代が残った場合に一方を見えないまま失わないことを目的とする。

最優先原則は次の3点。

1. local / native の候補を自動 merge しない
2. ユーザーが確認していない候補を force-save で黙って破棄しない
3. native の安全確認が終わる前に canonical save を許可しない

自動 merge を避ける理由は、現行 Note schema に tombstone / revision が無く、`updatedAt` ベースの union では削除済みメモを復活させ得るため。

## 修正1 — force-save 前の hidden local recovery backup 保護

### 問題

Phase 38 までの `saveNotes(..., { force: true })` は、未採用 pending と現在の正常 primary は conflict backup へ退避していたが、`BACKUP_KEY` だけに残る別世代の正常 recovery candidate は専用退避せず、その後の保存で `BACKUP_KEY` を新版へ更新していた。

primary が消失/破損して `BACKUP_KEY` が唯一の正常候補だったケースでは、未確認候補を失う可能性があった。

### 修正

`zanshin.notes.recovery.conflict.backup.v1` を追加した。

force-save 時に既存 `BACKUP_KEY` が:

- 構造正常
- 今回保存する snapshot と異なる
- pending candidate と異なる
- current valid primary candidate と異なる

場合、その raw を recovery conflict archive へ確定してから journal / backup / primary の更新へ進む。

専用退避に失敗した場合は force-save 自体を中止し、primary と通常 backup を上書きしない。

## 修正2 — recovery archive の既存世代を上書きしない

### 問題

最初の Phase 39 実装では `RECOVERY_CONFLICT_BACKUP_KEY` にすでに未確認世代が存在していても、次の recovery force-save で新候補を同じキーへ書き、古い archive を失う可能性があった。

CodeRabbit の data-integrity review でも同じ問題が指摘された。

### 修正

`zanshin.notes.recovery.conflict.secondary.backup.v1` を追加した。

新しい hidden recovery candidate を退避する際は:

- primary recovery archive が空ならそのまま保存
- primary recovery archive に同じ候補があれば重複保存しない
- primary recovery archive に別の正常世代があれば、その既存世代を secondary recovery archive に退避してから新候補を primary recovery archive へ保存
- primary / secondary の両方に別の正常世代があり、新候補が3つ目の異なる世代なら force-save を `conflict` で中止

とした。

3世代目を保存する空きがない時は「どれかを捨てて保存を続ける」のではなく、primary / BACKUP_KEY / pending journal を更新せず安全側で停止する。

### 回帰

- 既存 recovery archive が secondary へ残ること
- 新しい recovery candidate が primary recovery archive に残ること
- archive 2枠が別世代で埋まっている場合、3世代目を捨てず force-save が停止すること
- 退避 storage write の quota failure で既存 primary / backup を破壊しないこと

## 修正3 — backup-only の空配列を fresh install と誤認しない

### 問題

primary が消失し `BACKUP_KEY` に valid `[]` が残る場合、以前は `{ ok: true, notes: [] }` として fresh install 相当へ落としていた。

しかし `[]` は「ユーザーが全メモを削除した状態を保存した」という正当な世代でもある。native 側に古いメモが残っている場合、local の全削除状態を候補として選べず、削除済みデータを再採用する危険があった。

CodeRabbit review でもこの点が指摘された。

### 修正

primary missing + valid backup が存在する場合は、件数0を含め常に:

- `ok: false`
- `reason: "missing_primary"`
- `recoveredFromBackup: true`
- `recoveryCandidate: true`

として明示 recovery candidate にする。

local `[]` と native の非空 snapshot が異なる場合も、双方を別候補として保持し、ユーザーが明示的に切り替えて local 全削除状態を canonical として確定できる。

## 修正4 — local recovery candidate があっても native を安全確認する

### 問題

Phase 38 では startup `loadNotes()` がすでに local recovery candidate を返している場合、native probe を省略していた。

この場合、native primary/backup に異なる正常世代が残っていても画面に出ず、local candidate を確定した後の native rotation で見えない候補が将来失われ得た。

### 修正

native platform では local recovery pending 自体も startup native safety probe の対象にした。

native probe 完了までは:

- edit/save guard を維持
- recovery force-save action を表示しない
- native read error を fresh install / no-alternative とみなさない

local candidate が再確認時にも存在する場合:

- local candidate を第一表示のまま維持
- native が同一 snapshot なら二重候補にしない
- native が異なる正常 snapshot なら別候補として保持
- native error / localStorage unavailable なら解決操作を止め Retry を要求
- local/native を自動 merge しない

## 修正5 — cross-layer candidate の明示切替

local と native が異なる場合、recovery banner に native の別候補があることを表示する。

- `端末内の別候補を見る`
- `元の復元候補に戻す`

で表示 snapshot を切り替えられる。

空配列 local/native snapshot も「全削除済み」の正当な候補として扱い、件数0でも `null` と区別する。

表示中 snapshot を明示保存した時だけ canonical localStorage へ force-save し、成功後に native durability layer も追従させる。

## 修正6 — clean runtime で recovery 状態へ遷移した場合も native 再確認

起動時だけでなく、storage event / resume reconciliation で clean tab が local recovery candidate を検出した時にも native safety probe を再実行する。

これにより、アプリ起動後に primary が消失/破損して local backup が recovery candidate になったケースでも、native に別世代があれば見落とさない。

## 修正7 — probe 中に正常 primary が戻った後の stuck recovery を解消

### 問題

local recovery candidate を確認する native probe の途中で、別タブ等から primary が正常状態へ戻るケースがある。

以前の Phase 39 実装は現在の正常 primary を採用しても `externalConflict` 等の recovery state を完全には解除していなかったため、内容は正常正本へ戻っているのに recovery banner と save guard だけが残る可能性があった。

表示中 recovery candidate と戻った primary が同一 snapshot の時は、`applyCleanRemoteNotes()` の no-op 判定により特に再現しやすかった。

### 修正

正常 primary を canonical として再採用する branch で、次を同時に正規化する。

- native recovery gate / save guard
- dirty state / dirty timestamp
- baseline / latest snapshot refs
- external conflict ref/state
- recovery candidate refs/source/count
- save result / load error
- `canLoadStoredNotes`

その後 native durable snapshot を同じ canonical snapshot へ追従させる。

回帰では、recovery candidate と完全に同じ内容の primary が probe 中に戻った場合でも banner が消え、その後の編集・autosaveが正常に再開することを確認した。

## 主な検証

最終 Phase 39 full validation と source-only 通常CIで以下を確認。

- production dependency audit: 0 vulnerabilities
- typecheck: pass
- lint: pass
- 19 test files / **148 tests pass**
- build: pass
- `npx cap sync ios`: pass
- committed iOS drift: none
- temporary validation workflow / patch script は最終 branch から撤去済み
- current source-only head の push Check: success
- current source-only head の PR Check: success

追加回帰には以下を含む。

- BACKUP_KEY-only hidden candidate の force-save 前退避
- hidden candidate 退避失敗時の destructive overwrite 防止
- recovery archive 既存世代の secondary 退避
- recovery archive 2枠満杯時の3世代目 force-save拒否
- backup-only `[]` を全削除済み recovery candidate として保持
- local `[]` + distinct native notes の明示切替・local全削除確定
- startup local recovery + distinct native alternative
- local/native candidate の明示切替
- native read error 中の force action 非表示
- Retry 後の local candidate 解放
- clean runtime recovery transition 後の native alternative 再確認
- probe 中の canonical primary 復帰で recovery state を完全解除

## レビュー結果

CodeRabbit から出た以下2件の data-integrity 指摘は実コード上で再現可能と判断し、両方修正・回帰追加・thread resolve 済み。

1. backup-only `[]` が local recovery candidate として表に出ない
2. 既存 `RECOVERY_CONFLICT_BACKUP_KEY` が次の force-save で上書きされる

Codex PR code review は利用上限に達しており今回の外部レビューには使えていない。これはCI/コード失敗ではない。

## 意図的に自動化しなかったこと

### note 単位の自動 merge

行わない。削除 tombstone / revision が無いため、古い candidate にだけ存在する note を union すると、ユーザーが削除済みの note を復活させる可能性がある。

### native candidate の自動優先

行わない。native は recovery insurance であり、localStorage の同期 conflict contract を置き換えない。

## 残る重要課題

### 1. dirty tab + remote recovery + native alternative の三者競合

Phase 39 の明示 cross-layer chooser は startup と clean runtime recovery を対象にしている。

ローカル画面に未保存編集がある最中に、別タブ/外部要因で保存先が recovery 状態へ変化した場合、現行 storage event path は画面の dirty snapshot を守るため remote recovery candidate を自動適用しない。

この時点では remote recovery candidate を chooser 用 ref に登録せず、native safety probe も開始しないため、`screen / local recovery / native` の3候補をUIで比較できない。

単純に既存 `registerLocalRecoveryCandidate()` を呼ぶと、active source と `useLayoutEffect` の関係で dirty screen が remote candidate ref を上書きし得るため危険。

次フェーズでは:

- dirty screen snapshot
- remote local recovery snapshot
- native recovery snapshot

を独立した候補として保持し、自動 merge / 自動採用せず明示選択させる状態機械へ拡張する。

### 2. conflict / recovery archive のユーザー向け復元導線

`CONFLICT_BACKUP_KEY` / `SECONDARY_CONFLICT_BACKUP_KEY` / `RECOVERY_CONFLICT_BACKUP_KEY` / `RECOVERY_CONFLICT_SECONDARY_BACKUP_KEY` は destructive overwrite 防止用の退避として存在するが、通常 `loadNotes()` はこれらを recovery history として一覧化していない。

保存層では未確認世代の物理的消失を防いでいる一方、ユーザーが後から archive を確認・選択する正式導線は未実装。

通常起動時に全部を自動 merge すると、意図的に捨てた旧版や削除済みメモを再浮上させるため、次段では通常 recovery と分離した明示 `Recovery History` として扱うのが安全。

### 3. transactional multi-tab CAS

localStorage は複数キーを原子的に commit できないため、完全同時 write の理論 race は残る。pending journal と baseline conflict detection で大幅に縮小しているが、完全な transaction ではない。

### 4. 実機 iPhone / Simulator

引き続き実測が必要。

- force terminate → relaunch recovery
- background / suspend / memory pressure
- keyboard / safe area
- vertical read mode
- TestFlight archive / install / relaunch

Phase 39 は「候補を増やして自動的に混ぜる」のではなく、「見えていない候補を消さず、ユーザーに明示してから canonical を決める」方向で recovery contract を強化する。
