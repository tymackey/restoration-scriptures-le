#!/bin/bash
# Package a local Mac app. This does not notarize or sign for public distribution.
set -euo pipefail
SCRIPTURES_REPO="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPTURES_BUILT="${1:?Supply the built Catalyst .app path}"
SCRIPTURES_OUTPUT="${2:?Supply a new destination .app path}"
if [[ -e "$SCRIPTURES_OUTPUT" ]]; then
  printf 'Destination already exists: %s\n' "$SCRIPTURES_OUTPUT" >&2
  exit 1
fi
/usr/bin/ditto --norsrc --noextattr "$SCRIPTURES_BUILT" "$SCRIPTURES_OUTPUT"
/usr/libexec/PlistBuddy -c 'Set :CFBundleName Scriptures LE' "$SCRIPTURES_OUTPUT/Contents/Info.plist"
python3 "$SCRIPTURES_REPO/scripts/normalize-mac-frameworks.py" "$SCRIPTURES_OUTPUT"
/usr/bin/codesign --force --deep --sign - "$SCRIPTURES_OUTPUT"
/usr/bin/codesign --force --sign - --entitlements "$SCRIPTURES_REPO/macos/ScripturesLE.entitlements" "$SCRIPTURES_OUTPUT"
/usr/bin/codesign --verify --deep --strict "$SCRIPTURES_OUTPUT"
printf 'Locally signed app: %s\n' "$SCRIPTURES_OUTPUT"
