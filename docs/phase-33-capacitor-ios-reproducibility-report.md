# Phase 33 — Capacitor / iOS reproducibility hardening report

## Summary

Phase 33 closes a release-preparation gap where the Web application could pass CI while a clean Mac could still fail to reproduce the iOS wrapper.

The repository previously had a valid `capacitor.config.ts`, but Capacitor packages were optional peer dependencies and the native `ios/` directory was ignored as if it were disposable build output. That combination made native reproducibility dependent on machine-local state and allowed Xcode-only settings to disappear when the wrapper was regenerated.

## Problems found

### 1. Capacitor packages were not reproducible project dependencies

`@capacitor/cli`, `@capacitor/core`, and `@capacitor/ios` were declared as optional peer dependencies. A clean `npm ci` therefore did not guarantee that the CLI and iOS platform required by the runbook were installed.

### 2. `capacitor.config.ts` was outside the Node TypeScript project

`tsconfig.node.json` only included `vite.config.ts`. CI could therefore remain green even if `capacitor.config.ts` stopped type-checking.

### 3. Native iOS project was treated as disposable output

The root `.gitignore` ignored `ios/` completely. This is unsafe for an App Store project because Xcode settings, Info.plist changes, signing-related project structure, app icon assets, and future native changes are source artifacts rather than rebuild-only output.

### 4. Generated iOS app used Capacitor placeholder branding

A clean `cap add ios` produced the default Capacitor app icon and splash image. Shipping those assets would make the native package inconsistent with the existing Zanshin Web brand.

### 5. CI did not detect native/config drift

The standard `Check` workflow validated TypeScript, lint, tests, and Web build, but did not run a Capacitor iOS sync against the committed native project.

### 6. Default native scope included unvalidated iPad and landscape support

The generated Xcode project used `TARGETED_DEVICE_FAMILY = "1,2"` and enabled landscape orientations, while the existing release checklist validates only iPhone portrait widths. Apple requires iPad screenshots when an app runs on iPad, so leaving the default scope would increase release requirements without corresponding validation.

## Fixes

### Dependency lock

Capacitor is pinned to one tested patch version:

- `@capacitor/core`: `7.6.8`
- `@capacitor/ios`: `7.6.8`
- `@capacitor/cli`: `7.6.8`

`@capacitor/core` and `@capacitor/ios` are runtime/project dependencies; the CLI is a development dependency.

Node.js is declared as `>=22` to match the CI/runtime requirements already discovered in Phase 32.

### Native scripts

The normal workflow is now:

- `npm run cap:sync:ios`
- `npm run cap:open:ios`

There is intentionally no normal `cap:add:ios` script after the native project is committed. The platform should be synchronized, not destroyed and recreated.

### Type checking

`tsconfig.node.json` includes both:

- `vite.config.ts`
- `capacitor.config.ts`

### Source-control boundary

The repository now tracks `ios/` and uses the Capacitor 7 iOS template ignore boundary for machine/generated data:

- ignored: build, Pods, output, copied Web `public`, generated Capacitor config/XML, Cordova plugin generated project, DerivedData, xcuserdata
- tracked: Xcode project, AppDelegate, Info.plist, storyboards, native asset catalogs, Podfile, shared workspace metadata

### Branding

The placeholder Capacitor icon and splash are replaced by native RGB PNG assets based on the existing `public/zanshin.svg` identity:

- paper background
- dark open ensō/ring
- gold point
- no alpha channel in the 1024x1024 App Store icon

### Initial device scope

The first release is narrowed to **iPhone / portrait only**:

- `TARGETED_DEVICE_FAMILY = 1`
- landscape orientations removed from `Info.plist`
- iPad-specific orientation declaration removed

This keeps the binary aligned with the layouts and screenshots that are actually planned for initial validation. iPad and landscape support should be enabled only after dedicated layout, keyboard, read-mode, screenshot, and TestFlight validation.

### CI drift check

After the normal Web check, CI runs `cap sync ios`, verifies the Xcode project and Info.plist exist, verifies the intended iPhone/portrait scope, then requires `git diff --exit-code -- ios`.

This catches native-source drift caused by package/config changes while allowing expected generated files to remain ignored.

## Clean-runner verification performed before merge

Temporary Phase 33 workflows proved on clean Ubuntu runners that the pinned dependency graph can perform:

1. dependency installation
2. production Web build
3. `cap add ios` from an empty native state
4. `cap sync ios`
5. Xcode project and Info.plist generation
6. native branding generation and format checks
7. iPhone-only target and portrait-only Info.plist assertions

The temporary generator/committer workflow is removed from the final change after producing the canonical initial native project.

## Security / dependency note

`npm audit --omit=dev --audit-level=high` remains clean for production dependencies. The broader development/tooling graph still reports the previously known audit findings and is intentionally handled separately rather than with a blind `npm audit fix`.

## Remaining manual boundary

Linux CI can prove dependency installation, config loading, Web build, iOS scaffold generation/sync, and source drift. It cannot replace macOS/Xcode validation.

Still required on macOS/iPhone:

- CocoaPods/Xcode resolution
- signing team
- Bundle ID availability in the Apple account
- archive
- simulator/real-device layout
- keyboard behavior
- Safe Area
- WKWebView vertical read scrolling
- background/suspend/resume
- force terminate/relaunch persistence
- TestFlight upload and install

Those remain tracked by Phase 20 / issue #27.
