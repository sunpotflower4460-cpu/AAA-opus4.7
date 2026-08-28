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

場合、その raw を `RECOVERY_CONFLICT_BACKUP_KEY` へ確定してから journal / backup / primary の更新へ進む。

専用退避に失敗した場合は force-save 自体を中止し、primary と通常 backup を上書きしない。

### 回帰

- hidden recovery backup が専用 conflict backup に残ること
- 専用退避の quota failure では force-save が失敗し、既存 primary / backup / pending 状態を破壊しないこと

## 修正2 — local recovery candidate があっても native を安全確認する

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

## 修正3 — cross-layer candidate の明示切替

local と native が異なる場合、recovery banner に native の別候補があることを表示する。

- `端末内の別候補を見る`
- `元の復元候補に戻す`

で表示 snapshot を切り替えられる。

空配列 native snapshot も「全削除済み」の正当な別候補として扱うため、件数0でも `null` と区別して候補を表示できる状態設計にしている。

表示中 snapshot を明示保存した時だけ canonical localStorage へ force-save し、成功後に native durability layer も追従させる。

## 修正4 — clean runtime で recovery 状態へ遷移した場合も native 再確認

起動時だけでなく、storage event / resume reconciliation で clean tab が local recovery candidate を検出した時にも native safety probe を再実行する。

これにより、アプリ起動後に primary が消失/破損して local backup が recovery candidate になったケースでも、native に別世代があれば見落とさない。

## 主な検証

Phase 39 専用 full validation で以下を確認。

- production dependency audit: 0 vulnerabilities
- typecheck: pass
- lint: pass
- 19 test files / 144 tests pass
- build: pass
- `npx cap sync ios`: pass
- committed iOS drift: none

追加回帰には以下を含む。

- BACKUP_KEY-only hidden candidate の force-save 前退避
- hidden candidate 退避失敗時の destructive overwrite 防止
- startup local recovery + distinct native alternative
- local/native candidate の明示切替
- native read error 中の force action 非表示
- Retry 後の local candidate 解放
- clean runtime recovery transition 後の native alternative 再確認

## 意図的に自動化しなかったこと

### note 単位の自動 merge

行わない。削除 tombstone / revision が無いため、古い candidate にだけ存在する note を union すると、ユーザーが削除済みの note を復活させる可能性がある。

### native candidate の自動優先

行わない。native は recovery insurance であり、localStorage の同期 conflict contract を置き換えない。

## 残る重要課題

### 1. dirty tab + remote recovery + native alternative の三者競合

Phase 39 の明示 cross-layer chooser は startup と clean runtime recovery を対象にしている。

ローカル画面に未保存編集がある最中に、別タブ/外部要因で保存先が recovery 状態へ変化した場合は、現在画面を勝手に remote candidate へ置換しない既存ルールを優先している。

storage 層では pending/current/recovery backup を force-save 前に保護するよう強化したが、この dirty 三者競合を UI で全候補比較できるところまでは未実装。次フェーズで `screen / local recovery / native` を別候補として保持・比較する設計を優先する。

### 2. conflict backup archive のユーザー向け復元導線

`CONFLICT_BACKUP_KEY` / `SECONDARY_CONFLICT_BACKUP_KEY` / `RECOVERY_CONFLICT_BACKUP_KEY` は destructive overwrite 防止用の退避として存在するが、通常の `loadNotes()` が常にこれらを自動復元すると意図的に捨てた旧版を再浮上させる危険がある。

必要なら「通常復旧とは分離した明示 Recovery History」として扱うべきで、通常起動時の自動 merge には使わない。

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
