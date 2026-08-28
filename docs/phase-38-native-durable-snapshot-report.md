# Phase 38 — Native Durable Snapshot Hardening Report

## 目的

Zanshin の既存保存は `localStorage` を主系としており、Phase 31–37 で競合検知・中断保存復旧・lifecycle flush・Retry を強化してきた。

Phase 38 ではその同期保存契約を置き換えず、iOS native 環境だけに独立した耐久スナップショット層を追加した。目的は、WKWebView / OS 側の Web Storage 消失・破損時にも、最後に正常保存できたメモを復元候補として提示できるようにすること。

## 実装概要

### 1. Capacitor Filesystem による native 二世代保存

`@capacitor/filesystem@7.1.8` を固定し、`Directory.LibraryNoCloud` に次の3ファイルを持つ。

- `zanshin/notes.snapshot.v1.json` — current primary
- `zanshin/notes.snapshot.backup.v1.json` — 直前の正常 primary
- `zanshin/notes.snapshot.corrupt.v1.json` — 読めたが構造破損していた primary の best-effort 退避

通常の `localStorage` 保存が成功した後だけ native snapshot を更新する。native 側の失敗は localStorage の成功を取り消さない。

### 2. 書き込み順序の固定

native 保存は module-level Promise chain で直列化した。

これにより、短時間に複数保存が発生しても、先に呼ばれた古い write が遅れて完了して新しい内容を巻き戻すことを防ぐ。

更新時は次の順序を守る。

1. current native primary を読む
2. current が正常なら backup に確定する
3. current が破損していれば corrupt へ best-effort 退避する
4. new primary を書く

backup 確定に失敗した場合は new primary へ進まない。

### 3. 「不存在」と「読込失敗」を分離

Filesystem の read error を一律「ファイルなし」と扱うのを禁止した。

- `OS-PLUG-FILE-0008` のみ `missing`
- 正常読込は `ok`
- それ以外の I/O / permission / plugin failure は `error`

保存時に current primary が `error` なら処理を中止し、primary / backup のどちらにも書き込まない。これにより、一時的な読込障害を初回保存と誤認して既存世代を保護せず上書きする経路を閉じた。

復旧読み取りでは primary が missing / corrupt / read error の場合でも backup を独立に読む。ただし読み取り専用であり、自動的に localStorage へ書き戻さない。

### 4. localStorage 消失時の明示復旧

native 起動時に次の条件を満たす場合だけ native snapshot を画面へ復元候補として表示する。

- native snapshot が有効かつ空でない
- localStorage primary が missing または invalid
- 現在の画面が dirty ではない
- 既存の conflict / recovery が進行中ではない

候補を表示しても自動保存はしない。既存の recovery UI を使い、ユーザーが確認した後に明示確定する。

正常な既存 localStorage がある初回 Phase 38 起動では、その baseline を native durable layer へ移行する。

### 5. canonical adoption と native snapshot の同期

localStorage に存在する正常データをアプリが「正本」として正式採用した経路でも、native durable snapshot を同じ内容へ追従させる。

対象:

- clean 状態で `storage` event により別タブの正常版へ追従した場合
- `pageshow` / foreground reconciliation などで正常な保存先を再読込した場合
- conflict UI でユーザーが「保存されている方」を明示採用した場合

一方、missing / invalid primary から見つかった recovery candidate は未確定なので、この同期経路には入れない。

この区別により、ユーザーが競合解決で捨てた古い local 版が native snapshot に残り、その後 Web Storage が消失した際に復元候補として再浮上する「捨てたデータの復活」を防ぐ。

### 6. Web runtime の完全スキップ

`Capacitor.isNativePlatform()` を共通 availability gate にした。

通常 Web runtime では native Filesystem read/write だけでなく、その Promise callback による React state update 自体を開始しない。これにより Web 動作への不要な非同期副作用とテスト時の `act()` warning 再発を防ぐ。

### 7. native backup failure UI

localStorage 本体が成功して native 予備保存だけ失敗した場合は、メモ本体の保存成功を否定せず、端末内予備保存のみ失敗したことを明示する。

安全条件を満たす場合のみ「予備保存をもう一度作る」Retry を出す。dirty / conflict / recovery 中は Retry を許可しない。

## Apple Privacy Manifest

Filesystem plugin 導入に伴い `ios/App/App/PrivacyInfo.xcprivacy` を追加し、Xcode Resources に明示登録した。

宣言:

- tracking: false
- collected data types: none
- accessed API category: `NSPrivacyAccessedAPICategoryFileTimestamp`
- reason: `C617.1`

`npx cap sync ios` 後も Podfile / privacy manifest / Xcode resource registration が維持されることを CI で確認する。

## 回帰テスト

Phase 38 では次を追加・更新した。

- Web では native filesystem に触れない
- 初回 native primary 作成
- 更新前に旧 primary を backup へ確定
- 同一 snapshot は no-op
- corrupt primary から valid backup へ fallback
- primary write failure 後も旧 backup を保持
- async 保存呼出順を直列化し stale overwrite を防止
- primary read の非存在コードだけ初回扱い
- non-missing read failure では primary に触れず保存失敗
- primary read failure 時も valid backup を read-only recovery candidate として取得可能
- localStorage primary health 判定
- native recovery の App integration
- clean な正常外部版を採用した際の native canonical sync
- conflict で保存済み版を明示採用した際の native canonical sync
- native backup failure / safe retry UI

## 検証中に捕捉した問題

Phase 38 の実装中に以下を検出し、そのまま green 扱いせず修正した。

1. Retry 表示条件で React ref を render 中に読む lint violation
2. async serialization test が任意の1 microtask待機に依存していた不安定テスト
3. native Promise が通常 Web test に state update を持ち込み `act()` warning を再発させる問題
4. Filesystem read error をすべて missing とみなすことで、既存 native primary を保護せず上書きし得る耐久性バグ
5. conflict / external update で正常な保存済み版を正式採用しても native snapshot が追従せず、後の localStorage 消失時に捨てた古い版が復元候補として再浮上し得るデータ復活バグ

## Phase 38 後も残る事項

- 実機 iPhone / Simulator での force terminate → relaunch → native recovery 実測
- background / suspend / memory pressure 下での snapshot 完了確認
- WKWebView safe area / keyboard / vertical read mode の実機確認
- TestFlight archive / install / relaunch 確認
- 完全同時 multi-tab write に対する transactional CAS は未解決
- broader dev/toolchain audit の既知 vulnerability は別途更新判断が必要。production dependency high+ gate は継続する

Phase 38 は native durable layer を「主保存」にはせず、既存の同期 localStorage conflict contract に対する独立した復旧保険として扱う。
