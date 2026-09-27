# Standalone Mac build — September 27, 2026

## Target and separation

This branch adds a Mac Catalyst build of the existing iPad app. It uses the same scripture database, LE/D&C display labels, continuous T&C list, search, reader, annotations, and audio source code.

The Mac target has display name **Scriptures LE**, bundle identifier `info.scriptures.rescriptures.lelabels.mac`, and URL scheme `rescriptures-lelabels-mac`. The official app and previous Simulator test app keep their own identities and data. No original annotations are migrated automatically.

`App.tsx` derives the card layout from the Mac window's aspect ratio. iPhone/iPad builds retain the device-orientation listener. `app.json` retains the previous mobile configuration; the Mac-only native settings are applied after generating the iOS project.

## Reproducible build

Requirements: Apple Silicon Mac, accepted Xcode license and completed first-launch setup, Node 24+, Python 3, Ruby/CocoaPods, and the locked npm dependencies. The development environment used macOS 26.6.2, Xcode 27.0 (27A266a), Ruby 4.0.2 and CocoaPods 1.17.0. Build in an ordinary local directory rather than a cloud-synchronized folder.

```sh
npm ci
node --test scripts/verify-chapter-labels.mjs scripts/verify-tc-index.mjs
python3 scripts/generate-chapter-ranges.py --check
npx tsc --noEmit
bash scripts/build-mac.sh
```

The script generates the iOS project, runs `prepare-mac.py`, installs Pods, then builds Release for Apple Silicon Mac Catalyst. It sets macOS deployment target 15.0 / Catalyst iOS target 18.0 because Xcode 27 no longer accepts the generated 10.15 Mac target. This minimum setting is not a claim that all supported OS versions have been tested.

`prepare-mac.py` enables Catalyst and React Native's Catalyst post-install adjustments, assigns the separate bundle ID and URL scheme, and sets the display name. It may be rerun after prebuild. Generated native projects, Pods and build products remain outside Git.

## Runtime download recovery

During the first setup, CocoaPods completed even though downloading React Native's Release runtime had been interrupted. The first build then reported a missing `reactnative-core-0.83.6-release.tar.gz`. Redownloading that same version from the official Maven artifact URL and checking it with `gzip -t` resolved the missing-file error. No runtime versions were changed.

## Framework packaging repair

The RN 0.83.6 Catalyst `React.framework` and `ReactNativeDependencies.framework` archives contained real duplicate folders where macOS expects `Versions/Current`, executable, and resource symlinks. macOS signing rejected that ambiguous layout. `normalize-mac-frameworks.py` restores the standard versioned layout in the packaged copy, retains Xcode's arm64 binary, moves dependency resource bundles into the versioned Resources folder, and is safe to rerun on the normalized layout. It does not modify the original app or npm package cache.

## Local signing and installation

The build script initially disables code signing. `package-mac.sh` normalizes the frameworks, ad-hoc signs the nested code, then signs the app with its Mac sandbox entitlements. The entitlements allow outgoing network access for existing online features and read/write access to files explicitly selected by the user. App data is kept in its own container. This local signature is not an Apple Developer ID signature or notarization, and does not constitute a signed public release. The original developer can still handle distribution signing as previously planned.

Package a completed build into a new destination:

```sh
bash scripts/package-mac.sh \
  "$PWD/build/mac-derived/Build/Products/Release-maccatalyst/ScripturesLETest.app" \
  "/tmp/Scriptures LE.app"
```

The destination must not already exist. Copy the resulting app to Applications to install it. The development machine's installed path is `/Applications/Scriptures LE.app`. The older `/Applications/Scriptures LE Test.app` remains the Simulator launcher; use **Scriptures LE** for the standalone version.

## Completed validation

- Release Mac Catalyst build succeeded with Xcode 27.0 for arm64.
- Final rebuild included window-aspect-ratio layout handling.
- All 17 mapping/index checks passed; generated mapping verification and TypeScript passed.
- Installed app and all nested code passed `codesign --verify --deep --strict`.
- The app launched directly from Applications in a native Mac window and completed the first-run guide.
- Home covers, the continuous T&C list with D&C labels and index, and all 15 2 Nephi chapter labels rendered in the Mac window.

- The reader loaded 2 Nephi 3 successfully, with its WebView using the separate Mac app sandbox container.
- The user confirmed scrolling works in the standalone Mac app.

Persistence after relaunch, actual window resizing, audio playback, backup/import and broad feature regression have not been fully retested in this Mac build. This is an Apple Silicon local installation, not a notarized public distribution or a physical-iPhone release.
