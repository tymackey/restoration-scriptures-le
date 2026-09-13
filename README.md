# Scriptures LE Test

Ty Mackey's personal modification of **Restoration Scriptures**, adding familiar chapter and section references to scripture navigation. This repository preserves the modified source, the original comparison baseline, and the decisions behind every requested change.

**Status: working iPhone/iPad Simulator build.** On the development Mac, an Applications launcher opens the test app in iPad Simulator. A standalone Mac build and a signed physical-iPhone installation remain future work. This is an unofficial personal project, not an official release.

## What changed

- **Book of Mormon and Covenant of Christ:** all 114 numbered chapters in each edition display their corresponding LDS-edition chapter ranges, such as `2 Nephi 1 (LE 1-2)`.
- **Bible:** all 417 Old Testament and 89 New Testament chapters have traditional-reference labels. Books that open directly into the reader also show their labels in the book picker.
- **Teachings & Commandments:** 115 section entries and 10 Joseph Smith History parts show exact D&C references, including partial sections and gaps.
- **T&C navigation:** one continuous list of all 185 sections replaces the ten-section submenus. A right-hand index jumps to `1`, `10`, `20`, …, `180`, with arrows for front matter and appendix. Preview cards remain available.
- **Readability:** long labels wrap; preview card widths match the actual column count.
- **Separate test identity:** the original app and its saved data remain separate. Upstream crash reporting and Expo updates are disabled in this test copy.

Scripture wording, canonical chapter names, verse numbering, and the existing red references in the reader are preserved. The new labels are navigation titles; reader-body chapter headings have not been changed.

## Documentation

| Document | Contents |
|---|---|
| [Changes and decisions](mod-docs/CHANGES.md) | Each user request, before/after behavior, implementation, and scope |
| [Complete label audit](mod-docs/CHAPTER-LABEL-AUDIT.md) | Every generated chapter and section label |
| [Mapping methodology](mod-docs/MAPPINGS.md) | Sources, coverage, partial chapters, D&C gaps, and exceptions |
| [Build and run](mod-docs/BUILD.md) | Local Simulator build, launcher limitations, and device requirements |
| [Validation and limitations](mod-docs/VALIDATION.md) | Automated checks, native checks, user-confirmed scrolling, and remaining work |
| [Maintenance and rollback](mod-docs/MAINTENANCE.md) | File map, update procedure, and recovery options |
| [Upstream attribution](mod-docs/UPSTREAM.md) | Original repository, snapshot commit, unchanged assets, and rights notices |

## Quick verification

Use Node.js 24+ and Python 3. These mapping/index checks do not require installing npm dependencies:

```sh
node --test scripts/verify-chapter-labels.mjs scripts/verify-tc-index.mjs
python3 scripts/generate-chapter-ranges.py --check
```

To build the app, follow [Build and run](mod-docs/BUILD.md). This repository contains source and the bundled scripture database, not compiled app bundles or personal annotations.

## History

`upstream-3.1.0-snapshot` is an exact tracked-file snapshot of upstream commit `b80f2be5250d7cf8606db3c43aaf58eda4a26bd9`. The following commits separately record navigation features, test-app isolation, and this documentation. The original upstream Git history remains in GitLab; it was not imported into this repository.

```sh
git diff upstream-3.1.0-snapshot..main -- app App.tsx app.json
git log --oneline
```
