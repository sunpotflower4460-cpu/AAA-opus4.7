# Phase 34 — Save Retry Hardening Report

## Goal

Phase 34 closes a persistence UX gap where a transient storage failure could leave the user with unsaved local edits but no explicit way to retry without changing the note again.

## Changes

- Added `isRetryableSaveFailure()` to classify only transient/retryable failures:
  - `quota`
  - `unavailable`
  - `unknown`
- Added reason-specific save error copy for quota, unavailable storage, and invalid outgoing data.
- Added an explicit `もう一度保存する` action in `NoteEditor` for retryable failures.
- Retry reuses the current local snapshot without requiring another text edit.
- Retry does **not** use `force: true`.
- Retry keeps the existing `expectedNotes` baseline comparison, so a remote update that happened after the original failure is promoted to the existing conflict UI instead of being overwritten.
- Conflict and recovery states remain exclusively handled by the conflict/recovery UI.
- `invalid_data` is intentionally not retryable because repeating the same write cannot repair malformed application data.

## Regression coverage

Added tests cover:

1. quota failure → explicit retry → save success.
2. unavailable storage → explicit retry → save success.
3. unknown storage failure → explicit retry → save success.
4. retry itself fails again → error state and retry action remain available.
5. remote storage changes after the first failed save but before retry → retry does not overwrite remote state and instead enters conflict resolution.
6. retry classifier accepts only transient storage failures.

## Validation

The implementation passed:

- TypeScript typecheck
- ESLint
- 86 Vitest tests
- production build
- Capacitor iOS sync
- tracked native drift check

The normal branch `Check` workflow also passed after removing the temporary implementation workflow.

## Follow-up discovered during Phase 34 audit

A separate app-level UX gap remains and is intentionally scheduled as the next hardening phase:

- save failures that happen after leaving the editor (for example delete → list, undo, or other list-visible mutations) currently retain unsaved local state but the editor-local error/retry UI is no longer visible.

Phase 35 should surface non-conflict save failures at the App level so retry remains visible regardless of the current view, while avoiding duplicate error UI inside the editor.
