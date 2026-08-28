# Phase 41 — Native read uncertainty hardening

## Scope

Phase 41 closes a rollback risk in the native Filesystem recovery path.

Phase 40 introduced a three-generation native recovery window:

1. primary — newest native snapshot
2. backup — previous generation
3. secondary backup — generation before backup

The remaining problem was the difference between a generation that is **known invalid** and one that is simply **unreadable**.

## Problem

Before Phase 41, `readNativeDurableSnapshot()` continued to older generations even when a newer native snapshot failed with a non-`missing` I/O error.

That meant the following sequence was possible:

1. primary exists but cannot currently be read,
2. backup is readable and older,
3. native read returns backup as normal `available`,
4. the app allows the user to promote that older candidate without retaining the fact that a newer generation may still exist.

This is not the same as a corrupt primary. A corrupt primary was actually read and proven invalid. An I/O error leaves the contents unknown.

Treating those states the same could turn a transient read failure into a silent rollback to an older snapshot.

## Safety rule

Phase 41 distinguishes:

- **missing** — the generation is known not to exist; fallback is allowed,
- **readable but structurally invalid/corrupt** — the generation is known unusable; fallback is allowed,
- **I/O/read error** — the generation is unknown and may contain a newer valid snapshot; fallback is blocked.

The reader therefore fails closed at the first unreadable higher-priority generation.

## Changes

### 1. Primary I/O error blocks backup/secondary fallback

If native primary returns a non-missing read error, `readNativeDurableSnapshot()` immediately returns:

```ts
{ status: "error" }
```

The reader does not inspect backup or secondary as a normal recovery candidate in that attempt.

### 2. Backup I/O error blocks secondary fallback

If primary is missing or known-corrupt but backup itself cannot be read, the reader returns `error` before descending to secondary.

This prevents a possibly-newer unreadable backup from being silently bypassed by an older secondary snapshot.

### 3. Known corruption still falls back

Phase 41 intentionally preserves the Phase 40 recovery behavior when a higher generation was successfully read but failed schema/data validation.

Examples that remain valid:

- corrupt primary + valid backup -> backup is available,
- corrupt primary + corrupt backup + valid secondary -> secondary is available,
- missing primary + valid backup -> backup is available,
- missing primary + missing backup + valid secondary -> secondary is available.

### 4. Fresh-install detection remains strict

`missing` is returned only when all three native snapshot paths are known absent.

Any readable-but-invalid generation or any I/O/read error returns `error` rather than being misclassified as a fresh installation.

## App behavior

No `App.tsx` change is required.

The existing native recovery gate already treats `status: "error"` conservatively:

- editing and autosave remain gated,
- destructive/force resolution is not offered,
- the recovery error UI is shown,
- the user can retry the native safety check.

This means Phase 41 improves the native read contract while reusing the already-tested recovery UX.

## Regression coverage

Phase 41 changes/adds tests for:

- primary I/O error + valid backup -> `error`, and backup is not read,
- primary I/O error + valid secondary -> `error`, lower generations are not read,
- primary missing + backup I/O error + valid secondary -> `error`, secondary is not read,
- corrupt primary + valid backup still recovers,
- corrupt primary + corrupt backup + valid secondary still recovers,
- all native generations missing still returns `missing`,
- unreadable secondary remains `error` rather than fresh install.

## Verification

Final clean implementation head before this report:

`8875212c41ac9da3ede067607aa58db30a252c53`

GitHub Actions `Check` run `33170205755` completed successfully with:

- `npm ci`
- `npm audit --omit=dev --audit-level=high` — 0 production vulnerabilities
- TypeScript typecheck
- ESLint
- Vitest — 21 files, 164 tests passed
- production build
- `npx cap sync ios`
- committed iOS project drift check
- iPhone-only target/orientation guards

The broader `npm ci` audit still reports 12 vulnerabilities in the dependency/dev-tool graph (2 low, 1 moderate, 9 high). Phase 41 does not claim those are resolved.

## Tradeoff

A persistently unreadable higher-priority native file can now prevent automatic use of an older readable backup.

This is intentional. Phase 41 chooses data safety over automatic rollback: the application should not present an older snapshot as fully safe when it cannot determine whether an unreadable newer generation contains more recent user data.

A future degraded-recovery UI could expose older generations with an explicit warning that a newer unreadable generation may exist. Phase 41 does not add that UI.

## Known limits

Unchanged from the current release-preflight state:

- exact simultaneous localStorage multi-tab CAS is still not transactional,
- native snapshots are a latest-three recovery window, not complete history,
- emergency preservation generations are not a user-facing Recovery History UI,
- Linux CI does not provide CocoaPods or `xcodebuild`,
- Xcode build/signing, Simulator, real iPhone lifecycle behavior, TestFlight, and App Store validation remain unverified.
