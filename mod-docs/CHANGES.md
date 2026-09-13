# Changes requested by Ty Mackey

Recorded September 13, 2026. This describes the final implemented behavior and distinguishes it from requested future distribution work. The original Restoration Scriptures app is credited in [UPSTREAM.md](UPSTREAM.md).

## 1. Show familiar Book of Mormon chapters next to RE chapters

**Request:** The black Restoration Edition (RE) divisions differ from the familiar LDS Edition (LE) divisions shown in red within the text. Add the LE chapter range to the chapter picker so a reader can locate passages without opening chapters one at a time.

**Before:** `2 Nephi 1`, `2 Nephi 2`, `2 Nephi 3`.

**After:** `2 Nephi 1 (LE 1-2)`, `2 Nephi 2 (LE 3)`, `2 Nephi 3 (LE 4)`. RE `2 Nephi 12` displays `(LE 28-30)`.

All 114 numbered RE Book of Mormon chapters are covered in list and preview-card mode. The generated lookup supplies display titles without renaming stored chapters. Exact canonical names are used elsewhere for edition switching and saved reading screens, so editing database names would have introduced navigation risk.

## 2. Extend the same labels to Covenant of Christ

**Request:** Apply the same chapter labels to Covenant of Christ, whose chapter divisions should match the RE Book of Mormon.

All 114 numbered chapters in each edition were compared. The chapter divisions and LE chapter ranges match, so both editions use the shared generated lookup. Regeneration refuses to proceed if the two editions cease to match. The scripture wording remains edition-specific.

## 3. Add traditional Bible chapter references

**Request:** Extend reference labels to the Old and New Testaments, whose RE divisions also differ from familiar Bible chapters.

All 417 numbered Old Testament chapters and 89 numbered New Testament chapters receive labels. The existing `LE` suffix convention is used for traditional Bible chapters as well.

Examples:

- `Genesis 1 (LE Moses 1)` — this RE chapter corresponds to Moses 1, not a traditional Genesis chapter.
- `Genesis 2 (LE 1-3)`.
- `Genesis 12 (LE 46-50)`.
- `Romans (LE 1-16)` — this book opens directly into its reader, so the label is added to the book list/card rather than relying on a chapter screen the user never sees.

## 4. Add precise D&C references to Teachings & Commandments

**Request:** Make D&C correspondences visible while browsing T&C, accounting for reordered material, missing counterparts, split sections, and added material.

The display labels cover 115 T&C section entries plus 10 Joseph Smith History parts. They preserve exact mapped verse sets, not just a broad first-to-last section range.

| Entry | Resulting label |
|---|---|
| T&C 138 | `Section 138 (D&C 121:1-33)` |
| T&C 139 | `Section 139 (D&C 121:34-46; 122:1-9; 123:1-17)` |
| T&C 55 | `Section 55 (D&C 68:1-15, 22-35)` |
| T&C 1 parent | `Section 1 - Joseph Smith History (D&C 2-23 selections)` |

The nested Joseph Smith History entries provide the precise references behind the parent summary. Entries without a stored D&C mapping retain their original names. This means “no reference supplied by this mapping,” not a claim that every historical parallel has been ruled out.

## 5. Replace T&C groups with a continuous indexed list

**Request:** Remove `Section 1-10`, `Section 11-20`, etc. submenus. Show sections individually, with a Contacts-style numeric index on the right.

The T&C tab now contains all 185 numbered sections in numeric order, with front matter before them and appendix entries afterward. The rail contains `↑`, `1`, `10`, `20`, …, `180`, `↓`. Each number is a button that jumps to the named section; 10 targets section 10, not section 11. This is a tap/click index; dragging along the index to scrub through it has not been implemented.

The existing layout toggle switches between a continuous list and preview cards. Both show the same labels and have the same jump shortcuts. Cards use two columns in portrait and three in landscape. The rail has reserved horizontal space and adapts its height to the available screen.

Actual row positions are measured instead of assuming a fixed height. This is necessary because references can wrap onto multiple lines. The bounded collection is rendered in a ScrollView, so distant rows are measured before the user taps a shortcut. This trades some rendering work for reliable variable-height jumps; physical-device performance remains to be measured.

Sections 1 (Joseph Smith History), 110 (Lectures on Faith), 145 (Abraham), and 171 (The Testimony of St. John) retain their nested destinations. The old grouping component and store remain in the upstream source, but the T&C tab no longer uses them.

Near the bottom, a jump is limited by the end of the scrollable content. Tapping 180 reveals the final sections without necessarily placing 180 at the very top. In card mode the target shares a row with its neighbor.

## 6. Make extended labels readable and fix preview layout

Optional display-title props were added to the shared list, book-card, and chapter-preview components. Extended list rows grow to fit their text. Chapter-preview headings can wrap and use a minimum header height rather than a fixed clipped header.

During implementation, the previous T&C grid was found to request three columns while its cards occupied half the available width. Some cards consequently disappeared off the row. The new grid computes widths from its real container and column count. Chapter previews also receive an explicit width consistent with their column count.

These shared components affect other callers' preview styling, even when a caller supplies no new reference label. Their canonical navigation records and scripture content remain unchanged.

## 7. Keep the test installation separate and reversible

**Request:** Make the modified app easy to try and easy to stop using if something breaks.

The test app is named **Scriptures LE Test**, with bundle ID `info.scriptures.rescriptures.lelabels` and URL scheme `rescriptures-lelabels`. The original app identity, signing team, associated-domain claims, EAS project linkage, and upstream updates are removed from the test configuration. Sentry reporting is disabled.

A small Swift/AppKit launcher was installed in Applications on the development Mac. It opens a dedicated iPad Simulator, reuses the test installation and saved state, and can reinstall a bundled simulator app if missing. It does not convert the app into a native Mac application. Its source is preserved in `launcher/Launcher.swift`; compiled launchers and payloads are excluded from Git.

**Scrolling:** The user confirmed that clicking and holding, then dragging, scrolls successfully in Simulator. Ordinary Mac-style wheel/trackpad scrolling was not successfully verified. This gesture requirement belongs to the current Simulator workflow and must be checked again for a standalone Mac build.

## 8. iPhone and standalone Mac work: requested, not delivered yet

The same React Native source targets iPhone and iPad, and the features were checked in both simulators. The original App Store Mac installation is an iOS app running on Apple Silicon. This does not make a simulator build installable on a physical iPhone or directly runnable as a standalone Mac app.

No physical iPhone installation, App Store release, TestFlight distribution, or standalone Mac port has been completed. Apple signing and platform-specific build/validation remain separate work. No code or messages have been sent to the original developer.

## Scope preserved

This modification does not rewrite scripture, change verse markers, migrate the original user's highlights, edit the original installed app, or add reference suffixes to reader-body chapter headings. It changes navigation presentation and provides an isolated test configuration.
