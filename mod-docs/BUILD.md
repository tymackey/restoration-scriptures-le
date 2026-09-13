# Build and run

## What this repository can build

This is an Expo 55 / React Native 0.83.6 project. The personal configuration is already applied on `main`: **Scriptures LE Test**, `info.scriptures.rescriptures.lelabels`, with upstream updates and crash reporting disabled. Do not reapply the isolation patch to this checkout.

The development build was tested with Xcode 26.6 and the iOS 26.5 Simulator runtime on an Apple Silicon Mac. Node.js 24+ is required for the dependency-free checks, which use Node's SQLite and TypeScript support. Python 3 is required for the mapping generator. Native builds additionally need npm dependencies, Xcode's accepted license/first-launch setup, an installed iOS Simulator runtime, and CocoaPods.

## Verify before building

From the repository root:

```sh
node --test scripts/verify-chapter-labels.mjs scripts/verify-tc-index.mjs
python3 scripts/generate-chapter-ranges.py --check
npm ci
npx tsc --noEmit
```

The lockfile pins the JavaScript dependencies. `npm ci` runs the existing `patch-package` postinstall step for the audio dependency. `.npmrc` retains the upstream legacy peer dependency setting.

## Generate and build the iOS project

Use a local checkout outside an iCloud-synchronized folder for the native build, as was done during development. Keep the source repository as the durable record.

```sh
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
export SENTRY_DISABLE_AUTO_UPLOAD=true
npx expo prebuild --platform ios
xcrun simctl list devices available
```

Choose or create an iPad/iPhone simulator in Xcode. Set the following variable to that simulator's actual UUID (the example is a placeholder):

```sh
export SCRIPTURES_SIMULATOR_ID='YOUR-SIMULATOR-UUID'
xcrun simctl bootstatus "$SCRIPTURES_SIMULATOR_ID" -b
xcodebuild \
  -workspace ios/ScripturesLETest.xcworkspace \
  -scheme ScripturesLETest \
  -configuration Release \
  -sdk iphonesimulator \
  -destination "platform=iOS Simulator,id=$SCRIPTURES_SIMULATOR_ID" \
  -derivedDataPath ./build/derived \
  CODE_SIGNING_ALLOWED=NO
xcrun simctl install "$SCRIPTURES_SIMULATOR_ID" ./build/derived/Build/Products/Release-iphonesimulator/ScripturesLETest.app
xcrun simctl launch "$SCRIPTURES_SIMULATOR_ID" info.scriptures.rescriptures.lelabels
open -a /Applications/Xcode.app/Contents/Developer/Applications/Simulator.app --args -CurrentDeviceUDID "$SCRIPTURES_SIMULATOR_ID"
```

The workspace/scheme names above match the project generated for the tested configuration. Native directories, Pods, dependencies, and derived products are intentionally excluded from Git. The portable commands describe the build procedure; a fresh clone's full dependency installation/native rebuild was not rerun merely to upload this repository.

## Using the current test app on the development Mac

Open **Scriptures LE Test** from Applications or Spotlight. It opens the dedicated iPad Simulator. Click, hold, and drag vertically inside the app to scroll, imitating a finger swipe. The user confirmed this works. Use the T&C number rail for long-distance jumps.

To return to the original app, quit Simulator and open **Restoration Scriptures**. The test app does not share the original installation's highlights or settings.

## The Mac convenience launcher

`launcher/Launcher.swift` preserves the actual AppKit launcher source used on the development Mac. It:

1. Starts the dedicated simulator and waits until it is ready.
2. Checks whether the test app is already installed.
3. If missing, extracts `Contents/Resources/ScripturesLETest.zip` and installs the enclosed simulator app.
4. Launches the test app and shows Simulator.

It does not reinstall on every launch, so replacing a bundled payload alone does not update an existing simulator installation. Install an updated build explicitly with `simctl install`.

The source currently contains the development Mac's simulator UUID, `74FCB00A-3609-4F19-B166-6750BD06ABC6`, and assumes Xcode is in `/Applications/Xcode.app`. On another Mac, create a simulator and update that constant before packaging a launcher. The existing launcher is machine-specific convenience code, not a portable installer.

To package it, compile the Swift source as a macOS AppKit executable, put it in a normal `.app/Contents/MacOS` structure with a matching `CFBundleExecutable` in `Info.plist`, and include a zip containing the simulator `.app` under `Contents/Resources/ScripturesLETest.zip`. The local launcher used bundle ID `local.scriptures.lelabels.launcher` and ad-hoc signing. A compiled launcher and its payload are not included in Git; direct `simctl` launch above is the reproducible route provided here.

## Physical iPhone and standalone Mac

A simulator binary cannot be installed on a physical phone. A device build needs an Apple signing identity, a provisioning profile, and a device/distribution workflow. Those steps have not been completed. The simulator tests cover the shared iPhone UI source, not installation or performance on a real phone.

A standalone Mac version also remains future work. It must be built for an appropriate Mac-supported target and validated for normal wheel/trackpad scrolling, keyboard interaction, windows, audio, and storage. The Applications launcher does not supply that port.

`eas.json` is retained from upstream for historical context and still describes the original developer's service/submission targets. Do not use those targets for this personal project. Local Simulator builds above do not use EAS. A future EAS or App Store workflow must use this project's own accounts and configuration.
