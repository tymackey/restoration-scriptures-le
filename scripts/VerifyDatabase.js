"use strict";
/* eslint-env node */

/**
 * VerifyDatabase.js  —  Post-build database verification tests
 *
 * Verifies schema correctness and data integrity after running RebuildDatabase.js.
 * Mirrors every query in app/data/useDatabase.ts to confirm compatibility.
 *
 * Run from inside scripts/:
 *   node VerifyDatabase.js                       # default: ../assets/scriptures_v2.1.db
 *   node VerifyDatabase.js path/to/database.db  # specify a different DB file
 *
 * Requires Node.js 18+ (uses built-in node:test runner).
 * Exit code 0 = all tests passed; non-zero = one or more failures.
 */

const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const Database = require("better-sqlite3");

// ─── Open DB ─────────────────────────────────────────────────────────────────

const DB_PATH =
    process.argv[2] ??
    path.join(__dirname, "..", "assets", "scriptures_v2.1.db");
let db;
try {
    db = new Database(DB_PATH, { readonly: true });
} catch (err) {
    console.error(`Cannot open database at ${DB_PATH}: ${err.message}`);
    process.exit(1);
}

// Helpers
const all = (sql, params = []) => db.prepare(sql).all(params);
const get = (sql, params = []) => db.prepare(sql).get(params);
const cnt = (sql, params = []) => db.prepare(sql).get(params).n;
const chapterName = (volumeId, bookId, bookChapter) =>
    db
        .prepare(
            "SELECT chapter_name FROM chapters WHERE volume_id=? AND book_id=? AND book_chapter=?",
        )
        .get(volumeId, bookId, bookChapter)?.chapter_name;

// ─── 1. Schema ────────────────────────────────────────────────────────────────

describe("1. Schema", () => {
    test("all required tables exist", () => {
        const tables = db
            .prepare(`SELECT name FROM sqlite_master WHERE type='table'`)
            .all()
            .map((r) => r.name);
        for (const t of [
            "volumes",
            "books",
            "chapters",
            "paragraphs",
            "synonyms",
            "reference_mapping",
            "fts_paragraphs",
        ]) {
            assert.ok(tables.includes(t), `Missing table: ${t}`);
        }
    });

    test("volumes columns", () => {
        const cols = db
            .prepare("PRAGMA table_info(volumes)")
            .all()
            .map((r) => r.name);
        for (const c of [
            "volume_id",
            "name",
            "volume_order",
            "reference_name",
        ]) {
            assert.ok(cols.includes(c), `Missing column volumes.${c}`);
        }
    });

    test("books columns", () => {
        const cols = db
            .prepare("PRAGMA table_info(books)")
            .all()
            .map((r) => r.name);
        for (const c of [
            "volume_id",
            "book_id",
            "name",
            "book_order",
            "reference_name",
        ]) {
            assert.ok(cols.includes(c), `Missing column books.${c}`);
        }
    });

    test("chapters columns", () => {
        const cols = db
            .prepare("PRAGMA table_info(chapters)")
            .all()
            .map((r) => r.name);
        for (const c of [
            "chapter_id",
            "volume_id",
            "book_id",
            "book_chapter",
            "chapter_name",
            "content",
        ]) {
            assert.ok(cols.includes(c), `Missing column chapters.${c}`);
        }
    });

    test("paragraphs columns", () => {
        const cols = db
            .prepare("PRAGMA table_info(paragraphs)")
            .all()
            .map((r) => r.name);
        for (const c of [
            "paragraph_id",
            "volume_id",
            "book_id",
            "chapter_id",
            "position",
            "text",
            "paratext",
        ]) {
            assert.ok(cols.includes(c), `Missing column paragraphs.${c}`);
        }
    });

    test("reference_mapping columns", () => {
        const cols = db
            .prepare("PRAGMA table_info(reference_mapping)")
            .all()
            .map((r) => r.name);
        for (const c of [
            "ref_key",
            "volume",
            "book",
            "chapter",
            "paragraph",
            "target_edition",
            "target_work",
            "target_book",
            "target_chapter",
            "target_verse",
            "re_key",
            "target_key",
        ]) {
            assert.ok(
                cols.includes(c),
                `Missing column reference_mapping.${c}`,
            );
        }
    });
});

// ─── 2. Volumes ───────────────────────────────────────────────────────────────

describe("2. Volumes — getVolumes()", () => {
    const EXPECTED_VISIBLE = [
        {
            volume_id: "cc",
            volume_order: 1,
            name: "Covenant of Christ",
            reference_name: null,
        },
        {
            volume_id: "oc",
            volume_order: 2,
            name: "The Old Covenants",
            reference_name: "Old Covenants",
        },
        {
            volume_id: "nc",
            volume_order: 3,
            name: "The New Covenants",
            reference_name: "New Covenants",
        },
        {
            volume_id: "nt",
            volume_order: 4,
            name: "The New Testament",
            reference_name: "New Testament",
        },
        {
            volume_id: "bofm",
            volume_order: 5,
            name: "The Book of Mormon",
            reference_name: "Book of Mormon",
        },
        {
            volume_id: "tc",
            volume_order: 6,
            name: "Teachings & Commandments",
            reference_name: null,
        },
        {
            volume_id: "gl",
            volume_order: 7,
            name: "A Glossary of Gospel Terms",
            reference_name: null,
        },
    ];

    test("9 total volumes", () => {
        assert.equal(cnt("SELECT COUNT(*) as n FROM volumes"), 9);
    });

    test("7 visible volumes (volume_order > 0)", () => {
        assert.equal(
            cnt("SELECT COUNT(*) as n FROM volumes WHERE volume_order > 0"),
            7,
        );
    });

    test("visible volumes ordered and named correctly", () => {
        const rows = db
            .prepare(
                "SELECT * FROM volumes WHERE volume_order > 0 ORDER BY volume_order ASC",
            )
            .all();
        assert.equal(rows.length, EXPECTED_VISIBLE.length);
        for (let i = 0; i < EXPECTED_VISIBLE.length; i++) {
            const e = EXPECTED_VISIBLE[i],
                a = rows[i];
            assert.equal(
                a.volume_id,
                e.volume_id,
                `Position ${i + 1}: volume_id mismatch`,
            );
            assert.equal(
                a.volume_order,
                e.volume_order,
                `${e.volume_id}: volume_order mismatch`,
            );
            assert.equal(a.name, e.name, `${e.volume_id}: name mismatch`);
            assert.equal(
                a.reference_name,
                e.reference_name,
                `${e.volume_id}: reference_name mismatch`,
            );
        }
    });

    test("hidden volumes pgp and dc exist", () => {
        for (const vid of ["pgp", "dc"]) {
            const row = db
                .prepare("SELECT volume_id FROM volumes WHERE volume_id = ?")
                .get(vid);
            assert.ok(row, `Missing hidden volume: ${vid}`);
        }
    });

    test("every visible volume has chapters", () => {
        for (const vid of ["cc", "oc", "nc", "nt", "bofm", "tc", "gl"]) {
            const n = cnt(
                "SELECT COUNT(*) as n FROM chapters WHERE volume_id = ?",
                [vid],
            );
            assert.ok(n > 0, `Volume ${vid} has no chapters`);
        }
    });
});

// ─── 3. Books ─────────────────────────────────────────────────────────────────

describe("3. Books — getBooks()", () => {
    // Canon-fixed volumes use exact counts; gl uses a floor (chaptersMin) because the
    // glossary grows as new terms are added.
    const EXPECTED = {
        nc: { books: 2, chapters: 2 },
        oc: { books: 41, chapters: 420 },
        nt: { books: 28, chapters: 90 }, // ncforeword/nccanonization moved to nc; james replaces 1jacob+ejacob; jude replaces judas
        bofm: { books: 19, chapters: 118 },
        tc: { books: 10, chapters: 243 }, // epigraph and glossary removed; 185 sections (up from 177), 10 abraham chapters; maps appendix added
        gl: { books: 3, chaptersMin: 450 }, // glforeword + glintroduction + glossary entries (grows)
        cc: { books: 23, chapters: 122 }, // ccordinances/ccfirstnations/ccbackground added; ccglossary removed
    };

    for (const [vid, exp] of Object.entries(EXPECTED)) {
        test(`${vid}: ${exp.books} books, ${exp.chapters ?? `≥${exp.chaptersMin}`} chapters`, () => {
            const books = cnt(
                "SELECT COUNT(*) as n FROM books    WHERE volume_id = ?",
                [vid],
            );
            const chapters = cnt(
                "SELECT COUNT(*) as n FROM chapters WHERE volume_id = ?",
                [vid],
            );
            assert.equal(
                books,
                exp.books,
                `${vid}: expected ${exp.books} books, got ${books}`,
            );
            if (exp.chaptersMin !== undefined) {
                assert.ok(
                    chapters >= exp.chaptersMin,
                    `${vid}: expected ≥${exp.chaptersMin} chapters, got ${chapters}`,
                );
            } else {
                assert.equal(
                    chapters,
                    exp.chapters,
                    `${vid}: expected ${exp.chapters} chapters, got ${chapters}`,
                );
            }
        });
    }

    test("getBooks query returns id/volume_id/name/num_chapters", () => {
        const rows = db
            .prepare(
                `
            SELECT b.book_id as id, b.volume_id,
                   COALESCE(reference_name, name) as name,
                   COUNT(c.book_id) as num_chapters
            FROM books b, chapters c
            WHERE b.volume_id = 'oc' AND b.volume_id = c.volume_id AND b.book_id = c.book_id
            GROUP BY b.book_id ORDER BY b.book_order, c.chapter_id
        `,
            )
            .all();
        assert.equal(
            rows.length,
            41,
            `Expected 41 OC books, got ${rows.length}`,
        );
        assert.equal(
            rows[0].id,
            "ocforeword",
            "First OC book should be ocforeword",
        );
        assert.ok(rows[0].name, "name field missing");
        assert.ok(rows[0].num_chapters > 0, "num_chapters should be > 0");
        assert.equal(rows[0].volume_id, "oc");
    });

    test("all books in content volumes have at least one chapter", () => {
        const orphans = db
            .prepare(
                `
            SELECT b.volume_id, b.book_id FROM books b
            WHERE b.volume_id IN ('cc','oc','nc','nt','bofm','tc','gl')
            AND NOT EXISTS (
                SELECT 1 FROM chapters c
                WHERE c.volume_id = b.volume_id AND c.book_id = b.book_id
            )
        `,
            )
            .all();
        assert.equal(
            orphans.length,
            0,
            `Books with no chapters: ${orphans.map((b) => `${b.volume_id}/${b.book_id}`).join(", ")}`,
        );
    });
});

// ─── 4. Chapters ─────────────────────────────────────────────────────────────

describe("4. Chapters — counts and content integrity", () => {
    test("total chapters ≥ 1,400 (stable canon + growing glossary)", () => {
        // Exact total changes as the glossary grows; use a floor that catches catastrophic loss.
        assert.ok(
            cnt("SELECT COUNT(*) as n FROM chapters") >= 1400,
            "total chapters unexpectedly low — possible data loss",
        );
    });

    test('all content starts with <ol class="simple-text">', () => {
        const bad = cnt(
            `SELECT COUNT(*) as n FROM chapters WHERE content NOT LIKE '<ol class="simple-text">%'`,
        );
        assert.equal(
            bad,
            0,
            `${bad} chapters have non-standard content format`,
        );
    });

    test("no null or empty content", () => {
        const bad = cnt(
            `SELECT COUNT(*) as n FROM chapters WHERE content IS NULL OR content = ''`,
        );
        assert.equal(bad, 0, `${bad} chapters have null/empty content`);
    });

    test("no null or empty book_chapter", () => {
        const bad = cnt(
            `SELECT COUNT(*) as n FROM chapters WHERE book_chapter IS NULL OR book_chapter = ''`,
        );
        assert.equal(bad, 0);
    });

    test("getChapters: genesis (oc) has 12 chapters", () => {
        const rows = db
            .prepare(
                `
            SELECT chapter_id, volume_id, book_id, book_chapter, chapter_name as name,
                   SUBSTR(content, 1, 600) as preview
            FROM chapters WHERE book_id = 'genesis' AND volume_id = 'oc'
        `,
            )
            .all();
        assert.equal(
            rows.length,
            12,
            `Expected 12 genesis chapters, got ${rows.length}`,
        );
        assert.ok(rows[0].preview, "preview field missing");
    });

    test('getChapterByName: "Genesis 1" in volume oc', () => {
        const rows = db
            .prepare(
                `
            SELECT chapter_id, volume_id, book_id, book_chapter, chapter_name as name
            FROM chapters WHERE chapter_name = 'Genesis 1' AND volume_id = 'oc'
        `,
            )
            .all();
        assert.equal(
            rows.length,
            1,
            `Expected exactly 1 result for "Genesis 1" in oc`,
        );
        assert.equal(rows[0].book_id, "genesis");
        assert.equal(rows[0].book_chapter, "1");
    });
});

// ─── 5. Key Chapter Names ─────────────────────────────────────────────────────

describe("5. Chapter Names — chapter_name derivation", () => {
    // Standard numbered chapters (reference_name + number)
    test("Genesis 1", () =>
        assert.equal(chapterName("oc", "genesis", "1"), "Genesis 1"));
    test("Matthew 5", () =>
        assert.equal(chapterName("nt", "matthew", "5"), "Matthew 5"));
    test("1 Nephi 1", () =>
        assert.equal(chapterName("bofm", "1nephi", "1"), "1 Nephi 1"));
    test("Moroni 10", () =>
        assert.equal(chapterName("bofm", "moroni", "10"), "Moroni 10"));

    // Front matter (book_chapter = '0')
    test("OC Foreword", () =>
        assert.equal(chapterName("oc", "ocforeword", "0"), "Foreword"));
    test("NC Foreword", () =>
        assert.equal(
            chapterName("nc", "ncforeword", "0"),
            "Foreword To The New Covenants",
        ));
    test("BOFM Preface", () =>
        assert.equal(
            chapterName("bofm", "bompreface", "0"),
            "Preface To The Book Of Mormon",
        ));
    test("TC Foreword", () =>
        assert.equal(chapterName("tc", "tcforeword", "0"), "Foreword"));
    test("CC Preface", () =>
        assert.equal(chapterName("cc", "ccpreface", "0"), "Preface"));

    // TC Section chapters (sectionHeader + optional bookTitle)
    test("TC Section 1", () => {
        const name = chapterName("tc", "section", "1");
        assert.ok(name, "Section 1 missing");
        assert.ok(
            name.startsWith("Section 1"),
            `Expected "Section 1...": ${name}`,
        );
    });

    test("TC Section 110 (Lectures on Faith header)", () => {
        const name = chapterName("tc", "section", "110");
        assert.ok(name, "Section 110 missing");
        assert.ok(
            name.includes("Lectures"),
            `Expected "Lectures" in Section 110 name: ${name}`,
        );
    });

    // Joseph Smith History (Part N + date range from XML h3.chap)
    test('JSHistory Part 1 contains "(1805–1820)"', () => {
        const name = chapterName("tc", "jshistory", "1");
        assert.ok(name, "JSHistory 1 missing");
        assert.ok(
            name.startsWith("Joseph Smith History"),
            `Bad prefix: ${name}`,
        );
        assert.ok(
            name.includes("("),
            `Expected date range in parentheses: ${name}`,
        );
    });

    // Lectures on Faith
    test("Lectures on Faith Preface", () =>
        assert.equal(
            chapterName("tc", "lecture", "preface"),
            "Lectures on Faith Preface",
        ));
    test("Lectures on Faith Lecture 1", () =>
        assert.equal(
            chapterName("tc", "lecture", "1"),
            "Lectures on Faith Lecture 1",
        ));
    test("Lectures on Faith Lecture 7", () =>
        assert.equal(
            chapterName("tc", "lecture", "7"),
            "Lectures on Faith Lecture 7",
        ));

    // Book of Abraham (fac slugs → "Facsimile N"; numbers → "The Book of Abraham N")
    test("Abraham Facsimile 1", () =>
        assert.equal(
            chapterName("tc", "abraham", "fac1"),
            "The Book of Abraham Facsimile 1",
        ));
    test("Abraham Facsimile 2", () =>
        assert.equal(
            chapterName("tc", "abraham", "fac2"),
            "The Book of Abraham Facsimile 2",
        ));
    test("Abraham Facsimile 3", () =>
        assert.equal(
            chapterName("tc", "abraham", "fac3"),
            "The Book of Abraham Facsimile 3",
        ));
    test("Abraham Chapter 1", () =>
        assert.equal(
            chapterName("tc", "abraham", "1"),
            "The Book of Abraham 1",
        ));

    // Testimony of John
    test("Testimony of John 1", () =>
        assert.equal(chapterName("tc", "toj", "1"), "The Testimony of John 1"));
    test("Testimony of John 12", () =>
        assert.equal(
            chapterName("tc", "toj", "12"),
            "The Testimony of John 12",
        ));

    // Glossary entries in NC Glossary volume (gl) — uses glossaryTerm XML attribute → title-cased
    test('Glossary: aaronic-priesthood → "Aaronic Priesthood"', () =>
        assert.equal(
            chapterName("gl", "glossary", "aaronic-priesthood"),
            "Aaronic Priesthood",
        ));
    test('Glossary: zion → "Zion"', () =>
        assert.equal(chapterName("gl", "glossary", "zion"), "Zion"));
    test("≥ 450 glossary entries in gl volume", () =>
        assert.ok(
            cnt(
                `SELECT COUNT(*) as n FROM chapters WHERE volume_id='gl' AND book_id='glossary'`,
            ) >= 450,
            "glossary entry count unexpectedly low — possible data loss",
        ));
    test("gl:glforeword chapter exists", () =>
        assert.ok(
            chapterName("gl", "glforeword", "0"),
            "gl:glforeword missing",
        ));
    test("gl:glintroduction chapter exists", () =>
        assert.ok(
            chapterName("gl", "glintroduction", "0"),
            "gl:glintroduction missing",
        ));

    // TC Appendix (slug → title-cased from sectionHeader)
    test("tcappendix:sectionendnotes exists", () =>
        assert.ok(
            chapterName("tc", "tcappendix", "sectionendnotes"),
            "tcappendix:sectionendnotes missing",
        ));
    test("tcappendix:maps exists", () =>
        assert.ok(
            chapterName("tc", "tcappendix", "maps"),
            "tcappendix:maps missing",
        ));
});

// ─── 6. Paragraphs ────────────────────────────────────────────────────────────

describe("6. Paragraphs — FTS5 consistency", () => {
    test("total paragraphs ≥ 14,000 (stable canon + growing glossary)", () => {
        // Exact total changes as the glossary grows; use a floor that catches catastrophic loss.
        assert.ok(
            cnt("SELECT COUNT(*) as n FROM paragraphs") >= 14000,
            "total paragraphs unexpectedly low — possible data loss",
        );
    });

    test("fts_paragraphs row count = paragraphs count", () => {
        const ftsN = cnt("SELECT COUNT(*) as n FROM fts_paragraphs");
        const paraN = cnt("SELECT COUNT(*) as n FROM paragraphs");
        assert.equal(
            ftsN,
            paraN,
            `FTS5 count (${ftsN}) !== paragraphs count (${paraN})`,
        );
    });

    test("every fts_paragraphs rowid matches a paragraphs.paragraph_id", () => {
        const unmatched = cnt(`
            SELECT COUNT(*) as n FROM fts_paragraphs f
            WHERE NOT EXISTS (SELECT 1 FROM paragraphs p WHERE p.paragraph_id = f.rowid)
        `);
        assert.equal(
            unmatched,
            0,
            `${unmatched} FTS rows have no matching paragraph`,
        );
    });

    test("no null or empty paragraph text", () => {
        const bad = cnt(
            `SELECT COUNT(*) as n FROM paragraphs WHERE text IS NULL OR text = ''`,
        );
        assert.equal(bad, 0, `${bad} paragraphs have null/empty text`);
    });

    test("paragraphs.chapter_id (TEXT) always matches chapters.book_chapter", () => {
        // Critical: searchKeywords joins on p.chapter_id = c.book_chapter
        const unmatched = cnt(`
            SELECT COUNT(*) as n FROM paragraphs p
            WHERE NOT EXISTS (
                SELECT 1 FROM chapters c
                WHERE c.volume_id = p.volume_id AND c.book_id = p.book_id
                  AND c.book_chapter = p.chapter_id
            )
        `);
        assert.equal(
            unmatched,
            0,
            `${unmatched} paragraphs.chapter_id values don't match any chapters.book_chapter`,
        );
    });

    test("getChapterParagraphs: genesis 1 has paragraphs with correct fields", () => {
        const rows = db
            .prepare(
                `
            SELECT volume_id, book_id, chapter_id, position, paratext
            FROM paragraphs WHERE volume_id = 'oc' AND book_id = 'genesis' AND chapter_id = '1'
        `,
            )
            .all();
        assert.ok(rows.length > 0, "Genesis 1 should have paragraphs");
        assert.equal(rows[0].volume_id, "oc");
        assert.equal(rows[0].book_id, "genesis");
        assert.equal(rows[0].chapter_id, "1"); // TEXT matching book_chapter
        assert.ok(rows[0].position !== undefined, "position field missing");
        assert.ok(rows[0].paratext !== undefined, "paratext field missing");
    });

    test("getNumParagraphs: genesis 1 max position > 0", () => {
        const result = db
            .prepare(
                `
            SELECT position as num_paragraphs FROM paragraphs
            WHERE volume_id = 'oc' AND book_id = 'genesis' AND chapter_id = '1'
            ORDER BY position DESC LIMIT 1
        `,
            )
            .get();
        assert.ok(
            result && result.num_paragraphs > 0,
            "Genesis 1 max position should be > 0",
        );
    });
});

// ─── 7. FTS5 Search ───────────────────────────────────────────────────────────

describe("7. FTS5 Search — searchKeywords()", () => {
    // Exact SQL from useDatabase.ts searchKeywords() (non-exact-phrase path)
    const SEARCH_SQL = `
        SELECT
            v.name as volume, v.volume_id,
            COALESCE(b.reference_name, b.name) as book,
            p.chapter_id as chapter,
            c.chapter_id,
            c.chapter_name as name,
            p.position,
            p.paratext,
            snippet(fts_paragraphs, 5, '', '', '...', 64) as text
        FROM fts_paragraphs p
        JOIN volumes  v   ON p.volume_id = v.volume_id
        JOIN books    b   ON p.volume_id = b.volume_id AND p.book_id = b.book_id
        JOIN chapters c   ON p.volume_id = c.volume_id AND p.book_id = c.book_id
                         AND p.chapter_id = c.book_chapter
        JOIN paragraphs para ON p.volume_id = para.volume_id AND p.book_id = para.book_id
                             AND p.chapter_id = para.chapter_id AND p.position = para.position
        WHERE fts_paragraphs MATCH ?
        ORDER BY p.ROWID LIMIT 1000
    `;

    test('"faith" returns results', () => {
        const rows = db.prepare(SEARCH_SQL).all("faith");
        assert.ok(
            rows.length > 0,
            'FTS search for "faith" returned no results',
        );
    });

    test("results have all required fields", () => {
        const row = db.prepare(SEARCH_SQL).get("faith");
        assert.ok(row, 'No FTS result for "faith"');
        for (const field of [
            "volume",
            "volume_id",
            "book",
            "chapter",
            "chapter_id",
            "name",
            "position",
            "paratext",
            "text",
        ]) {
            assert.ok(
                row[field] !== undefined,
                `Field "${field}" missing from FTS result`,
            );
        }
    });

    test("result.chapter (TEXT) equals result.book_chapter from chapters join", () => {
        const rows = db
            .prepare(
                `
            SELECT p.chapter_id as pChapter, c.book_chapter
            FROM fts_paragraphs p
            JOIN chapters c ON p.volume_id = c.volume_id AND p.book_id = c.book_id
                            AND p.chapter_id = c.book_chapter
            WHERE fts_paragraphs MATCH ? LIMIT 10
        `,
            )
            .all("faith");
        assert.ok(rows.length > 0, "FTS-chapters join returned no rows");
        assert.ok(
            rows.every((r) => r.pChapter === r.book_chapter),
            "chapter_id ≠ book_chapter in join",
        );
    });

    test("volume filter restricts results to requested volume", () => {
        const rows = db
            .prepare(
                `
            SELECT p.volume_id FROM fts_paragraphs p
            WHERE fts_paragraphs MATCH ? AND p.volume_id = ? LIMIT 50
        `,
            )
            .all("faith", "oc");
        assert.ok(
            rows.length > 0,
            'FTS with volume filter "oc" returned no results',
        );
        assert.ok(
            rows.every((r) => r.volume_id === "oc"),
            "FTS volume filter returned wrong volumes",
        );
    });

    test("book filter restricts results to requested book", () => {
        const rows = db
            .prepare(
                `
            SELECT p.book_id FROM fts_paragraphs p
            WHERE fts_paragraphs MATCH ? AND p.book_id = ? LIMIT 50
        `,
            )
            .all("faith", "genesis");
        assert.ok(
            rows.length > 0,
            'FTS with book filter "genesis" returned no results',
        );
        assert.ok(
            rows.every((r) => r.book_id === "genesis"),
            "FTS book filter returned wrong books",
        );
    });

    test('"faith" appears in multiple volumes', () => {
        const vols = db
            .prepare(
                `
            SELECT DISTINCT p.volume_id FROM fts_paragraphs p
            WHERE fts_paragraphs MATCH ? LIMIT 200
        `,
            )
            .all("faith")
            .map((r) => r.volume_id);
        assert.ok(
            vols.length > 1,
            `Expected "faith" in multiple volumes, found only: ${vols.join(", ")}`,
        );
    });

    test('porter stemming: "believing" matches "believe"', () => {
        // Porter stemmer collapses both → same stem
        const rows = db
            .prepare(
                `
            SELECT COUNT(*) as n FROM fts_paragraphs WHERE fts_paragraphs MATCH ?
        `,
            )
            .get("believing");
        assert.ok(
            rows.n > 0,
            'FTS stem match for "believing" returned no results',
        );
    });
});

// ─── 8. Navigation ────────────────────────────────────────────────────────────

describe("8. Navigation — tcOrder entries and sequential navigation", () => {
    // All book_id:book_chapter pairs referenced in the tcOrder array (useDatabase.ts).
    // These must all exist in the DB for the navigation jumps to function.
    // NOTE: useDatabase.ts tcOrder array must also be updated to match v2 structure.
    const TC_ORDER_ENTRIES = [
        ["ocforeword", "0"],
        ["jshistory", "1"],
        ["jshistory", "20"],
        ["section", "2"],
        ["section", "109"],
        ["lecture", "preface"],
        ["lecture", "7"],
        ["section", "111"],
        ["section", "144"],
        ["abraham", "fac1"],
        ["abraham", "fac3"],
        ["section", "146"],
        ["section", "170"],
        ["toj", "1"],
        ["toj", "12"],
        ["section", "172"],
        ["section", "177"],
        ["tcappendix", "sectionendnotes"],
        ["tcappendix", "excludedrevelations"],
        ["tcappendix", "timeline"],
        ["tcappendix", "maps"],
        ["glossary", "aaronic-priesthood"],
        ["glossary", "zion"],
    ];

    for (const [bookId, bookChapter] of TC_ORDER_ENTRIES) {
        test(`${bookId}:${bookChapter} exists`, () => {
            const row = db
                .prepare(
                    "SELECT chapter_id FROM chapters WHERE book_id=? AND book_chapter=?",
                )
                .get(bookId, bookChapter);
            assert.ok(
                row,
                `Missing chapter: book_id='${bookId}' book_chapter='${bookChapter}'`,
            );
        });
    }

    test('cc last chapter is ccbackground with book_chapter "0"', () => {
        // v2: ccglossary removed; ccbackground is now the final CC book
        const row = db
            .prepare(
                `SELECT book_id, book_chapter FROM chapters WHERE volume_id='cc' ORDER BY chapter_id DESC LIMIT 1`,
            )
            .get();
        assert.ok(row, "No CC chapters found");
        assert.equal(
            row.book_id,
            "ccbackground",
            `Expected ccbackground as last CC chapter, got ${row.book_id}`,
        );
    });

    test("sequential forward navigation: Genesis 1 → Genesis 2", () => {
        const ch1 = db
            .prepare(
                "SELECT chapter_id FROM chapters WHERE book_id=? AND volume_id=? AND book_chapter=?",
            )
            .get("genesis", "oc", "1");
        assert.ok(ch1, "Genesis 1 not found");
        const next = db
            .prepare(
                "SELECT book_id, book_chapter FROM chapters WHERE chapter_id=?",
            )
            .get(ch1.chapter_id + 1);
        assert.ok(next, "No chapter after Genesis 1");
        assert.equal(next.book_id, "genesis");
        assert.equal(next.book_chapter, "2");
    });

    test("sequential back navigation: Genesis 2 → Genesis 1", () => {
        const ch2 = db
            .prepare(
                "SELECT chapter_id FROM chapters WHERE book_id=? AND volume_id=? AND book_chapter=?",
            )
            .get("genesis", "oc", "2");
        const prev = db
            .prepare(
                "SELECT book_id, book_chapter FROM chapters WHERE chapter_id=?",
            )
            .get(ch2.chapter_id - 1);
        assert.ok(prev, "No chapter before Genesis 2");
        assert.equal(prev.book_id, "genesis");
        assert.equal(prev.book_chapter, "1");
    });

    test("first chapter in OC has no predecessor (is chapter_id 1)", () => {
        const first = db
            .prepare(
                "SELECT chapter_id FROM chapters WHERE volume_id=? ORDER BY chapter_id ASC",
            )
            .get("oc");
        assert.equal(first.chapter_id, 1, "OC first chapter_id should be 1");
        const prev = db
            .prepare("SELECT chapter_id FROM chapters WHERE chapter_id=?")
            .get(0);
        assert.equal(prev, undefined, "chapter_id 0 should not exist");
    });
});

// ─── 9a. getFirstChapterByVolume ─────────────────────────────────────────────

describe("9a. Query: getFirstChapterByVolume()", () => {
    const EXPECTED = {
        cc: { book_id: "cctitle", book_chapter: "0" }, // v2: title (Dedication) is now first in CC
        oc: { book_id: "ocforeword", book_chapter: "0" },
        nc: { book_id: "ncforeword", book_chapter: "0" }, // v2: NC foreword/canonization now in nc volume
        nt: { book_id: "ntpreface", book_chapter: "0" }, // v2: ncforeword moved to nc; ntpreface is now first
        bofm: { book_id: "bompreface", book_chapter: "0" },
        tc: { book_id: "tcforeword", book_chapter: "0" },
        gl: { book_id: "glforeword", book_chapter: "0" },
    };

    for (const [vid, exp] of Object.entries(EXPECTED)) {
        test(`${vid} → ${exp.book_id}/${exp.book_chapter}`, () => {
            const row = db
                .prepare(
                    `
                SELECT chapter_id, volume_id, book_id, book_chapter, chapter_name as name
                FROM chapters WHERE volume_id=? ORDER BY chapter_id ASC
            `,
                )
                .get(vid);
            assert.ok(row, `No chapters in volume ${vid}`);
            assert.equal(row.book_id, exp.book_id, `${vid}: wrong first book`);
            assert.equal(
                row.book_chapter,
                exp.book_chapter,
                `${vid}: wrong first book_chapter`,
            );
        });
    }
});

// ─── 9b. getTCChapter ────────────────────────────────────────────────────────

describe("9b. Query: getTCChapter()", () => {
    test('TC section:1 returns chapter with name starting "Section 1"', () => {
        const row = db
            .prepare(
                `
            SELECT chapter_id, chapter_name as name
            FROM chapters WHERE volume_id='tc' AND book_id=? AND book_chapter=?
        `,
            )
            .get("section", "1");
        assert.ok(row, "TC section:1 not found");
        assert.ok(
            row.name.startsWith("Section 1"),
            `Unexpected name: ${row.name}`,
        );
    });

    test("TC has 185 section chapters", () => {
        assert.equal(
            cnt(
                `SELECT COUNT(*) as n FROM chapters WHERE volume_id='tc' AND book_id='section'`,
            ),
            185,
        );
    });

    test("getTCChapter with name filter works", () => {
        // Query variant used when name is provided
        const target = db
            .prepare(
                `SELECT chapter_name FROM chapters WHERE volume_id='tc' AND book_id='section' LIMIT 1`,
            )
            .get();
        const row = db
            .prepare(
                `
            SELECT chapter_id, chapter_name as name
            FROM chapters WHERE volume_id='tc' AND book_id=? AND chapter_name=?
        `,
            )
            .get("section", target.chapter_name);
        assert.ok(row, "getTCChapter by name returned nothing");
        assert.equal(row.name, target.chapter_name);
    });
});

// ─── 9c. getChapterText ───────────────────────────────────────────────────────

describe("9c. Query: getChapterText()", () => {
    test("Genesis 1 content is valid HTML", () => {
        const ch = db
            .prepare(
                `SELECT chapter_id FROM chapters WHERE book_id='genesis' AND volume_id='oc' AND book_chapter='1'`,
            )
            .get();
        const row = db
            .prepare("SELECT content FROM chapters WHERE chapter_id=?")
            .get(ch.chapter_id);
        assert.ok(row?.content, "No content for Genesis 1");
        assert.ok(
            row.content.startsWith('<ol class="simple-text">'),
            `Content should start with <ol class="simple-text">, got: ${row.content.slice(0, 50)}`,
        );
    });

    test("TC section 1 content is valid HTML", () => {
        const ch = db
            .prepare(
                `SELECT chapter_id FROM chapters WHERE volume_id='tc' AND book_id='section' AND book_chapter='1'`,
            )
            .get();
        const row = db
            .prepare("SELECT content FROM chapters WHERE chapter_id=?")
            .get(ch.chapter_id);
        assert.ok(
            row?.content?.startsWith('<ol class="simple-text">'),
            "TC section 1 content invalid",
        );
    });
});

// ─── 9d. getGlossaryEntries ───────────────────────────────────────────────────

describe("9d. Query: getGlossaryEntries()", () => {
    test("returns ≥ 450 entries in gl volume", () => {
        const rows = db
            .prepare(
                `SELECT chapter_id, chapter_name as name FROM chapters WHERE volume_id='gl' AND book_id='glossary'`,
            )
            .all();
        assert.ok(
            rows.length >= 450,
            `Expected ≥450 glossary entries, got ${rows.length}`,
        );
    });

    test("entries have chapter_id and name fields", () => {
        const row = db
            .prepare(
                `SELECT chapter_id, chapter_name as name FROM chapters WHERE volume_id='gl' AND book_id='glossary' LIMIT 1`,
            )
            .get();
        assert.ok(row.chapter_id, "chapter_id missing");
        assert.ok(row.name, "name missing");
    });

    test('first entry alphabetically is "Aaronic Priesthood"', () => {
        const rows = db
            .prepare(
                `SELECT chapter_name as name FROM chapters WHERE volume_id='gl' AND book_id='glossary' ORDER BY chapter_id`,
            )
            .all();
        assert.equal(rows[0].name, "Aaronic Priesthood");
    });
});

// ─── 9e. getCanonicalBook / synonyms ─────────────────────────────────────────

describe("9e. Query: getCanonicalBook() — synonyms", () => {
    test("synonyms table has entries", () => {
        const n = cnt("SELECT COUNT(*) as n FROM synonyms");
        assert.ok(
            n > 0,
            `synonyms table is empty (count=${n}). ` +
                "book_synonyms.sql is missing from the scripts/ directory — add it to populate synonyms.",
        );
    });

    test('"gen" maps to "genesis"', () => {
        const n = cnt("SELECT COUNT(*) as n FROM synonyms");
        if (n === 0) return; // Skip if synonyms empty (bug not yet fixed)
        const row = db
            .prepare(`SELECT canonical FROM synonyms WHERE synonym = 'gen'`)
            .get();
        assert.ok(row, '"gen" synonym not found');
        assert.equal(row.canonical, "genesis");
    });

    test('"1 nephi" maps to "1nephi"', () => {
        const n = cnt("SELECT COUNT(*) as n FROM synonyms");
        if (n === 0) return;
        const row = db
            .prepare(`SELECT canonical FROM synonyms WHERE synonym = '1 nephi'`)
            .get();
        assert.ok(row, '"1 nephi" synonym not found');
        assert.equal(row.canonical, "1nephi");
    });
});

// ─── 9f. getLEReferences ─────────────────────────────────────────────────────

describe("9f. Query: getLEReferences()", () => {
    test("returns cross-references for genesis chapter 1", () => {
        const rows = db
            .prepare(
                `
            WITH verse_ranges AS (
                SELECT
                    target_book, target_chapter,
                    MIN(target_verse) as min_verse, MAX(target_verse) as max_verse,
                    COUNT(*) as verses_in_range,
                    (SELECT COUNT(*) FROM reference_mapping rm2
                     WHERE rm2.target_book = rm1.target_book
                       AND rm2.target_chapter = rm1.target_chapter) as total_chapter_verses
                FROM reference_mapping rm1
                WHERE book = 'genesis' AND chapter = 1
                GROUP BY target_book, target_chapter
            ),
            chapter_coverage AS (
                SELECT target_book, target_chapter, min_verse, max_verse,
                       verses_in_range = total_chapter_verses as is_complete_chapter
                FROM verse_ranges
            )
            SELECT target_book, target_chapter, min_verse, max_verse, is_complete_chapter,
                   CASE WHEN min_verse = max_verse
                        THEN target_chapter || ':' || min_verse
                        ELSE target_chapter || ':' || min_verse || '-' || max_verse
                   END as verse_range
            FROM chapter_coverage ORDER BY target_chapter, min_verse
        `,
            )
            .all();
        assert.ok(
            rows.length > 0,
            "getLEReferences returned no rows for genesis 1",
        );
        assert.ok(rows[0].target_book, "target_book missing");
        assert.ok(rows[0].target_chapter > 0, "target_chapter should be > 0");
        assert.ok(rows[0].verse_range, "verse_range missing");
    });

    test("paragraph filter variant works", () => {
        const rows = db
            .prepare(
                `
            WITH verse_ranges AS (
                SELECT target_book, target_chapter,
                    MIN(target_verse) as min_verse, MAX(target_verse) as max_verse,
                    COUNT(*) as verses_in_range,
                    (SELECT COUNT(*) FROM reference_mapping rm2
                     WHERE rm2.target_book = rm1.target_book AND rm2.target_chapter = rm1.target_chapter) as total_chapter_verses
                FROM reference_mapping rm1
                WHERE book = 'genesis' AND chapter = 1 AND paragraph = 1
                GROUP BY target_book, target_chapter
            )
            SELECT target_book, target_chapter FROM verse_ranges
        `,
            )
            .all();
        // May return 0 rows if paragraph 1 has no mapping — just confirm the query runs
        assert.ok(
            Array.isArray(rows),
            "getLEReferences with paragraph filter should return array",
        );
    });
});

// ─── 9g. getREReferences ─────────────────────────────────────────────────────

describe("9g. Query: getREReferences()", () => {
    test("returns RE→LE cross-references for genesis chapter 1", () => {
        const rows = db
            .prepare(
                `
            SELECT rm.re_key, v.volume_id, b.book_id,
                   c.book_chapter as chapter, c.chapter_id, c.chapter_name as name,
                   rm.paragraph, MIN(rm.paragraph) as start_paragraph,
                   MAX(rm.paragraph) as end_paragraph
            FROM reference_mapping rm
            JOIN volumes  v ON rm.volume = v.volume_id
            JOIN books    b ON rm.volume = b.volume_id AND rm.book = b.book_id
            JOIN chapters c ON rm.volume = c.volume_id AND rm.book = c.book_id
                            AND rm.chapter = c.book_chapter
            WHERE target_book = 'genesis' AND target_chapter = 1
            GROUP BY rm.volume, rm.chapter
            ORDER BY v.volume_id ASC
        `,
            )
            .all();
        assert.ok(
            rows.length > 0,
            "getREReferences returned no rows for genesis 1",
        );
        assert.ok(rows[0].volume_id, "volume_id missing");
        assert.ok(rows[0].book_id, "book_id missing");
    });
});

// ─── 9h. getBookReferenceName ────────────────────────────────────────────────

describe("9h. Query: getBookReferenceName()", () => {
    const CASES = [
        ["genesis", "Genesis"],
        ["exodus", "Exodus"],
        ["matthew", "Matthew"],
        ["1nephi", "1 Nephi"],
        ["moroni", "Moroni"],
        ["section", "Sections"],
    ];

    for (const [bookId, expected] of CASES) {
        test(`${bookId} → "${expected}"`, () => {
            const row = db
                .prepare(
                    "SELECT COALESCE(reference_name, name) as name FROM books WHERE book_id=? ORDER BY rowid ASC",
                )
                .get(bookId);
            assert.ok(row, `Book ${bookId} not found`);
            assert.equal(row.name, expected);
        });
    }
});

// ─── 9i. getLDSBookNames / getREBookNames / getAllBookNames ───────────────────

describe("9i. Query: getLDSBookNames / getREBookNames / getAllBookNames", () => {
    test("getLDSBookNames returns ≥ 85 results with volume_id/book_id/name", () => {
        // v2: 1jacob/ejacob replaced by james; judas replaced by jude — no exclusions needed
        const rows = db
            .prepare(
                `
            SELECT volume_id, book_id, COALESCE(reference_name, name) as name
            FROM books WHERE volume_id IN ('oc','nt')
            UNION ALL
            SELECT volume_id, book_id, COALESCE(reference_name, name) as name
            FROM books WHERE volume_id = 'bofm'
            UNION ALL
            SELECT volume_id, book_id, COALESCE(reference_name, name) as name
            FROM books WHERE volume_id IN ('dc','pgp')
            ORDER BY name ASC
        `,
            )
            .all();
        assert.ok(
            rows.length >= 85,
            `Expected ≥85 LDS book names, got ${rows.length}`,
        );
        assert.ok(rows[0].volume_id, "volume_id missing");
        assert.ok(rows[0].book_id, "book_id missing");
        assert.ok(rows[0].name, "name missing");
    });

    test("getREBookNames returns ≥ 90 results", () => {
        // v2: nt books reduced (ncforeword/nccanonization moved to nc, no ejacob); tc books reduced (no glossary/epigraph)
        const rows = db
            .prepare(
                `
            SELECT volume_id, book_id, COALESCE(reference_name, name) as name
            FROM books WHERE volume_id IN ('oc','nt')
            UNION ALL
            SELECT volume_id, book_id, COALESCE(reference_name, name) as name
            FROM books WHERE volume_id = 'bofm'
            UNION ALL
            SELECT volume_id, book_id, COALESCE(reference_name, name) as name
            FROM books WHERE volume_id IN ('tc')
            ORDER BY name ASC
        `,
            )
            .all();
        assert.ok(
            rows.length >= 90,
            `Expected ≥90 RE book names, got ${rows.length}`,
        );
    });

    test("getAllBookNames returns ≥ 185 results with prefixed names", () => {
        const rows = db
            .prepare(
                `
            SELECT volume_id, book_id, 'KJV ' || COALESCE(reference_name, name) as name
            FROM books WHERE volume_id IN ('oc','nt')
            UNION ALL
            SELECT volume_id, book_id, 'RE ' || COALESCE(reference_name, name) as name
            FROM books WHERE volume_id IN ('oc','nt')
            UNION ALL
            SELECT volume_id, book_id, 'LDS ' || COALESCE(reference_name, name) as name
            FROM books WHERE volume_id = 'bofm'
            UNION ALL
            SELECT volume_id, book_id, 'RE ' || COALESCE(reference_name, name) as name
            FROM books WHERE volume_id = 'bofm'
            UNION ALL
            SELECT volume_id, book_id, 'LDS ' || COALESCE(reference_name, name) as name
            FROM books WHERE book_id IN ('abraham','jshistory')
            UNION ALL
            SELECT volume_id, book_id, 'RE ' || COALESCE(reference_name, name) as name
            FROM books WHERE book_id IN ('abraham','jshistory')
            UNION ALL
            SELECT volume_id, book_id, COALESCE(reference_name, name) as name
            FROM books WHERE (volume_id = 'tc' OR volume_id = 'pgp' OR volume_id = 'dc')
              AND book_id NOT IN ('abraham','jshistory','js-h')
            ORDER BY name ASC
        `,
            )
            .all();
        assert.ok(
            rows.length >= 185,
            `Expected ≥185 getAllBookNames results, got ${rows.length}`,
        );
    });
});

// ─── 9j. getChapterByReference ───────────────────────────────────────────────

describe("9j. Query: getChapterByReference()", () => {
    test('genesis/1 returns oc chapter named "Genesis 1"', () => {
        const row = db
            .prepare(
                `
            SELECT chapter_id, c.volume_id, book_id, book_chapter, chapter_name as name
            FROM chapters c, volumes v
            WHERE c.volume_id = v.volume_id AND book_id=? AND book_chapter=?
            ORDER BY v.volume_order ASC LIMIT 1
        `,
            )
            .get("genesis", "1");
        assert.ok(row, "getChapterByReference genesis/1 returned nothing");
        assert.equal(row.volume_id, "oc");
        assert.equal(row.book_id, "genesis");
        assert.equal(row.book_chapter, "1");
        assert.equal(row.name, "Genesis 1");
    });

    test("1nephi/1 returns cc volume first (volume_order 1 < bofm order 5)", () => {
        // Both cc and bofm have 1nephi; cc has lower volume_order so should be first
        const row = db
            .prepare(
                `
            SELECT c.volume_id FROM chapters c, volumes v
            WHERE c.volume_id = v.volume_id AND book_id='1nephi' AND book_chapter='1'
            ORDER BY v.volume_order ASC LIMIT 1
        `,
            )
            .get();
        assert.ok(row, "No chapter found for 1nephi/1");
        assert.equal(
            row.volume_id,
            "cc",
            `Expected cc volume (order 1) first for 1nephi/1, got ${row.volume_id}`,
        );
    });

    test("matthew/5 returns nt chapter", () => {
        const row = db
            .prepare(
                `
            SELECT c.volume_id, book_id FROM chapters c, volumes v
            WHERE c.volume_id = v.volume_id AND book_id='matthew' AND book_chapter='5'
            ORDER BY v.volume_order ASC LIMIT 1
        `,
            )
            .get();
        assert.ok(row, "matthew/5 not found");
        assert.equal(row.volume_id, "nt");
        assert.equal(row.book_id, "matthew");
    });
});

// ─── 10. Reference Mapping ───────────────────────────────────────────────────

describe("10. Reference Mapping", () => {
    test("49,450 rows", () => {
        assert.equal(cnt("SELECT COUNT(*) as n FROM reference_mapping"), 49450);
    });

    test("all ref_keys are unique (no duplicates)", () => {
        const total = cnt("SELECT COUNT(*) as n FROM reference_mapping");
        const distinct = cnt(
            "SELECT COUNT(DISTINCT ref_key) as n FROM reference_mapping",
        );
        assert.equal(
            total,
            distinct,
            `${total - distinct} duplicate ref_keys found`,
        );
    });

    test("sample query for genesis chapter 1 returns rows", () => {
        const rows = db
            .prepare(
                `SELECT ref_key, book, chapter FROM reference_mapping WHERE book='genesis' AND chapter=1 LIMIT 5`,
            )
            .all();
        assert.ok(
            rows.length > 0,
            "No reference_mapping rows for genesis chapter 1",
        );
        assert.ok(rows[0].ref_key, "ref_key field missing");
    });

    test("required columns are non-null for sample rows", () => {
        const row = db.prepare("SELECT * FROM reference_mapping LIMIT 1").get();
        assert.ok(row, "reference_mapping is empty");
        assert.ok(row.ref_key, "ref_key null");
        assert.ok(row.volume, "volume null");
        assert.ok(row.book, "book null");
        assert.ok(row.chapter > 0, "chapter should be > 0");
        assert.ok(row.target_book, "target_book null");
        assert.ok(row.target_chapter > 0, "target_chapter should be > 0");
    });
});
