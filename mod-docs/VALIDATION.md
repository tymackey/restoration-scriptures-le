# Validation and remaining work

## Automated checks

The feature suite consists of 17 checks:

- 14 chapter/reference checks in `scripts/verify-chapter-labels.mjs`.
- 3 continuous-list/index checks in `scripts/verify-tc-index.mjs`.

They exercise the real bundled database: expected 2 Nephi examples, complete chapter coverage, matching divisions across editions, independent inline reference-marker comparisons, Bible and single-chapter book labels, exact T&C verse sets and exceptions, and preservation of canonical records. Index checks verify all 185 sections exactly once in numeric order, exact number destinations, original navigation records, and front matter/appendix access.

`python3 scripts/generate-chapter-ranges.py --check` verifies that the committed lookup matches the database. TypeScript checking passed on the tested build. Earlier Book of Mormon/CoC work also passed 177 upstream database tests; that earlier result is not a claim that the entire upstream test suite was rerun for every later change.

Repository-upload verification is recorded in [UPLOAD-CHECKS.md](UPLOAD-CHECKS.md). No feature code was rewritten just to prepare the upload.

## Native checks completed during development

Release builds completed with Xcode 26.6. The final indexed-list build was installed in separate iPad and iPhone simulators.

| Area | Observed behavior |
|---|---|
| RE 2 Nephi picker | All 15 expected labels visible |
| Covenant of Christ 2 Nephi | Same 15 expected labels visible |
| Chapter previews | Reference labels visible; selection opens reader |
| Edition switching | RE 2 Nephi 3 switches to Covenant of Christ chapter 3; text and red references render |
| iPhone Genesis | All 12 labels, including Moses 1 exception |
| iPhone Romans | Book label visible; direct reader navigation works |
| T&C references | Long 138/139 references visible, including D&C 123 in section 139 |
| Preview layout | Two-column iPhone layout displays previously hidden cards |
| Continuous list | Exact iPhone jumps to 10 and 130; 180 reveals the final sections |
| Continuous cards | iPhone 130/140 jumps show target rows and the full long section 139 reference |
| iPad | Continuous section list and complete right-side rail visually checked |
| Scrolling | User explicitly confirmed click-and-hold dragging works in Simulator |

Earlier T&C reference/grid checks used the prior grouped view; the final feature replaces that view with the continuous index. These are separate stages of validation, not two simultaneously available navigation modes.

## Known limits

- Normal Mac mouse-wheel/two-finger trackpad scrolling was not successfully verified in Simulator. Click-and-drag works. Do not report this as fixed native Mac input support.
- The number rail supports tapping/clicking. Finger-drag scrubbing along it is not implemented.
- Near the end, scroll limits prevent every target from landing at the very top. The active rail indicator follows the visible position and can differ from the last tapped number.
- All rows are rendered so variable heights can be measured. Long-list/card performance on a physical phone has not been measured.
- Large text sizes, VoiceOver behavior, tiny landscape windows, and all orientation transitions need broader device testing. Rail buttons have accessibility names; this is not a full accessibility audit.
- The source supports Android, but the modified app has not been built or tested on Android.
- No full regression pass of every upstream feature (audio, search, annotations, backup, etc.) was performed for this upload.
- The GitHub source is not a signed installer, physical iPhone build, standalone Mac port, or App Store release.
- Reader-body chapter headings retain their original RE wording; these changes apply to navigation titles.

## Suggested next acceptance pass

On a physical iPhone and the eventual standalone Mac build, verify scrolling, all rail targets, long-label wrapping, rotation, front matter/appendix links, the four nested T&C destinations, edition switching, saved reading position, and existing annotations/audio. Verify account/signing isolation before distributing a build.
