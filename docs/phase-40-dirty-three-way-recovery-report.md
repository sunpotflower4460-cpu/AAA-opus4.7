# Phase 40 — Dirty three-way recovery and native snapshot hardening

## Scope

Phase 40 focuses on recovery states where the app can simultaneously have:

1. unsaved edits currently visible on screen,
2. a different localStorage recovery candidate, and
3. a different native Filesystem recovery candidate.

The safety rule is that these candidates must never be silently merged or silently overwrite one another. The user must be able to inspect the candidates and explicitly choose what to commit.

## Changes

### 1. Screen / local / native candidates are independent

`App.tsx` models recovery candidates as three independent sources:

- `screen` — dirty, unsaved contents visible when the conflict was detected
- `local` — the recovery candidate found in localStorage
- `native` — an alternative candidate found in the Capacitor Filesystem snapshot

Each source has its own ref. Switching the visible candidate changes only the displayed snapshot and active source; candidates are not automatically merged.

### 2. Dirty screen is not replaced by asynchronous recovery

When a dirty screen detects a local recovery state, the screen snapshot is captured before the local candidate is registered. Native recovery probing then runs with saving gated.

If a normal primary appears while the native probe is still running, the dirty screen is not automatically replaced by that primary. The stored primary may still be chosen explicitly through the existing load action.

### 3. Native recovery read errors gate destructive actions

While native recovery is being checked, or when the native snapshot cannot be read safely:

- autosave remains stopped,
- destructive resolution remains gated,
- force-overwrite is not offered,
- recovery candidates already captured remain available,
- the user can retry the native safety check.

A native I/O problem is never treated as an empty/fresh installation.

### 4. Presented local and native candidates stay stable

Once a local or native recovery candidate has been presented, a later storage event or native probe does not silently replace that candidate.

A user may switch to a recovery candidate and edit it before deciding which version to commit. Without this rule, a later asynchronous event could erase those edits while the conflict banner was still visible.

Regression coverage verifies both:

- edited local candidate survives later remote recovery events and probes,
- edited native candidate survives later native probe results.

Newer remote data is not destroyed by this UI stability rule; it remains in the persistence layer, and forced-save preservation protects competing stored versions before overwrite.

### 5. Recovery counts follow the visible and edited candidate

The recovery banner count follows the snapshot currently visible to the user. A later storage event no longer resets the displayed count to the original dirty-screen count after the user switches to a local or native candidate.

The count also stays synchronized when the active candidate itself is edited so that notes are added or removed. Screen, local, and native candidate refs and their visible count state are updated together.

A dedicated regression changes a displayed native candidate from one note to two notes and verifies that the notice changes from 1 to 2 rather than retaining stale UI state.

### 6. Native snapshots keep a bounded latest-three rolling window

The native Filesystem persistence layer maintains:

- primary — newest successfully committed native snapshot
- backup — previous native snapshot
- secondary backup — the generation before backup

The write order is intentionally:

1. old backup -> secondary backup
2. current primary -> backup
3. new snapshot -> primary

This prevents a failed later write from first destroying the newer committed generation.

The three files are a bounded rolling recovery window, not permanent version history. Earlier Phase 40 experiments treated all three slots as immutable archives; that would have caused the fourth distinct autosave to fail permanently once all three slots were occupied. That behavior was removed.

### 7. Secondary native backup is an actual recovery source

The secondary backup is included in `readNativeDurableSnapshot()`.

Read order is:

1. primary
2. backup
3. secondary backup

If an earlier source is missing, corrupt, or unreadable but a later recovery source is valid, the valid snapshot can still be surfaced as a recovery candidate. Only when all three sources are truly missing is the result `missing`. If no valid candidate exists and any source is unreadable or malformed, the result is `error` rather than a false fresh-install state.

### 8. Native rotation failure ordering is covered

Regression tests cover:

- preserving an older backup into secondary before rotation,
- continuing beyond three distinct saves by rolling the latest three generations,
- aborting before primary/backup mutation when the secondary write fails,
- aborting when an existing backup cannot be read safely,
- recovering from secondary when primary and backup are corrupt,
- recovering from secondary when primary and backup reads fail,
- returning `error` instead of `missing` when secondary cannot be read,
- returning `missing` only when all native snapshot files are absent.

### 9. Recovery copy does not claim a native candidate that does not exist

The common dirty-conflict notice now describes only the candidates that are guaranteed to exist at that point: the unsaved screen and the local recovery candidate.

Native-specific wording is rendered separately only when a native alternative is actually available. A regression test ensures the common notice does not contain an on-device/native claim while the native-specific notice still does.

This closes the CodeRabbit functional-correctness finding where a `missing` native result could previously leave misleading copy on screen.

## Verification

Verified implementation head before this report refresh:

`41f06b77ba4253227582af6302a785aeca6e265d`

GitHub Actions `Check` run `33169447963` completed successfully with:

- `npm ci`
- `npm audit --omit=dev --audit-level=high` — 0 production vulnerabilities
- TypeScript typecheck
- ESLint
- Vitest — 21 files, 163 tests passed
- production build
- `npx cap sync ios`
- committed iOS project drift check
- iPhone-only target/orientation guards in the workflow

`npm ci` still reports 12 vulnerabilities in the broader dependency/dev-tool graph (2 low, 1 moderate, 9 high). Phase 40 does not claim those are resolved; the production high-severity audit remains clean.

CodeRabbit raised two functional-correctness findings during review:

1. stale candidate count after editing a displayed recovery candidate,
2. common copy claiming a native candidate even when native recovery was missing.

Both were fixed, regression-covered, replied to, and their review threads were resolved before merge.

## Known limits / follow-up

### Atomic multi-tab CAS is still not guaranteed

localStorage does not provide an atomic compare-and-swap transaction across tabs. The existing journaling, expected-baseline checks, writer identity, conflict gates, and preservation slots substantially reduce silent overwrite risk, but an exact simultaneous interleaving remains a theoretical race.

### Native snapshots are recovery, not full version history

The native primary/backup/secondary files intentionally retain only the latest three generations. Older generations age out during normal successful saves.

### Hidden preservation slots are not yet a user-facing recovery history

Several local persistence slots preserve competing/recovery generations for safety. Phase 40 does not add a UI that browses all historical preservation slots. A future Recovery History flow could make those emergency copies user-selectable.

### Real iOS validation is still pending

CI confirms Capacitor sync and committed iOS project consistency, but the Linux runner does not have CocoaPods or `xcodebuild`; the workflow explicitly logs those steps as unavailable. Phase 40 therefore does **not** verify:

- Xcode build/signing
- iOS Simulator behavior
- real-device background/suspend/terminate behavior
- keyboard and safe-area behavior on 375 / 390 / 430 point widths
- WKWebView vertical read-mode behavior
- TestFlight installation or App Store submission metadata

Those remain part of the iOS/TestFlight preflight work tracked separately.
