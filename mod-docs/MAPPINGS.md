# Mapping sources and decisions

## Primary data

The runtime lookup is generated from `assets/scriptures_v2.1.db`, the existing bundled scripture database. Its SHA-256 is:

```
4ec111b3eea6157434c2b34f6b5ccf3dba48fcca5eb97ec8a79c14034b7a1738
```

This matched the database in the original Mac installation during development. The database is not modified by this feature. The older upstream `scriptures_v2.db` is also retained as part of the original source snapshot; the new generator and checks explicitly use v2.1.

`reference_mapping` provides the cross-edition references. `scripts/generate-chapter-ranges.py` opens the database read-only and emits the marked generated block in `app/util/chapterLabels.ts`. Display formatters live after that block. The app uses the generated values without issuing an extra lookup during database initialization.

An early experimental runtime lookup caused a native SQLite abort during initialization. That approach was replaced; the final feature leaves the upstream database queries intact. The generated lookup avoids that additional initialization query.

## Coverage

| Work | Covered entries | Display convention |
|---|---:|---|
| RE Book of Mormon | 114 numbered chapters | `(LE chapter-range)` |
| Covenant of Christ | 114 numbered chapters | Same verified chapter ranges |
| Old Testament | 417 numbered chapters | Traditional chapter ranges, plus Moses 1 exception |
| New Testament | 89 numbered chapters | Traditional chapter ranges |
| T&C | 115 section entries | Exact D&C verse sets, with section 1 parent summary |
| Joseph Smith History | 10 nested parts | Exact D&C verse sets |

The T&C navigation list contains all 185 sections, whether or not a D&C reference exists.

## Book of Mormon and Covenant of Christ

The generator selects `target_edition='le'`, `target_work='bofm'`, and matching book IDs. It collects distinct LE chapter numbers per RE chapter and checks that every numbered chapter is represented. It separately derives Covenant of Christ ranges and requires them to equal the RE Book of Mormon ranges before writing a shared table.

The verification script independently reads inline LE markers from each edition's text. At a division inside an LE chapter, it carries the previously encountered LE chapter into the next RE chapter. Thus RE 1 Nephi 6 includes LE chapter 19 even though it begins at verse 19:22. A chapter range describes chapters represented; it does not assert that every verse of those chapters is present.

## Bible

For `oc`, the generator selects traditional `ot` mappings; for `nt`, traditional `nt` mappings. It requires matching book IDs and the LE target edition, avoiding unrelated parallel mappings.

RE Genesis 1 has no traditional Genesis counterpart. Its PGP mapping identifies Moses 1, so it displays `(LE Moses 1)`. The generator rejects unknown alternate cases instead of inventing a label. The automated checks compare all ordinary Bible chapter sets against inline text markers.

Single-chapter books can bypass the chapter picker. `formatBookListLabel` ensures their reference ranges appear where the user actually selects the book.

## T&C and D&C

The generator selects T&C-to-LE-D&C mappings and preserves the exact section/verse sets. Adjacent verses become ranges; gaps remain visible; separate D&C sections are separated by semicolons.

Two cases needed explicit source review:

- **T&C 139:** its webpage heading omits D&C 123, but the section text and database mapping contain D&C 123:1-17. The display includes that material alongside D&C 121:34-46 and 122:1-9.
- **T&C 154:** the text lacks the expected inline D&C chapter marker. The official section heading supplies D&C 107:40-57 and supports the existing mapping.

No D&C mapping is treated as a reason to leave the original display name unchanged, not as proof that no counterpart exists. T&C 1 receives a parent summary because its individual history parts carry the detailed correspondences.

## Website references checked during development

- [Reference translator](https://scriptures.info/Scriptures/ReferenceTranslator)
- [Old Testament preface](https://scriptures.info/scriptures/oc/ocpreface)
- [New Testament preface](https://scriptures.info/scriptures/nt/ntpreface)
- [T&C 138](https://scriptures.info/scriptures/tc/section/138)
- [T&C 139](https://scriptures.info/scriptures/tc/section/139)
- [T&C 154](https://scriptures.info/scriptures/tc/section/154)

The generated table represents the bundled database snapshot, not a live synchronization with subsequent website changes. [CHAPTER-LABEL-AUDIT.md](CHAPTER-LABEL-AUDIT.md) records every resulting label.
