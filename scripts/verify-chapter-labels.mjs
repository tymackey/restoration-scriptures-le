// Dependency-free checks against the real scripture database. Node 24+.
// Run: node --test scripts/verify-chapter-labels.mjs
import assert from "node:assert/strict";
import { test, after } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import {
    legacyChapterRanges,
    bibleChapterRanges,
    alternateChapterLabels,
    dcVerseReferences,
    formatBookListLabel,
    formatLegacyChapterRange,
    formatChapterListLabel,
} from "../app/util/chapterLabels.ts";

const db = new DatabaseSync(
    process.env.SCRIPTURE_DB ??
        fileURLToPath(new URL("../assets/scriptures_v2.1.db", import.meta.url)),
    { readOnly: true },
);
after(() => db.close());
const query = db.prepare(`SELECT chapter_id, volume_id, book_id, book_chapter,
    chapter_name AS name, SUBSTR(content,1,600) AS preview FROM chapters
    WHERE book_id=? AND volume_id=? ORDER BY chapter_id`);
const storedRanges = db.prepare(`SELECT DISTINCT target_chapter FROM reference_mapping
    WHERE volume=? AND book=? AND chapter=? AND target_edition='le'
    AND target_work='bofm' AND target_book=book ORDER BY target_chapter`);

for (const volume of ["bofm", "cc"]) {
    test(`${volume}: all fifteen 2 Nephi labels match the LE chapters`, () => {
        const expected = [
            "1-2", "3", "4", "5", "6-8", "9", "10", "11-15", "16-22",
            "23-24", "25-27", "28-30", "31", "32", "33",
        ];
        assert.deepEqual(
            query.all("2nephi", volume).map(formatChapterListLabel),
            expected.map((le, i) => `2 Nephi ${i + 1} (LE ${le})`),
        );
    });

    test(`${volume}: every numbered chapter has a mapping`, () => {
        const books = db.prepare("SELECT book_id FROM books WHERE volume_id=?").all(volume);
        let mapped = 0;
        for (const { book_id } of books) {
            let currentLeChapter = null;
            for (const row of query.all(book_id, volume)) {
                if (!(Number(row.book_chapter) > 0)) continue;
                const expectedRanges = storedRanges.all(volume, row.book_id, Number(row.book_chapter)).map(r => r.target_chapter);
                assert.ok(expectedRanges.length, row.name);
                assert.deepEqual(legacyChapterRanges[`${row.book_id}:${row.book_chapter}`], expectedRanges, row.name);
                assert.match(formatChapterListLabel(row), / \(LE \d/);
                // Independently compare the stored verse-boundary markers to the
                // lookup table, so a mapping error cannot silently label a chapter.
                const { content } = db.prepare("SELECT content FROM chapters WHERE chapter_id=?").get(row.chapter_id);
                // RE divisions sometimes split an LE chapter. Carry the last LE
                // chapter across that boundary (e.g. 1 Nephi 6 starts at LE 19:22).
                const seen = new Set();
                for (const token of content.matchAll(/LEChapter(\d+)|\bVerse(\d+)\b/g)) {
                    if (token[1]) currentLeChapter = Number(token[1]);
                    else {
                        assert.ok(currentLeChapter, row.name);
                        seen.add(currentLeChapter);
                    }
                }
                const markers = [...seen].sort((a, b) => a - b);
                assert.deepEqual(expectedRanges, markers, row.name);
                mapped++;
            }
        }
        assert.equal(mapped, 114);
    });
}

test("all 114 Covenant of Christ chapters match the RE Book of Mormon labels", () => {
    const numberedChapters = (volume) => db.prepare(
        `SELECT book_id, book_chapter FROM chapters
         WHERE volume_id=? AND CAST(book_chapter AS INTEGER)>0
         ORDER BY book_id, CAST(book_chapter AS INTEGER)`,
    ).all(volume);
    assert.deepEqual(numberedChapters("cc"), numberedChapters("bofm"));
    let compared = 0;
    for (const {book_id} of db.prepare("SELECT book_id FROM books WHERE volume_id='bofm'").all()) {
        const reChapters = query.all(book_id, "bofm").filter(row => Number(row.book_chapter) > 0);
        const ccChapters = new Map(query.all(book_id, "cc").map(row => [row.book_chapter, row]));
        for (const re of reChapters) {
            const cc = ccChapters.get(re.book_chapter);
            assert.ok(cc, re.name);
            assert.deepEqual(
                storedRanges.all("cc", book_id, Number(cc.book_chapter)),
                storedRanges.all("bofm", book_id, Number(re.book_chapter)),
                re.name,
            );
            assert.equal(formatChapterListLabel(cc), formatChapterListLabel(re), re.name);
            compared++;
        }
    }
    assert.equal(compared, 114);
});

test("canonical navigation fields and scripture previews are unchanged", () => {
    const books = db.prepare("SELECT volume_id, book_id FROM books").all();
    for (const { volume_id, book_id } of books) {
        const original = db.prepare(`SELECT chapter_id, volume_id, book_id, book_chapter,
            chapter_name AS name, SUBSTR(content,1,600) AS preview FROM chapters
            WHERE book_id=? AND volume_id=? ORDER BY chapter_id`).all(book_id, volume_id);
        const rows = query.all(book_id, volume_id);
        assert.deepEqual(rows.map(row => ({...row})), original.map(row => ({...row})));
        for (const row of rows) {
            const before = { ...row };
            formatChapterListLabel(row);
            assert.deepEqual({ ...row }, before);
            if (!["bofm", "cc", "oc", "nt", "tc"].includes(volume_id) || !(Number(row.book_chapter) > 0)) {
                assert.equal(formatChapterListLabel(row), row.name);
            }
        }
    }
});

test("gaps, duplicate references, and absent mappings are handled", () => {
    assert.equal(formatLegacyChapterRange([5,1,2,2,7,8]), "1-2, 5, 7-8");
    assert.equal(formatLegacyChapterRange([]), "");
    assert.equal(formatLegacyChapterRange([NaN,0,-1,2.5]), "");
    const item = {name:"Example 1", volume_id:"bofm", book_id:"unknown", book_chapter:1};
    assert.equal(formatChapterListLabel(item), item.name);
    assert.equal(formatChapterListLabel({...item, book_id:"2nephi", volume_id:"oc"}), item.name);
    assert.equal(formatChapterListLabel({...item, book_id:"2nephi", volume_id:"cc"}), "Example 1 (LE 1-2)");
});

for (const volume of ["oc", "nt"]) {
    test(`${volume}: every traditional Bible chapter range agrees with inline markers`, () => {
        let count = 0;
        for (const { book_id } of db.prepare("SELECT book_id FROM books WHERE volume_id=?").all(volume)) {
            let current = null;
            for (const row of query.all(book_id, volume)) {
                if (!(Number(row.book_chapter) > 0)) continue;
                const { content } = db.prepare("SELECT content FROM chapters WHERE chapter_id=?").get(row.chapter_id);
                const seen = new Set();
                for (const token of content.matchAll(/LEChapter(\d+)|\bVerse(\d+)\b/g)) {
                    if (token[1]) current = Number(token[1]);
                    else { assert.ok(current, row.name); seen.add(current); }
                }
                const key = `${volume}:${book_id}:${row.book_chapter}`;
                const expected = [...seen].sort((a,b) => a-b);
                assert.deepEqual(bibleChapterRanges[key] ?? [], expected, key);
                if (!expected.length) {
                    assert.equal(key, "oc:genesis:1");
                    assert.equal(alternateChapterLabels[key], "LE Moses 1");
                    assert.equal(formatChapterListLabel(row), "Genesis 1 (LE Moses 1)");
                } else {
                    assert.equal(formatChapterListLabel(row), `${row.name} (LE ${formatLegacyChapterRange(expected)})`);
                }
                count++;
            }
        }
        assert.equal(count, volume === "oc" ? 417 : 89);
    });
}

test("Genesis divisions, including partial traditional chapters", () => {
    const expected = ["Moses 1", "1-3", "4-5", "5", "5-9", "10-11", "12-20", "21-25", "25-35", "36", "37-46", "46-50"];
    assert.deepEqual(query.all("genesis", "oc").map(formatChapterListLabel),
        expected.map((range,i) => `Genesis ${i+1} (LE ${range})`));
});

test("single-chapter Bible books show the range before opening the reader", () => {
    assert.equal(formatBookListLabel({name:"Romans",id:"romans",volume_id:"nt",num_chapters:1}), "Romans (LE 1-16)");
    assert.equal(formatBookListLabel({name:"Malachi",id:"malachi",volume_id:"oc",num_chapters:1}), "Malachi (LE 1-4)");
    assert.equal(formatBookListLabel({name:"Genesis",id:"genesis",volume_id:"oc",num_chapters:12}), "Genesis");
    assert.equal(formatBookListLabel({name:"Preface",id:"ntpreface",volume_id:"nt",num_chapters:1}), "Preface");
});

test("all D&C references preserve the exact mapped verses, gaps, and section identities", () => {
    const expected = {};
    const rows = db.prepare(`SELECT DISTINCT book, chapter, target_chapter, target_verse
        FROM reference_mapping WHERE volume='tc' AND target_edition='le' AND target_work='dc'
        AND target_book='section' ORDER BY book,chapter,target_chapter,target_verse`).all();
    for (const row of rows) {
        const item = expected[`${row.book}:${row.chapter}`] ??= {};
        (item[row.target_chapter] ??= []).push(row.target_verse);
    }
    assert.deepEqual(dcVerseReferences, expected);
    assert.equal(Object.keys(expected).length, 125);
    let checked = 0;
    for (const book of ["section", "jshistory"]) {
        for (const row of query.all(book, "tc")) {
            const references = expected[`${book}:${row.book_chapter}`];
            if (!references) {
                if (book !== "section" || String(row.book_chapter) !== "1") {
                    assert.equal(formatChapterListLabel(row), row.name);
                }
                continue;
            }
            const label = formatChapterListLabel(row);
            assert.match(label, / \(D&C /);
            // Expand the displayed ranges back into individual references: a
            // missing verse must not silently become part of a continuous span.
            const parsed = {};
            for (const reference of label.split(" (D&C ")[1].slice(0,-1).split("; ")) {
                const [section, ranges] = reference.split(":");
                parsed[section] = ranges.split(", ").flatMap(range => {
                    const [start,end=start] = range.split("-").map(Number);
                    return Array.from({length:end-start+1}, (_,i) => start+i);
                });
            }
            assert.deepEqual(parsed, references, row.name);
            checked++;
        }
    }
    assert.equal(checked, 125);
});

test("D&C section text markers independently agree with the correspondence table", () => {
    let current = null;
    let checked = 0;
    for (const row of query.all("section", "tc")) {
        const references = dcVerseReferences[`section:${row.book_chapter}`];
        if (!references) continue;
        // Section 154 lacks a chapter marker; its official heading identifies
        // D&C 107. Source: https://scriptures.info/scriptures/tc/section/154
        if (Number(row.book_chapter) === 154) current = 107;
        const {content} = db.prepare("SELECT content FROM chapters WHERE chapter_id=?").get(row.chapter_id);
        const seen = {};
        for (const token of content.matchAll(/LEChapter(\d+)|\bVerse(\d+)\b/g)) {
            if (token[1]) current = Number(token[1]);
            else { assert.ok(current, row.name); (seen[current] ??= new Set()).add(Number(token[2])); }
        }
        const actual = Object.fromEntries(Object.entries(seen).map(([k,v]) => [k,[...v].sort((a,b)=>a-b)]));
        assert.deepEqual(actual, references, row.name);
        checked++;
    }
    assert.equal(checked, 115);
});

test("T&C examples include split sections, missing verses, and embedded D&C material", () => {
    const label = chapter => formatChapterListLabel(query.all("section", "tc").find(row => Number(row.book_chapter) === chapter));
    assert.equal(label(138), "Section 138 (D&C 121:1-33)");
    assert.equal(label(139), "Section 139 (D&C 121:34-46; 122:1-9; 123:1-17)");
    assert.equal(label(11), "Section 11 (D&C 30:1-4)");
    assert.equal(label(12), "Section 12 (D&C 30:5-8)");
    assert.equal(label(13), "Section 13 (D&C 30:9-11)");
    assert.equal(label(26), "Section 26 (D&C 42:1-37, 39-72)");
    assert.equal(label(55), "Section 55 (D&C 68:1-15, 22-35)");
    assert.equal(label(1), "Section 1 - Joseph Smith History (D&C 2-23 selections)");
    assert.equal(label(156), "Section 156");
});
