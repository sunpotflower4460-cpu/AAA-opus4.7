# Phase 36 — No-op Save & Pending Cancellation Hardening

## Problem

A subtle persistence edge case remained after the explicit retry and global failure UI work.

If a mutation failed to save and the user then undid that mutation, the in-memory notes could become byte-for-byte identical to the already-persisted primary again. The old save path still attempted a full journal → backup → primary write.

That caused two problems:

1. A true no-op could report quota/unavailable even though the desired state was already safely persisted.
2. If the earlier failed save had progressed far enough to leave this tab's own pending journal, blindly treating the restored state as a no-op would leave the stale pending candidate behind. On a later launch it could reappear as an interrupted-save recovery candidate even though the user had explicitly undone it.

## Fix

`saveNotes()` now distinguishes three cases after all existing conflict/baseline validation:

### 1. True no-op with no unresolved pending save

When the current valid primary raw JSON is already exactly the outgoing serialized value, normal saves return `{ ok: true }` without writing localStorage.

This prevents false quota/unavailable failures when there is literally nothing left to persist.

### 2. Same-tab interrupted candidate reverted back to primary

If the current outgoing snapshot equals primary but this same writer owns an active unresolved pending journal whose `nextRaw` represents the now-undone state:

1. restore `BACKUP_KEY` to the current valid primary;
2. remove the pending journal;
3. return success without rewriting primary.

If either cleanup step fails, the save remains failed and the journal is not silently forgotten.

### 3. Other-tab pending candidate

No-op optimization does not bypass ownership/conflict protection. Another writer's active pending candidate still returns `conflict` and remains untouched.

Force-save behavior is unchanged and intentionally bypasses the no-op shortcut because force is also responsible for explicit conflict resolution and candidate preservation.

## Regression coverage

Added storage tests cover:

1. exact-primary no-op succeeds even when every `setItem` would throw quota;
2. same-writer pending candidate is cancelled by restoring backup + removing journal without rewriting primary;
3. backup restoration failure keeps the journal and returns quota;
4. journal removal failure does not claim success;
5. another writer's pending candidate remains protected as conflict.

Added App integration tests cover:

1. delete save reaches journal+backup but fails at primary → Undo restores the original primary, restores backup, clears the stale pending journal, and clears the failure UI;
2. delete fails before journal creation due quota → Undo returns to the already-persisted primary and succeeds as a true no-op even while writes remain unavailable.

## Validation

Implementation validation passed:

- production dependency audit: 0 high production vulnerabilities
- TypeScript typecheck
- ESLint
- 14 Vitest files / 99 tests
- production build
- Capacitor iOS sync
- tracked native drift check

The broader development/tool dependency audit still reports the pre-existing 12 vulnerabilities (2 low, 1 moderate, 9 high). Phase 36 does not claim those are fixed.

## Remaining boundaries

- `localStorage` still has no atomic compare-and-set across tabs; simultaneous writes can only be fully closed with a transactional/locking strategy.
- Real Xcode/iPhone/TestFlight lifecycle and persistence validation remains required.
