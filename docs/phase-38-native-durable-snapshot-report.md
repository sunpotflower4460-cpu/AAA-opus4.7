# Phase 38 — Native Durable Snapshot Hardening Report

## 目的

Zanshin の `localStorage` を主保存のまま維持しつつ、iOS native 側に独立した耐久スナップショットを持たせる。WKWebView / OS 側の Web Storage 消失・破損・一時利用不能が起きても、既存データを新規状態と誤認して上書きしないことを最優先とする。

## 実装概要

### 1. Capacitor Filesystem の二世代保存

`@capacitor/filesystem@7.1.8` を固定し、`Directory.LibraryNoCloud` に次を持つ。

- `zanshin/notes.snapshot.v1.json` — current primary
- `zanshin/notes.snapshot.backup.v1.json` — 直前の正常 primary
- `zanshin/notes.snapshot.corrupt.v1.json` — 破損 primary の best-effort 退避

正常な `localStorage` 保存または正本採用の後だけ native snapshot を更新する。native 側の失敗は localStorage の保存成功を取り消さない。

### 2. native write の直列化と世代保護

module-level Promise chain で native write の呼出順を固定する。古い非同期 write が後から完了して新版を巻き戻すことを防ぐ。

更新順序は以下。

1. current native primary を読む
2. current が正常なら backup を確定する
3. current が破損なら corrupt へ best-effort 退避する
4. new primary を書く

正常 primary の backup 確定に失敗した場合は new primary へ進まない。

### 3. missing と read error を分離

Filesystem の read failure を一律 missing と扱わない。

- `OS-PLUG-FILE-0008` のみ `missing`
- 正常読込は `ok`
- それ以外の I/O / permission / plugin failure は `error`

保存時に current primary が `error` なら既存世代へ触れず保存を中止する。復旧読込では primary に問題があっても backup を独立に確認し、正常 backup があれば read-only recovery candidate として返す。

### 4. startup recovery gate

native 実行時、local primary が `missing` / `invalid` / `unavailable` で、local 側にすでに確定した recovery candidate が無い場合は native safety probe が終わるまで編集と保存を gate する。

これにより、native read が 500 ms autosave より遅い場合でも、新規編集が先に local primary を作って古い native snapshot を回転・消失させる経路を防ぐ。

- native `available` — 空配列も含め、明示 recovery candidate として表示する
- native `error` — fresh install とみなさず編集・保存を止め、Retry を表示する
- localStorage 自体が `unavailable` — native の有無だけでは新規状態と判断せず、localStorage が再確認できるまで止める
- local primary `invalid` + native `missing` — fresh install とみなさず、破損 local state の明示確認を要求する
- local primary `missing` + native primary/backup `missing` を両方正常確認できた場合だけ fresh install として編集を解放する

### 5. canonical adoption と native 同期

アプリが正常 localStorage を正本として正式採用した時は native snapshot も同じ内容へ追従させる。

対象:

- clean 状態で別タブの正常版へ追従
- `pageshow` / foreground reconciliation で正常版を再採用
- conflict UI で「保存されている方」を明示採用

未確定 recovery candidate はこの同期経路へ入れない。ユーザーが捨てた local 版が native に残り、後の Web Storage 消失時に再浮上する経路を防ぐ。

### 6. Web runtime の完全スキップ

`Capacitor.isNativePlatform()` を availability gate にし、Web runtime では Filesystem read/write とそれに伴う React state update を開始しない。

### 7. native backup failure UI

localStorage 本体が保存済みで native 予備保存だけ失敗した場合は非致命 warning として表示する。Retry は clean / 非 conflict / 非 recovery の時だけ許可し、編集開始時に即座に無効化する。

## Apple Privacy Manifest

`ios/App/App/PrivacyInfo.xcprivacy` を追加し Xcode Resources に登録した。

- tracking: false
- collected data types: none
- accessed API category: `NSPrivacyAccessedAPICategoryFileTimestamp`
- reason: `C617.1`

CI で `npx cap sync ios` 後の committed iOS project drift を検査する。

## 主な回帰テスト

- Web runtime では native filesystem に触れない
- native primary 初回作成 / backup rotation / corrupt fallback
- primary read error と missing の区別
- primary read error 時の destructive write 防止
- primary write failure 後の旧世代保持
- async native write の呼出順直列化
- local primary health 判定
- native read 遅延中の編集・autosave禁止
- native read error の Retry と fresh-install誤認防止
- native空配列を「全削除済み」の有効な recovery candidate として扱う
- localStorage API 一時利用不能時の startup gate
- local primary破損 + native不存在時の明示 recovery 維持
- clean external canonical adoption の native sync
- conflict「保存済み版を採用」後の native sync
- native backup Retry の dirty 時即時無効化

## Phase 38 中に検出・修正した問題

1. Retry 表示条件で React ref を render 中に読む lint violation
2. async serialization test の不安定な microtask 待ち
3. Web test に native Promise が入り `act()` warning を再発させる問題
4. Filesystem read error を missing と誤認し既存 native 世代を保護せず上書きし得る問題
5. 正常外部版・保存済み版の正式採用後に native が追従せず、捨てた版が後で復活し得る問題
6. native recovery probe 中にも編集可能で、autosave が先に走り復旧候補を失い得る問題
7. native read failure を fresh install と誤認し得る問題
8. native backup Retry が dirty 後も表示され inert button になる問題
9. localStorage API 自体の一時利用不能が startup native gate の対象外だった問題
10. local primary破損 + native missing を fresh install 相当に解放し得る問題

## Phase 38 後も残る事項

- 実機 iPhone / Simulator での force terminate → relaunch → native recovery 実測
- background / suspend / memory pressure 下での async native snapshot 完了確認
- WKWebView safe area / keyboard / vertical read mode の実機確認
- TestFlight archive / install / relaunch 確認
- 完全同時 multi-tab write に対する transactional CAS
- broader dev/toolchain audit の既知 vulnerability 更新判断。production dependency high+ gate は継続する
- **cross-layer recovery alternatives**: localStorage 自身が recovery candidate を持つ起動では、現在はその候補を優先して native probe を重ねない。native に別の正常世代が残っている可能性はあるが、単純な note 単位 merge は削除を復活させ得るため行わない。必要なら次フェーズで「候補を別々に提示する」「tombstone / revision を導入する」設計として扱う。

Phase 38 の native durable layer は主保存ではなく、既存の同期 localStorage conflict contract に対する独立した復旧保険として扱う。
