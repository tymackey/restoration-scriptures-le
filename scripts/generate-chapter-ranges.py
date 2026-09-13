#!/usr/bin/env python3
"""Regenerate (or --check) chapter and section labels from the bundled DB."""
import argparse
import json
from pathlib import Path
import sqlite3

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--check", action="store_true")
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
db = sqlite3.connect(
    (root / "assets/scriptures_v2.1.db").as_uri() + "?mode=ro&immutable=1",
    uri=True,
)


def ranges(volume):
    result = {}
    for book, chapter, target in db.execute(
        """SELECT DISTINCT book, chapter, target_chapter FROM reference_mapping
           WHERE volume=? AND target_edition='le' AND target_work='bofm'
             AND target_book=book ORDER BY book, chapter, target_chapter""",
        (volume,),
    ):
        result.setdefault(f"{book}:{chapter}", []).append(target)
    chapter_keys = {
        f"{book}:{chapter}"
        for book, chapter in db.execute(
            """SELECT book_id, book_chapter FROM chapters
               WHERE volume_id=? AND CAST(book_chapter AS INTEGER)>0""",
            (volume,),
        )
    }
    if set(result) != chapter_keys:
        raise SystemExit(f"Incomplete chapter mappings in {volume}")
    return result


mapping = ranges("bofm")
if mapping != ranges("cc"):
    raise SystemExit("RE and CoC chapter ranges differ; do not generate a shared table.")
# Traditional Bible chapters only: exclude JST and parallel PGP mappings.
bible = {}
for volume, book, chapter, target in db.execute(
    """SELECT DISTINCT volume,book,chapter,target_chapter FROM reference_mapping
       WHERE ((volume='oc' AND target_work='ot') OR
              (volume='nt' AND target_work='nt'))
         AND target_edition='le' AND target_book=book
       ORDER BY volume,book,chapter,target_chapter"""
):
    bible.setdefault(f"{volume}:{book}:{chapter}", []).append(target)
# Genesis 1 is Moses 1, with no traditional Genesis counterpart.
alternates = {}
for book, chapter, target_book, target_chapter in db.execute(
    """SELECT DISTINCT book,chapter,target_book,target_chapter FROM reference_mapping
       WHERE volume='oc' AND target_work='pgp' ORDER BY book,chapter,target_chapter"""
):
    key = f"oc:{book}:{chapter}"
    if key not in bible:
        if target_book != "moses":
            raise SystemExit(f"Unrecognized Bible alternative: {key} {target_book}")
        alternates[key] = f"LE Moses {target_chapter}"
expected_bible = {
    f"{v}:{b}:{ch}" for v,b,ch in db.execute(
        "SELECT volume_id,book_id,book_chapter FROM chapters WHERE volume_id IN ('oc','nt') AND CAST(book_chapter AS INTEGER)>0"
    )
}
if set(bible) | set(alternates) != expected_bible:
    raise SystemExit("Incomplete Bible mappings")

# Preserve exact D&C verses, including gaps and multiple source sections.
dc = {}
for book, chapter, section, verse in db.execute(
    """SELECT DISTINCT book,chapter,target_chapter,target_verse FROM reference_mapping
       WHERE volume='tc' AND target_edition='le' AND target_work='dc'
       AND target_book='section' ORDER BY book,chapter,target_chapter,target_verse"""
):
    dc.setdefault(f"{book}:{chapter}", {}).setdefault(str(section), []).append(verse)
db.close()

begin = "// BEGIN GENERATED LE CHAPTER RANGES\n"
end = "// END GENERATED LE CHAPTER RANGES"
block = "export const legacyChapterRanges: Record<string, number[]> = {\n"
block += "".join(
    f"    {json.dumps(key)}: {json.dumps(value)},\n" for key, value in mapping.items()
)
block += "};\n"
for name, values, kind in [
    ("bibleChapterRanges", bible, "number[]"),
    ("alternateChapterLabels", alternates, "string"),
    ("dcVerseReferences", dc, "Record<string, number[]>"),
]:
    block += f"export const {name}: Record<string, {kind}> = {{\n"
    block += "".join(f"    {json.dumps(key)}: {json.dumps(value)},\n" for key, value in values.items())
    block += "};\n"
path = root / "app/util/chapterLabels.ts"
text = path.read_text()
before, rest = text.split(begin, 1)
_, after = rest.split(end, 1)
updated = before + begin + block + end + after
if args.check:
    if text != updated:
        raise SystemExit("Chapter range table is stale; regenerate it.")
    print(f"Verified {len(mapping)} shared RE/CoC, {len(expected_bible)} Bible, and {len(dc)} T&C mappings.")
else:
    path.write_text(updated)
    print(f"Generated {len(mapping)} shared RE/CoC, {len(expected_bible)} Bible, and {len(dc)} T&C mappings.")
