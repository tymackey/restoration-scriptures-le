# Maintenance, file map, and rollback

## Feature file map

| File | Responsibility |
|---|---|
| `app/util/chapterLabels.ts` | Generated mappings plus display formatters; preserves canonical names |
| `scripts/generate-chapter-ranges.py` | Read-only regeneration/verification against v2.1 DB |
| `scripts/verify-chapter-labels.mjs` | 14 reference and preservation checks |
| `app/util/tcSectionIndex.ts` | Numeric section ordering, front/appendix placement, exact jump destinations |
| `scripts/verify-tc-index.mjs` | 3 section/index checks |
| `app/components/IndexedSectionList.tsx` | Continuous list/cards, measured offsets, right-side buttons |
| `app/components/ScriptureListItem.tsx` | Optional display title and multiline extended labels |
| `app/components/ScripturePreviewItem.tsx` | Optional title/width and wrapping preview headers |
| `app/components/ScriptureCardItem.tsx` | Optional book-card display title |
| `app/components/VolumeList.tsx` | Book-level labels for direct-to-reader books |
| `app/screens/chapter.tsx` | Chapter list/preview labels and matching preview widths |
| `app/screens/mc.tsx` | Continuous T&C view, retaining existing nested destinations |
| `App.tsx`, `app.json` | Isolated test identity and disabled upstream reporting/updates |
| `launcher/Launcher.swift` | Development Mac's Simulator convenience launcher |

## Updating scripture data

1. Preserve the current database/version and establish the source of its replacement.
2. Replace the bundled database intentionally; do not change chapter names to add labels.
3. Run `python3 scripts/generate-chapter-ranges.py`.
4. Run both Node verification scripts and TypeScript checking.
5. Review new or changed labels and update `CHAPTER-LABEL-AUDIT.md` and coverage counts. The audit document is a snapshot, not automatically refreshed by the generator.
6. Rebuild and check the UI with particular attention to split chapters, missing references, long D&C labels, and changed section totals.

The generator deliberately stops when RE and Covenant of Christ ranges differ or Bible mapping coverage is incomplete. Investigate the source change rather than bypassing that failure.

## Comparing with the original

The repository's root commit is a faithful tracked-file snapshot of the upstream revision, tagged `upstream-3.1.0-snapshot`. It is followed by a feature commit, a test-isolation commit, and documentation/packaging commits. This is a new Git history with an explicit upstream baseline, not the full GitLab history.

```sh
git log --oneline
git diff upstream-3.1.0-snapshot..main -- app scripts/generate-chapter-ranges.py scripts/verify-chapter-labels.mjs scripts/verify-tc-index.mjs
git diff upstream-3.1.0-snapshot..main -- App.tsx app.json
```

The feature-only patch is preserved as `mod-docs/chapter-labels.patch`. It applies to a clean checkout of upstream commit `b80f2be5250d7cf8606db3c43aaf58eda4a26bd9`. The separate `test-build-isolation.patch` records the configuration used for the test build. Both sets of changes are already applied on this repository's `main`; do not apply them again there.

## Returning to the original app

Quit Simulator and open the original **Restoration Scriptures** installation. The test app has a different bundle identity and separate settings/history/annotations. Deleting the Mac launcher removes the shortcut, not the original app or the simulator's saved data. Deleting the test app inside Simulator removes that test installation and may remove its local data, so export wanted annotations first.

## Code rollback without losing current work

Use a new branch/worktree for experiments and preserve uncommitted changes before reverting. To inspect the original source without replacing your current checkout:

```sh
git worktree add ../restoration-scriptures-upstream upstream-3.1.0-snapshot
```

For a rollback that keeps the personal app's separate identity, revert the navigation-feature commit on a separate branch, leaving the isolation commit in place. Remove or revise its dependent mod-only tests/docs as appropriate. Building the raw upstream snapshot restores the original app IDs, so it should not be used as an isolated test configuration without applying the isolation changes.

Two prior compiled builds remain in the development workspace's `output/restoration-scriptures-mod/backups/`: the Book of Mormon/CoC-only build and the pre-continuous-list build. They are local backups, not GitHub assets. The installed Applications launcher currently bundles the final indexed-list simulator build.

## Repository contents

The source, upstream bundled database/assets, patches, launcher source, documentation, and verification scripts are versioned. `node_modules`, Pods, generated native projects, compiled apps, backup zips, device state, annotations, signing files, and build logs are excluded. The parent workspace's unrelated scripture transcription and research outputs were not uploaded.
