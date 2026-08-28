# Phase 35 — Global Save Failure Recovery Report

## Problem

Phase 34 added an explicit retry action for transient storage failures inside `NoteEditor`, but a separate data-safety UX gap remained:

1. a mutation makes the note collection dirty;
2. the UI leaves the editor (for example delete → list, undo/list-visible state, or Back after an editor save failure);
3. autosave fails with quota, unavailable storage, or an unknown storage error;
4. the unsaved local state remains in memory, but the editor-local failure/retry UI is no longer visible.

This could make the application appear healthy while the visible local state had not actually reached persistent storage.

## Fix

- Added a shared `getSaveFailureMessage()` mapper so editor and app-level save errors cannot silently drift apart.
- Added an App-level persistent save-failure banner whenever a non-conflict save failure exists outside the active editor.
- The global banner is intentionally not dismissible while the save failure remains unresolved.
- Retry is shown only for the transient/retryable reasons defined by `isRetryableSaveFailure()`:
  - quota
  - unavailable
  - unknown
- `invalid_data` remains visible but is not offered a meaningless retry action.
- conflict remains exclusively handled by the dedicated conflict/recovery UI.
- Global retry calls the same safe `retrySaveCurrentNotes()` path introduced in Phase 34:
  - no `force: true`
  - expected-baseline comparison remains active
  - a newer remote value wins protection and causes conflict UI instead of overwrite.
- The App-level banner is suppressed while `NoteEditor` is active so the existing editor-local status does not duplicate the same error and retry action.
- Phase 34 indentation artifacts in `App.tsx` / `NoteEditor.tsx` were cleaned while touching the same code.

## Regression coverage

Added tests verify:

1. delete → list → quota failure keeps a visible global error and Retry action;
2. restoring storage and pressing Retry persists the deletion and clears the banner;
3. if remote storage changes after the failed deletion but before Retry, remote data is preserved and the dedicated conflict UI appears;
4. an editor-local failure shows exactly one Retry action and does not duplicate the global banner;
5. leaving the editor after a failed save carries the unresolved failure into the list view;
6. shared save-failure message mapping covers quota / unavailable / invalid_data / unknown and excludes success / null / conflict.

## Validation

Implementation workflow passed:

- `npm ci`
- production dependency audit (`npm audit --omit=dev --audit-level=high`)
- TypeScript typecheck
- ESLint
- 92 Vitest tests
- production build
- `npx cap sync ios`
- tracked iOS native drift check

The full install still reports the existing broader development/tooling vulnerability set; Phase 35 does not claim those are fixed. The production high-severity audit gate remains green.

## Remaining boundaries

- Real iPhone / Xcode / TestFlight validation is still required for WKWebView lifecycle, keyboard, safe-area, vertical read-mode scrolling, app termination/relaunch persistence, and archive metadata.
- `localStorage` still cannot provide an atomic cross-tab compare-and-set. The current baseline and pending-write protections prevent realistic stale writes but do not replace a transactional store.
