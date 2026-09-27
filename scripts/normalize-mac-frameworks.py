#!/usr/bin/env python3
"""Repair flattened links in RN 0.83.6 prebuilt Catalyst framework packaging.

Only operates on the separately packaged personal Mac app. Preserve Xcode's
stripped architecture-specific binary; put resources into the versioned layout.
"""
from pathlib import Path
import plistlib
import shutil
import sys

app = Path(sys.argv[1]).resolve()
info = plistlib.loads((app / "Contents/Info.plist").read_bytes())
if info.get("CFBundleIdentifier") != "info.scriptures.rescriptures.lelabels.mac":
    raise SystemExit("Refusing to modify a different app")
for name in ("React", "ReactNativeDependencies"):
    framework = app / "Contents/Frameworks" / f"{name}.framework"
    current = framework / "Versions/Current"
    version = framework / "Versions/A"
    binary = framework / name
    if current.is_symlink() and binary.is_symlink():
        continue
    if not version.is_dir() or not binary.is_file() or binary.is_symlink():
        raise SystemExit(f"Unexpected framework layout: {framework}")
    shutil.copy2(binary, version / name)
    binary.unlink()
    binary.symlink_to(f"Versions/Current/{name}")
    resources = framework / "Resources"
    if resources.is_dir() and not resources.is_symlink():
        shutil.copytree(resources, version / "Resources", dirs_exist_ok=True)
        shutil.rmtree(resources)
        resources.symlink_to("Versions/Current/Resources")
    for bundle in framework.glob("*.bundle"):
        shutil.move(str(bundle), str(version / "Resources" / bundle.name))
    if current.is_symlink():
        current.unlink()
    elif current.is_dir():
        shutil.rmtree(current)
    current.symlink_to("A")
    print(f"Normalized {name}.framework")
