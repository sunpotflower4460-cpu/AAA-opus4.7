# Phase 37 — Native Lifecycle Persistence & arm64 Submission Hardening

## Problems found

### 1. iOS persistence relied only on DOM lifecycle events

The web layer already flushed dirty notes on `visibilitychange`, `pagehide`, and `beforeunload`, and reconciled clean state on `pageshow` / visible transitions.

That is useful inside WKWebView, but it left the App Store build dependent on browser lifecycle delivery at the exact moment iOS transitions the native app away from active state.

### 2. The committed iOS project still declared `armv7` as a required device capability

`ios/App/App/Info.plist` contained:

```xml
<key>UIRequiredDeviceCapabilities</key>
<array>
  <string>armv7</string>
</array>
```

For the current 64-bit iPhone target this was stale native metadata and was corrected before first App Store submission.

## Changes

### Capacitor App lifecycle

Added exact dependency:

```json
"@capacitor/app": "7.1.2"
```

`npx cap sync ios` now wires the `CapacitorApp` iOS plugin into the committed native project.

### Native lifecycle adapter

Added `src/lib/nativeAppLifecycle.ts`.

The adapter:

- subscribes to `appStateChange` only when `Capacitor.isNativePlatform()` is true;
- leaves browser builds on the existing DOM lifecycle path;
- tolerates native plugin registration failure so the DOM lifecycle fallback remains usable;
- handles React effect cleanup that occurs before the asynchronous Capacitor listener registration resolves;
- catches listener-removal rejection so cleanup cannot become an unhandled promise rejection.

### App persistence behavior

`App.tsx` now combines native and DOM lifecycle boundaries:

- native `isActive: false` → immediately calls the existing guarded `flushPendingNotes()`;
- native `isActive: true` → calls the existing clean-only `refreshCleanNotesFromStorage()`.

The existing persistence guards remain authoritative:

- dirty state is never silently replaced by a remote snapshot;
- conflict/recovery guard blocks unsafe writes;
- duplicate native + DOM lifecycle events become harmless after the first successful save because dirty/no-op state suppresses the second write.

### iOS capability

`UIRequiredDeviceCapabilities` changed from `armv7` to `arm64`.

The project remains internally consistent at:

- iOS deployment target: 14.0
- marketing version: 1.0
- build version: 1
- targeted device family: iPhone
- bundle identifier: `com.zanshin.notes`

No unrelated project-setting change was made.

## Regression coverage

Added native lifecycle adapter tests for:

1. no Capacitor listener registration in normal web mode;
2. native `appStateChange` registration and removal;
3. cleanup before asynchronous listener registration resolves;
4. native plugin registration failure fallback;
5. listener-removal rejection safety.

Added App integration tests for:

1. native inactive flushes dirty text before the 500 ms autosave debounce;
2. native active reloads a missed external change only while the local screen is clean;
3. native active does not replace dirty local edits, and the next inactive flush detects the remote conflict without overwriting it;
4. component unmount removes the native listener.

The integration test input dispatches are wrapped in React `act()` so the Phase 37 suite does not rely on noisy state-update warnings.

## Validation

The implementation patch validation passed with:

- production dependency audit: 0 high production vulnerabilities
- TypeScript typecheck
- ESLint
- 16 Vitest files / 107 tests before the final removal-rejection regression was added
- production build
- Capacitor iOS sync
- `@capacitor/app@7.1.2` detected by Capacitor
- `CapacitorApp` native plugin entry generated in the iOS Podfile
- `arm64` capability present and `armv7` capability absent

A final normal `Check` is run after all temporary patch tooling is removed and includes the additional listener-removal regression.

The broader development/tool dependency graph still reports the pre-existing 12 vulnerabilities (2 low, 1 moderate, 9 high). Phase 37 does not claim those are fixed.

## Remaining boundaries

- Ubuntu CI cannot run CocoaPods/Xcode archive/signing; `cap sync ios` therefore warns that CocoaPods and `xcodebuild` are unavailable there.
- Real iPhone / Simulator background → inactive → suspend → active behavior still requires device-side verification.
- Force termination / relaunch persistence remains a device-side test.
- Safe areas, software keyboard resizing, vertical writing behavior in WKWebView, Archive, and TestFlight still require Xcode/iPhone validation.
- Cross-tab exact simultaneous compare-and-set remains a separate storage-transaction limitation.
