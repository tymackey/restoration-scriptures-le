#!/bin/bash
# Run in an ordinary local checkout with npm dependencies and CocoaPods installed.
set -euo pipefail
cd "$(dirname "$0")/.."
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
export SENTRY_DISABLE_AUTO_UPLOAD=true
SCRIPTURES_DERIVED="${SCRIPTURES_DERIVED:-$PWD/build/mac-derived}"

npx expo prebuild --platform ios --no-install
python3 scripts/prepare-mac.py
cp macos/Podfile.lock ios/Podfile.lock
(cd ios && pod install)
xcodebuild \
  -workspace ios/ScripturesLETest.xcworkspace \
  -scheme ScripturesLETest \
  -configuration Release \
  -destination 'platform=macOS,variant=Mac Catalyst,arch=arm64' \
  -derivedDataPath "$SCRIPTURES_DERIVED" \
  CODE_SIGNING_ALLOWED=NO SUPPORTS_MACCATALYST=YES \
  MACOSX_DEPLOYMENT_TARGET=15.0 IPHONEOS_DEPLOYMENT_TARGET=18.0 \
  ONLY_ACTIVE_ARCH=YES -jobs "${SCRIPTURES_BUILD_JOBS:-4}"
printf 'Built app: %s\n' "$SCRIPTURES_DERIVED/Build/Products/Release-maccatalyst/ScripturesLETest.app"
