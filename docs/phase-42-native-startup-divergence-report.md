# Phase 42 — Native startup divergence hardening

## Scope

Phase 42 prevents a valid localStorage snapshot from automatically overwriting a different native durability snapshot before the two layers have been compared.

Phase 41 made native generation reads fail closed when a newer native generation is unreadable. Phase 42 extends the same safety principle across the localStorage/native boundary at startup and when a recovery probe converges back to a valid local primary.

## Problem

Before Phase 42, a native launch with a valid localStorage primary skipped the native recovery comparison and immediately called `persistDurableSnapshot(local)`.

That made this sequence possible:

1. localStorage contains a valid but older/stale snapshot,
2. the native durability layer still contains a different valid snapshot,
3. the app launches,
4. the valid local snapshot is immediately persisted to native,
5. the previous native primary is rotated downward before the user is told the layers disagreed.

The same bypass could occur when a local recovery candidate became a normal valid primary while a native safety probe was already in progress.

A valid local snapshot is not proof that it is newer than a different valid native snapshot. Inferring freshness from note `updatedAt` values is also unsafe because deletions and snapshot-level changes are not reliably ordered by a single note timestamp.

## Safety rule

On a native platform, the app now completes one native safety comparison before editing or saving is enabled, even when localStorage is already valid.

For a valid local primary:

| Native result | Phase 42 behavior |
| --- | --- |
| `missing` | Treat local as canonical and bootstrap it into the native durability layer. |
| `available` with the same snapshot | Treat the layers as agreeing, release the gate, and persist local to heal/normalize native storage if needed. |
| `available` with a different snapshot | Preserve local and native as separate candidates. Do not write either automatically. Require explicit user choice. |
| `error` | Fail closed. Keep editing/saving gated and expose Retry. Do not use local to overwrite native. |

No timestamp-based “newest” guess is made for the different-snapshot case.

## Changes

### 1. Native startup is always safety-gated

`nativeRecoveryInitiallyRequired` is now true whenever the native durability layer is available, not only when localStorage is missing/corrupt/unavailable.

This means a normal native launch cannot write local data to native storage before the native snapshot check completes.

### 2. Valid local and different native snapshots become an explicit conflict

When both layers are valid but differ:

- local remains visible initially,
- local is retained in `localRecoveryCandidateRef`,
- native is retained independently in `nativeRecoveryAlternativeRef`,
- autosave stays disabled,
- the user can inspect either candidate,
- neither localStorage nor native durability storage is modified until an explicit choice is made.

The existing recovery UI and force-save preservation mechanisms are reused rather than introducing an automatic merge.

### 3. Explicit local selection remains supported

If the user explicitly chooses the saved local version, the normal stored-primary adoption path resolves the conflict and then updates the native durability layer to that chosen canonical snapshot.

### 4. Explicit native selection remains supported

If the user switches to the native candidate and explicitly overwrites with it, `saveNotes(..., { force: true })` commits that snapshot to localStorage while the existing conflict-backup machinery preserves displaced valid local generations where possible. The chosen snapshot is then persisted to native durability storage.

### 5. Runtime recovery convergence uses the same comparison rule

Previously, if a pending local recovery candidate became a normal valid primary while `probeNativeRecovery()` was running, the app immediately accepted and persisted that local primary.

Phase 42 removes that shortcut. The valid primary now falls through to the same local/native comparison used at native startup, so a different native snapshot cannot be silently overwritten during recovery convergence either.

### 6. Missing and identical native states remain low-friction

The safety gate is released automatically when:

- native storage is known missing, or
- native returns the exact same snapshot as local.

The normal local snapshot is then persisted to the native layer. In the identical case this also allows a valid snapshot recovered from a lower native generation to repair/normalize the native primary without presenting a false conflict.

### 7. Mid-probe local changes cannot leave the app stuck in `checking`

CodeRabbit identified a race where `getNotesPrimaryHealth()` could observe a valid primary but the following `loadNotes()` could observe a different state. The old Phase 42 branch returned through `flagExternalConflict()` without leaving the native `checking` gate, which could suppress conflict actions and edits indefinitely.

The reviewed fix distinguishes the second read result:

- if it contains a recovery candidate, register that candidate and start a fresh native probe so local/native decisions come from a coherent retry,
- if it contains no usable recovery candidate, keep the safety gate closed but switch to the explicit retryable native-read error UI instead of remaining in `checking`.

This also covers a pending-save journal appearing while the first native read is deferred. Storage events are intentionally ignored while the native gate is open, so the probe itself must detect and re-register that candidate.

## Regression coverage

Phase 42 adds or updates coverage for:

- valid local + native missing → native read happens before local is persisted,
- valid local + identical native → no conflict and normal startup,
- valid local + different native → no automatic local/native write,
- switching to the different native candidate is read-only until explicit confirmation,
- explicit native choice writes the native candidate to local and native durability storage,
- explicit local choice preserves local as canonical and then updates native durability storage,
- valid local + native read error → editing/saving remains gated and native is not overwritten,
- Retry after the native error can safely continue once native is confirmed missing,
- a recovery candidate that becomes a valid local primary still goes through native comparison instead of bypassing it,
- a pending-save candidate appearing while the native read is deferred is detected, re-probed, and exits `checking` into an actionable conflict state.

## Verification

Initial clean Phase 42 implementation head:

`712a0c9681622cb7b5caa5221a46a0d070b08eca`

GitHub Actions `Check` run `33172189983` completed successfully with 21 test files / 168 tests.

After CodeRabbit's actionable stuck-gate finding, dedicated review-fix validation run `33172920134` completed successfully before committing source commit:

`d537c23cddc47d96bb8a85a88e50a7966a5a5dc2`

That validation passed:

- `npm ci`,
- `npm audit --omit=dev --audit-level=high` — 0 production vulnerabilities,
- TypeScript typecheck,
- ESLint,
- Vitest — **21 test files / 169 tests passed**,
- production build,
- `npx cap sync ios`,
- committed iOS project drift check.

The temporary validation workflow and patch script were then removed again. The permanent branch contains no Phase 42 patching workflow/script.

The broader `npm ci` audit still reports **12 vulnerabilities** in the dependency/dev-tool graph: 2 low, 1 moderate, 9 high. Phase 42 does not claim those are resolved.

## Review disposition

CodeRabbit's concrete stuck-gate stability finding was accepted and fixed with regression coverage.

CodeRabbit also suggested extracting the broader native recovery state machine from `App.tsx` into a dedicated hook/reducer. That is a maintainability refactor rather than a concrete Phase 42 correctness defect. It is intentionally not mixed into this safety patch because a broad state-machine refactor would substantially increase the review surface and regression risk. It remains a valid follow-up architecture task.

Codex code review and Cursor Bugbot were unavailable for this PR because their respective usage limits were reached; they are not counted as completed reviews.

## Intentional tradeoff

Native startup now performs one durability read even when localStorage is healthy. This adds a small startup safety check on native platforms, but prevents a healthy-looking stale local snapshot from silently becoming canonical before cross-layer comparison.

When two valid snapshots differ, Phase 42 intentionally asks for an explicit choice rather than guessing which one is newer or merging automatically.

## Known limits

Unchanged:

- exact simultaneous localStorage multi-tab CAS is not transactional,
- native durability is a bounded latest-three window rather than full version history,
- persistent unreadable higher-priority native generations remain fail-closed rather than exposing older generations as fully safe,
- lifecycle resume paths still require separate scrutiny because a later clean local refresh may have different trust assumptions from startup,
- broader dev/tool dependency audit still reports 12 vulnerabilities,
- Linux CI does not provide CocoaPods or `xcodebuild`,
- Xcode build/signing, Simulator, real iPhone lifecycle behavior, TestFlight, and App Store validation remain unverified.
