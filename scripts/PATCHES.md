# Local patches on vendored scripture source

The XML under `scripts/0001_oc` .. `scripts/0007_cc` is pulled wholesale from
an upstream source repo and periodically overwrites this tree entirely (a
full directory replace, not a merge). Any local-only edits made directly in
that tree — new files or small textual fixes — get clobbered by the next
pull unless captured as patches first.

`save-local-patches.js` / `apply-local-patches.js` give this the same
workflow as [patch-package](https://github.com/ds300/patch-package): diff
against a known-good baseline, save the diffs as `.patch` files, replay them
after the vendor tree is refreshed.

## After pulling fresh files from the source repo

1. Commit the fresh vendor files, then tag the baseline:
   ```
   git tag vendor-sync-YYYY-MM-DD
   ```
2. Replay any saved local patches on top:
   ```
   node scripts/apply-local-patches.js
   ```
   Failures are reported by filename — that means upstream changed the same
   lines you patched. Open the `.patch` file in `scripts/local-patches/`,
   re-apply the edit by hand against the new source, then regenerate it (see
   below).
3. Rebuild and verify:
   ```
   node scripts/RebuildDatabase.js
   node scripts/VerifyDatabase.js
   ```

## When you make a new local edit or addition

Edit or add files directly under `scripts/000N_*` as usual, then:

```
node scripts/save-local-patches.js
```

This diffs the vendored dirs against the latest `vendor-sync-*` tag and
writes one `.patch` file per changed/added path into `scripts/local-patches/`,
clearing any stale ones. Commit `scripts/local-patches/` along with your
change.

## Notes

- Only `scripts/0001_oc` .. `scripts/0007_cc` are tracked by this mechanism —
  not `book_synonyms.sql`, `reference_mapping.sql`, `RebuildDatabase.js`, or
  `VerifyDatabase.js`, which are hand-maintained directly in this repo.
- If no `vendor-sync-*` tag exists yet, `save-local-patches.js` will error
  asking you to create one against the last known-clean vendor commit.
