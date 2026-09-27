#!/usr/bin/env python3
"""Configure the generated iOS project for this personal Mac Catalyst build.

Run after `npx expo prebuild --platform ios --no-install` and before `pod install`.
The source iOS configuration stays unchanged. Native directories are generated.
"""
from pathlib import Path
import plistlib

root = Path(__file__).resolve().parents[1]
ios = root / "ios"
project = ios / "ScripturesLETest.xcodeproj/project.pbxproj"
podfile = ios / "Podfile"
info = ios / "ScripturesLETest/Info.plist"
for path in (project, podfile, info):
    if not path.exists():
        raise SystemExit(f"Generate the iOS project first; missing {path}")

text = project.read_text()
text = text.replace('PRODUCT_BUNDLE_IDENTIFIER = "info.scriptures.rescriptures.lelabels";',
                    'PRODUCT_BUNDLE_IDENTIFIER = "info.scriptures.rescriptures.lelabels.mac";')
if "SUPPORTS_MACCATALYST = YES;" not in text:
    anchor = 'TARGETED_DEVICE_FAMILY = "1,2";'
    if anchor not in text:
        raise SystemExit("Unexpected Xcode project structure; review Catalyst settings manually")
    text = text.replace(anchor, anchor + "\n" + "\n".join([
        "                SUPPORTS_MACCATALYST = YES;",
        "                DERIVE_MACCATALYST_PRODUCT_BUNDLE_IDENTIFIER = NO;",
        "                SUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD = NO;",
    ]))
project.write_text(text)
text = podfile.read_text().replace(":mac_catalyst_enabled => false", ":mac_catalyst_enabled => true")
if ":mac_catalyst_enabled => true" not in text:
    raise SystemExit("Unexpected Podfile structure; Catalyst post-install hook not found")
podfile.write_text(text)
values = plistlib.loads(info.read_bytes())
values["CFBundleDisplayName"] = "Scriptures LE"
values["UIRequiresFullScreen"] = False
values["CFBundleURLTypes"] = [{"CFBundleURLSchemes": ["rescriptures-lelabels-mac"]}]
info.write_bytes(plistlib.dumps(values))
print("Configured personal Mac Catalyst target info.scriptures.rescriptures.lelabels.mac")
