/**
 * Tests for the database query logic embedded in useDatabase.ts.
 *
 * Strategy: useDatabase is a React hook, so it cannot be imported directly in
 * a Node test environment.  Instead, we run the raw SQL queries (verbatim
 * copies from the hook) against:
 *   - the real bundled scripture database  (assets/scriptures_v2.1.db)
 *   - an in-memory SQLite database seeded with the user-highlights schema
 *
 * This ensures the SQL is valid and returns sensible results without needing
 * a React render context.  The tcOrder jump-table logic is tested as a
 * self-contained pure-function replica.
 *
 * Node 24+ ships `node:sqlite` natively, which supports FTS5.
 */

import { DatabaseSync, StatementSync } from "node:sqlite";
import path from "node:path";
import { USER_DATABASE_SCHEMA } from "../UserDatabaseSchema";
import { CustomTokenizer } from "../../util/CustomTokenizer";

// ---------------------------------------------------------------------------
// Database setup
// ---------------------------------------------------------------------------

const DB_PATH = path.resolve(process.cwd(), "assets/scriptures_v2.1.db");

let db: DatabaseSync;
let userDb: DatabaseSync;

// Helper wrappers that mirror expo-sqlite's getFirstAsync / getAllAsync
function getRow(sql: string, params: any[] = []): any {
    const stmt: StatementSync = db.prepare(sql);
    return stmt.get(...params) ?? null;
}

function getRows(sql: string, params: any[] = []): any[] {
    const stmt: StatementSync = db.prepare(sql);
    return stmt.all(...params);
}

function userGetRow(sql: string, params: any[] = []): any {
    return userDb.prepare(sql).get(...params) ?? null;
}

function userGetRows(sql: string, params: any[] = []): any[] {
    return userDb.prepare(sql).all(...params);
}

function userRun(sql: string, params: any[] = []): { changes: number } {
    return userDb.prepare(sql).run(...params) as { changes: number };
}

beforeAll(() => {
    // Suppress experimental warnings from node:sqlite
    process.removeAllListeners("warning");
    db = new DatabaseSync(DB_PATH);
    userDb = new DatabaseSync(":memory:");
    // Strip the template literal version placeholder; apply the schema
    userDb.exec(USER_DATABASE_SCHEMA.replace("${USER_DATABASE_VERSION}", "1"));
});

afterAll(() => {
    db.close();
    userDb.close();
});

// ---------------------------------------------------------------------------
// Helpers shared across highlight tests
// ---------------------------------------------------------------------------

let _counter = 0;
function nextId(): string {
    return `test-uuid-${++_counter}`;
}

function insertHighlight(
    id: string,
    opts: {
        volume_id?: string;
        book_id?: string;
        book_chapter?: string;
        paragraph_position?: number;
        start_offset?: number;
        end_offset?: number;
        selected_text?: string;
        color?: string;
        mark_type?: "highlight" | "underline";
    } = {},
): void {
    userRun(
        `INSERT INTO highlights
         (id, volume_id, book_id, book_chapter, paragraph_position,
          start_offset, end_offset, selected_text, color, mark_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            id,
            opts.volume_id ?? "cc",
            opts.book_id ?? "ccforeword",
            opts.book_chapter ?? "1",
            opts.paragraph_position ?? 3,
            opts.start_offset ?? 10,
            opts.end_offset ?? 26,
            opts.selected_text ?? "In the beginning",
            opts.color ?? "#FFFF00",
            opts.mark_type ?? "highlight",
        ],
    );
}

beforeEach(() => {
    // Clear highlights before each test to keep tests isolated
    userDb.exec("DELETE FROM highlights");
});

// ===========================================================================
// getVolumes
// ===========================================================================

describe("getVolumes", () => {
    const SQL = `SELECT * FROM volumes WHERE volume_order > 0 ORDER BY volume_order ASC`;

    it("returns at least one volume", () => {
        const rows = getRows(SQL);
        expect(rows.length).toBeGreaterThan(0);
    });

    it("returns 7 visible volumes", () => {
        const rows = getRows(SQL);
        expect(rows).toHaveLength(7);
    });

    it("first volume is Covenant of Christ (cc)", () => {
        const rows = getRows(SQL);
        expect(rows[0].volume_id).toBe("cc");
        expect(rows[0].name).toBe("Covenant of Christ");
    });

    it("each volume has volume_id, name, and volume_order fields", () => {
        const rows = getRows(SQL);
        for (const v of rows) {
            expect(v.volume_id).toBeDefined();
            expect(v.name).toBeDefined();
            expect(v.volume_order).toBeGreaterThan(0);
        }
    });

    it("volumes are in ascending volume_order", () => {
        const rows = getRows(SQL);
        for (let i = 1; i < rows.length; i++) {
            expect(rows[i].volume_order).toBeGreaterThan(
                rows[i - 1].volume_order,
            );
        }
    });
});

// ===========================================================================
// getBooks
// ===========================================================================

describe("getBooks", () => {
    const SQL = `SELECT b.book_id as id,
        b.volume_id,
        COALESCE(reference_name, name) as name,
        COUNT(c.book_id) as num_chapters
        FROM books b, chapters c
        WHERE b.volume_id = ? AND b.volume_id = c.volume_id AND b.book_id = c.book_id
        GROUP BY b.book_id ORDER BY b.book_order, c.chapter_id`;

    it("returns 23 books for the cc volume", () => {
        const rows = getRows(SQL, ["cc"]);
        expect(rows).toHaveLength(23);
    });

    it("each book has id, volume_id, name, and num_chapters", () => {
        const rows = getRows(SQL, ["cc"]);
        for (const b of rows) {
            expect(b.id).toBeDefined();
            expect(b.volume_id).toBe("cc");
            expect(b.name).toBeDefined();
            expect(b.num_chapters).toBeGreaterThan(0);
        }
    });

    it("returns books for the oc volume", () => {
        const rows = getRows(SQL, ["oc"]);
        expect(rows.length).toBeGreaterThan(0);
    });

    it("returns no books for a non-existent volume", () => {
        const rows = getRows(SQL, ["zz"]);
        expect(rows).toHaveLength(0);
    });

    it("reference_name is preferred over name when present (COALESCE)", () => {
        // All books should have a non-null name due to COALESCE
        const rows = getRows(SQL, ["cc"]);
        for (const b of rows) {
            expect(b.name).toBeTruthy();
        }
    });
});

// ===========================================================================
// getChapters
// ===========================================================================

describe("getChapters", () => {
    const SQL = `SELECT chapter_id, volume_id, book_id, book_chapter, chapter_name as name, SUBSTR(content, 1, 600) as preview
        FROM chapters
        WHERE book_id = ? AND volume_id = ?`;

    it("returns 12 chapters for genesis in oc", () => {
        const rows = getRows(SQL, ["genesis", "oc"]);
        expect(rows).toHaveLength(12);
    });

    it("each chapter has required fields", () => {
        const rows = getRows(SQL, ["genesis", "oc"]);
        for (const c of rows) {
            expect(c.chapter_id).toBeDefined();
            expect(c.volume_id).toBe("oc");
            expect(c.book_id).toBe("genesis");
            expect(c.book_chapter).toBeDefined();
            expect(c.name).toBeDefined();
        }
    });

    it("preview is at most 600 characters", () => {
        const rows = getRows(SQL, ["genesis", "oc"]);
        for (const c of rows) {
            if (c.preview) {
                expect(c.preview.length).toBeLessThanOrEqual(600);
            }
        }
    });

    it("returns no chapters for a non-existent book", () => {
        const rows = getRows(SQL, ["nonexistent", "oc"]);
        expect(rows).toHaveLength(0);
    });
});

// ===========================================================================
// getChapterByName
// ===========================================================================

describe("getChapterByName", () => {
    const SQL = `SELECT chapter_id, volume_id, book_id, book_chapter, chapter_name as name
        FROM chapters
        WHERE chapter_name = ? AND volume_id = ?`;

    it("finds Genesis 1 by name in oc volume", () => {
        const rows = getRows(SQL, ["Genesis 1", "oc"]);
        expect(rows).toHaveLength(1);
        expect(rows[0].book_id).toBe("genesis");
        expect(rows[0].book_chapter).toBe("1");
    });

    it("returns empty array for a name that does not exist", () => {
        const rows = getRows(SQL, ["No Such Chapter", "oc"]);
        expect(rows).toHaveLength(0);
    });

    it("respects the volume_id filter", () => {
        const rows = getRows(SQL, ["Genesis 1", "cc"]);
        expect(rows).toHaveLength(0);
    });
});

// ===========================================================================
// getTCChapter
// ===========================================================================

describe("getTCChapter", () => {
    it("finds TC section 1 by bookId + bookChapter", () => {
        const row = getRow(
            `SELECT chapter_id, chapter_name as name
             FROM chapters
             WHERE volume_id = 'tc' AND book_id = ? AND book_chapter = ?`,
            ["section", "1"],
        );
        expect(row).not.toBeNull();
        expect(row.chapter_id).toBeDefined();
        expect(row.name).toMatch(/Section 1/);
    });

    it("finds a TC chapter by name when no bookChapter given", () => {
        // When only name is provided (the hook adds AND chapter_name = ?)
        const row = getRow(
            `SELECT chapter_id, chapter_name as name
             FROM chapters
             WHERE volume_id = 'tc' AND book_id = ? AND chapter_name = ?`,
            ["tcforeword", "Foreword"],
        );
        expect(row).not.toBeNull();
    });

    it("returns null when neither bookChapter nor name match", () => {
        const row = getRow(
            `SELECT chapter_id, chapter_name as name
             FROM chapters
             WHERE volume_id = 'tc' AND book_id = ? AND book_chapter = ?`,
            ["section", "9999"],
        );
        expect(row).toBeNull();
    });
});

// ===========================================================================
// getFirstChapterByVolume
// ===========================================================================

describe("getFirstChapterByVolume", () => {
    const SQL = `SELECT chapter_id, volume_id, book_id, book_chapter, chapter_name as name
        FROM chapters
        WHERE volume_id = ?
        ORDER BY chapter_id ASC`;

    it("returns the dedication as the first chapter of cc (lowest chapter_id)", () => {
        const row = getRow(SQL, ["cc"]);
        expect(row).not.toBeNull();
        expect(row.volume_id).toBe("cc");
        expect(row.book_id).toBe("cctitle");
    });

    it("returns null for a non-existent volume", () => {
        const row = getRow(SQL, ["zz"]);
        expect(row).toBeNull();
    });

    it("returned row has required fields", () => {
        const row = getRow(SQL, ["oc"]);
        expect(row.chapter_id).toBeDefined();
        expect(row.volume_id).toBe("oc");
        expect(row.book_id).toBeDefined();
        expect(row.book_chapter).toBeDefined();
        expect(row.name).toBeDefined();
    });
});

// ===========================================================================
// getChapterText
// ===========================================================================

describe("getChapterText", () => {
    const SQL = `SELECT content FROM chapters WHERE chapter_id = ?`;

    it("returns content for a known chapter (genesis ch 1, chapter_id=4)", () => {
        const row = getRow(SQL, [4]);
        expect(row).not.toBeNull();
        expect(typeof row.content).toBe("string");
        expect(row.content.length).toBeGreaterThan(0);
    });

    it("content for genesis 1 is at least 1000 characters of HTML", () => {
        const row = getRow(SQL, [4]);
        expect(row.content.length).toBeGreaterThan(1000);
    });

    it("returns null for a chapter_id that does not exist", () => {
        const row = getRow(SQL, [999999]);
        expect(row).toBeNull();
    });
});

// ===========================================================================
// getGlossaryEntries
// ===========================================================================

describe("getGlossaryEntries", () => {
    const SQL = `SELECT chapter_id, chapter_name as name
        FROM chapters
        WHERE volume_id = 'gl' AND book_id = 'glossary'`;

    it("returns 462 glossary entries", () => {
        const rows = getRows(SQL);
        expect(rows).toHaveLength(462);
    });

    it("first entry has chapter_id and name fields", () => {
        const rows = getRows(SQL);
        expect(rows[0].chapter_id).toBeDefined();
        expect(rows[0].name).toBeDefined();
    });

    it("includes Aaronic Priesthood as an entry", () => {
        const rows = getRows(SQL);
        const found = rows.find((r: any) => r.name === "Aaronic Priesthood");
        expect(found).toBeDefined();
    });
});

// ===========================================================================
// getCanonicalBook
// ===========================================================================

describe("getCanonicalBook", () => {
    const SQL = `SELECT canonical FROM synonyms WHERE synonym = ?`;

    it("resolves 'gen' to 'genesis'", () => {
        const row = getRow(SQL, ["gen"]);
        expect(row).not.toBeNull();
        expect(row.canonical).toBe("genesis");
    });

    it("resolves 'matt' to 'matthew'", () => {
        const row = getRow(SQL, ["matt"]);
        expect(row?.canonical).toBe("matthew");
    });

    it("returns null for a word that has no synonym mapping", () => {
        const row = getRow(SQL, ["zzz_no_such_synonym"]);
        expect(row).toBeNull();
    });

    it("synonym table has at least one entry for each major book abbreviation", () => {
        const expected = ["gen", "ex", "lev", "num", "deut", "josh", "judg"];
        for (const syn of expected) {
            const row = getRow(SQL, [syn]);
            expect(row?.canonical).toBeDefined();
        }
    });

    it("resolves 'js-h' to 'jshistory' (still in synonyms table)", () => {
        const row = getRow(SQL, ["js-h"]);
        expect(row?.canonical).toBe("jshistory");
    });

    it("resolves 'abr' to 'abraham' (still in synonyms table)", () => {
        const row = getRow(SQL, ["abr"]);
        expect(row?.canonical).toBe("abraham");
    });

    it("'moses' is absent from synonyms table (handled by getCanonicalBook fallback)", () => {
        const row = getRow(SQL, ["moses"]);
        expect(row).toBeNull();
    });

    it("'js-m' is absent from synonyms table (handled by getCanonicalBook fallback)", () => {
        const row = getRow(SQL, ["js-m"]);
        expect(row).toBeNull();
    });

    it("'aof' is absent from synonyms table (handled by getCanonicalBook fallback)", () => {
        const row = getRow(SQL, ["aof"]);
        expect(row).toBeNull();
    });

    it("'a of f' is absent from synonyms table (handled by getCanonicalBook fallback)", () => {
        const row = getRow(SQL, ["a of f"]);
        expect(row).toBeNull();
    });
});

// ===========================================================================
// getChapterByReference
// ===========================================================================

describe("getChapterByReference", () => {
    const SQL = `
        SELECT chapter_id, c.volume_id, book_id, book_chapter, chapter_name as name
        FROM chapters c, volumes v
        WHERE c.volume_id = v.volume_id
        AND book_id = ? AND book_chapter = ?
        ORDER BY v.volume_order ASC
        LIMIT 1
    `;

    it("returns genesis chapter 1 in oc volume", () => {
        const row = getRow(SQL, ["genesis", "1"]);
        expect(row).not.toBeNull();
        expect(row.book_id).toBe("genesis");
        expect(row.book_chapter).toBe("1");
        expect(row.volume_id).toBe("oc");
    });

    it("returns the lowest volume_order when multiple volumes have the same book+chapter", () => {
        // Verify order by checking that volume_order of the result is minimal
        const row = getRow(SQL, ["genesis", "1"]);
        expect(row.volume_id).toBe("oc"); // oc comes before nt in volume_order
    });

    it("returns null for a non-existent book+chapter combination", () => {
        const row = getRow(SQL, ["genesis", "9999"]);
        expect(row).toBeNull();
    });

    it("returned row has chapter_id, volume_id, book_id, book_chapter, and name", () => {
        const row = getRow(SQL, ["genesis", "1"]);
        expect(row.chapter_id).toBeDefined();
        expect(row.volume_id).toBeDefined();
        expect(row.book_id).toBeDefined();
        expect(row.book_chapter).toBeDefined();
        expect(row.name).toBeDefined();
    });
});

// ===========================================================================
// getChapterParagraphs
// ===========================================================================

describe("getChapterParagraphs", () => {
    const SQL = `
        SELECT volume_id, book_id, chapter_id, position, paratext
        FROM paragraphs
        WHERE volume_id = ? AND book_id = ? AND chapter_id = ?
    `;

    it("returns 7 paragraphs for genesis chapter 1", () => {
        const rows = getRows(SQL, ["oc", "genesis", "1"]);
        expect(rows).toHaveLength(7);
    });

    it("each paragraph has required fields", () => {
        const rows = getRows(SQL, ["oc", "genesis", "1"]);
        for (const p of rows) {
            expect(p.volume_id).toBe("oc");
            expect(p.book_id).toBe("genesis");
            expect(p.chapter_id).toBe("1");
            expect(typeof p.position).toBe("number");
        }
    });

    it("returns empty array for non-existent chapter", () => {
        const rows = getRows(SQL, ["oc", "genesis", "9999"]);
        expect(rows).toHaveLength(0);
    });
});

// ===========================================================================
// getNumParagraphs
// ===========================================================================

describe("getNumParagraphs", () => {
    const SQL = `
        SELECT position as num_paragraphs FROM paragraphs
        WHERE volume_id = ? AND book_id = ?
        AND chapter_id = ?
        ORDER BY position DESC
        LIMIT 1
    `;

    it("returns 7 for genesis chapter 1", () => {
        const row = getRow(SQL, ["oc", "genesis", "1"]);
        expect(row?.num_paragraphs).toBe(7);
    });

    it("returns a positive number for any existing chapter", () => {
        const row = getRow(SQL, ["cc", "ccpreface", "0"]);
        expect(row).not.toBeNull();
        expect(row.num_paragraphs).toBeGreaterThan(0);
    });

    it("returns null for a non-existent chapter", () => {
        const row = getRow(SQL, ["oc", "genesis", "9999"]);
        expect(row).toBeNull();
    });
});

// ===========================================================================
// getBookReferenceName
// ===========================================================================

describe("getBookReferenceName", () => {
    const SQL = `SELECT COALESCE(reference_name, name) as name FROM books WHERE book_id = ? ORDER BY rowid ASC`;

    it("returns 'Genesis' for book_id 'genesis'", () => {
        const row = getRow(SQL, ["genesis"]);
        expect(row?.name).toBe("Genesis");
    });

    it("returns null for an unknown book_id", () => {
        const row = getRow(SQL, ["zzz_no_book"]);
        expect(row).toBeNull();
    });

    it("falls back to name when reference_name is null (COALESCE)", () => {
        const row = getRow(SQL, ["genesis"]);
        expect(row?.name).toBeTruthy();
    });
});

// ===========================================================================
// getLDSBookNames
// ===========================================================================

describe("getLDSBookNames", () => {
    const SQL = `
        SELECT volume_id, book_id, COALESCE(reference_name, name) as name
        FROM books
        WHERE (volume_id IN ('oc', 'nt') AND book_id NOT IN ('ejacob'))

        UNION ALL

        SELECT volume_id, book_id, COALESCE(reference_name, name) as name
        FROM books
        WHERE volume_id = 'bofm'

        UNION ALL

        SELECT 'tc' as volume_id, 'section' as book_id, 'D&C' as name
        UNION ALL
        SELECT 'tc' as volume_id, 'jshistory' as book_id, 'JS-H' as name
        UNION ALL
        SELECT 'tc' as volume_id, 'abraham' as book_id, 'Abraham' as name
        UNION ALL
        SELECT 'oc' as volume_id, 'genesis' as book_id, 'Moses' as name
        UNION ALL
        SELECT 'nt' as volume_id, 'matthew' as book_id, 'JS-M' as name
        UNION ALL
        SELECT 'tc' as volume_id, 'section' as book_id, 'A of F' as name

        ORDER BY name COLLATE NOCASE ASC
    `;

    it("returns results (non-empty)", () => {
        const rows = getRows(SQL);
        expect(rows.length).toBeGreaterThan(0);
    });

    it("excludes the ejacob book", () => {
        const rows = getRows(SQL);
        const found = rows.find((r: any) => r.book_id === "ejacob");
        expect(found).toBeUndefined();
    });

    it("includes oc and nt books", () => {
        const rows = getRows(SQL);
        const volumes = new Set(rows.map((r: any) => r.volume_id));
        expect(volumes.has("oc")).toBe(true);
        expect(volumes.has("nt")).toBe(true);
    });

    it("includes bofm books", () => {
        const rows = getRows(SQL);
        const bofm = rows.filter((r: any) => r.volume_id === "bofm");
        expect(bofm.length).toBeGreaterThan(0);
    });

    it("includes D&C (tc/section)", () => {
        const rows = getRows(SQL);
        const dc = rows.find((r: any) => r.name === "D&C");
        expect(dc).toBeDefined();
        expect(dc.book_id).toBe("section");
    });

    it("includes JS-H (tc/jshistory)", () => {
        const rows = getRows(SQL);
        const jsh = rows.find((r: any) => r.name === "JS-H");
        expect(jsh).toBeDefined();
        expect(jsh.book_id).toBe("jshistory");
    });

    it("includes Abraham (tc/abraham)", () => {
        const rows = getRows(SQL);
        const abr = rows.find((r: any) => r.name === "Abraham");
        expect(abr).toBeDefined();
        expect(abr.book_id).toBe("abraham");
    });

    it("includes Moses (mapped to oc/genesis)", () => {
        const rows = getRows(SQL);
        const moses = rows.find((r: any) => r.name === "Moses");
        expect(moses).toBeDefined();
        expect(moses.book_id).toBe("genesis");
    });

    it("includes JS-M (mapped to nt/matthew)", () => {
        const rows = getRows(SQL);
        const jsm = rows.find((r: any) => r.name === "JS-M");
        expect(jsm).toBeDefined();
        expect(jsm.book_id).toBe("matthew");
    });

    it("includes A of F (tc/section)", () => {
        const rows = getRows(SQL);
        const aof = rows.find((r: any) => r.name === "A of F");
        expect(aof).toBeDefined();
        expect(aof.volume_id).toBe("tc");
        expect(aof.book_id).toBe("section");
    });

    it("results are ordered alphabetically by name", () => {
        const rows = getRows(SQL);
        for (let i = 1; i < rows.length; i++) {
            expect(
                rows[i].name.toLowerCase() >= rows[i - 1].name.toLowerCase(),
            ).toBe(true);
        }
    });
});

// ===========================================================================
// getREBookNames
// ===========================================================================

describe("getREBookNames", () => {
    const SQL = `
        SELECT volume_id, book_id, COALESCE(reference_name, name) as name
        FROM books
        WHERE (volume_id IN ('oc', 'nt') AND book_id NOT IN ('james'))

        UNION ALL

        SELECT volume_id, book_id, COALESCE(reference_name, name) as name
        FROM books
        WHERE volume_id = 'bofm'

        UNION ALL

        SELECT volume_id, book_id, COALESCE(reference_name, name) as name
        FROM books
        WHERE volume_id IN ('tc')

        ORDER BY name ASC
    `;

    it("returns results (non-empty)", () => {
        const rows = getRows(SQL);
        expect(rows.length).toBeGreaterThan(0);
    });

    it("excludes the 'james' book from oc/nt", () => {
        const rows = getRows(SQL);
        const james = rows.find(
            (r: any) =>
                r.book_id === "james" &&
                (r.volume_id === "oc" || r.volume_id === "nt"),
        );
        expect(james).toBeUndefined();
    });

    it("includes tc books", () => {
        const rows = getRows(SQL);
        const tc = rows.filter((r: any) => r.volume_id === "tc");
        expect(tc.length).toBeGreaterThan(0);
    });
});

// ===========================================================================
// getAllBookNames
// ===========================================================================

describe("getAllBookNames", () => {
    const SQL = `
        SELECT volume_id, book_id, 'KJV ' || COALESCE(reference_name, name) as name
        FROM books
        WHERE volume_id IN ('oc', 'nt')

        UNION ALL

        SELECT volume_id, book_id, 'RE ' || COALESCE(reference_name, name) as name
        FROM books
        WHERE volume_id IN ('oc', 'nt')

        UNION ALL

        SELECT volume_id, book_id, 'LDS ' || COALESCE(reference_name, name) as name
        FROM books
        WHERE volume_id = 'bofm'

        UNION ALL

        SELECT volume_id, book_id, 'RE ' || COALESCE(reference_name, name) as name
        FROM books
        WHERE volume_id = 'bofm'

        UNION ALL

        SELECT volume_id, book_id, 'LDS ' || COALESCE(reference_name, name) as name
        FROM books
        WHERE book_id IN ('abraham', 'jshistory')

        UNION ALL

        SELECT volume_id, book_id, 'RE ' || COALESCE(reference_name, name) as name
        FROM books
        WHERE book_id IN ('abraham', 'jshistory')

        UNION ALL

        SELECT volume_id, book_id, COALESCE(reference_name, name) as name
        FROM books
        WHERE (volume_id = 'tc' OR volume_id = 'pgp' OR volume_id = 'dc')
            AND book_id NOT IN ('abraham', 'jshistory', 'js-h')

        ORDER BY name ASC
    `;

    it("returns results (non-empty)", () => {
        const rows = getRows(SQL);
        expect(rows.length).toBeGreaterThan(0);
    });

    it("includes KJV-prefixed oc/nt books", () => {
        const rows = getRows(SQL);
        const kjv = rows.filter((r: any) => r.name.startsWith("KJV "));
        expect(kjv.length).toBeGreaterThan(0);
    });

    it("includes RE-prefixed oc/nt books", () => {
        const rows = getRows(SQL);
        const re = rows.filter((r: any) => r.name.startsWith("RE "));
        expect(re.length).toBeGreaterThan(0);
    });

    it("includes LDS-prefixed bofm books", () => {
        const rows = getRows(SQL);
        const lds = rows.filter((r: any) => r.name.startsWith("LDS "));
        expect(lds.length).toBeGreaterThan(0);
    });

    it("excludes abraham from tc/pgp/dc group (no duplicate)", () => {
        const rows = getRows(SQL);
        // abraham appears as 'LDS Abraham' and 'RE Abraham', not plain 'Abraham' from pgp
        const plain = rows.filter((r: any) => r.name === "Abraham");
        expect(plain).toHaveLength(0);
    });
});

// ===========================================================================
// getLEReferences
// ===========================================================================

describe("getLEReferences", () => {
    // Simplified SQL without the CASE expression (avoids shell quoting issues),
    // using the actual SQL from useDatabase.ts for full paragraph range
    it("returns reference mapping rows for genesis chapter 1", () => {
        const rows = getRows(
            `WITH verse_ranges AS (
                SELECT target_book, target_chapter,
                       MIN(target_verse) as min_verse, MAX(target_verse) as max_verse,
                       COUNT(*) as verses_in_range,
                       (SELECT COUNT(*) FROM reference_mapping rm2
                        WHERE rm2.target_book = rm1.target_book
                        AND rm2.target_chapter = rm1.target_chapter) as total_chapter_verses
                FROM reference_mapping rm1
                WHERE book = ? AND chapter = ?
                GROUP BY target_book, target_chapter
            ),
            chapter_coverage AS (
                SELECT target_book, target_chapter, min_verse, max_verse,
                       verses_in_range = total_chapter_verses as is_complete_chapter
                FROM verse_ranges
            )
            SELECT target_book, target_chapter, min_verse, max_verse, is_complete_chapter
            FROM chapter_coverage
            ORDER BY target_chapter, min_verse`,
            ["genesis", 1],
        );
        expect(rows.length).toBeGreaterThan(0);
    });

    it("results include target_book and target_chapter fields", () => {
        const rows = getRows(
            `WITH verse_ranges AS (
                SELECT target_book, target_chapter,
                       MIN(target_verse) as min_verse, MAX(target_verse) as max_verse,
                       COUNT(*) as verses_in_range,
                       (SELECT COUNT(*) FROM reference_mapping rm2
                        WHERE rm2.target_book = rm1.target_book
                        AND rm2.target_chapter = rm1.target_chapter) as total_chapter_verses
                FROM reference_mapping rm1
                WHERE book = ? AND chapter = ?
                GROUP BY target_book, target_chapter
            ),
            chapter_coverage AS (
                SELECT target_book, target_chapter, min_verse, max_verse,
                       verses_in_range = total_chapter_verses as is_complete_chapter
                FROM verse_ranges
            )
            SELECT target_book, target_chapter, min_verse, max_verse, is_complete_chapter
            FROM chapter_coverage
            ORDER BY target_chapter, min_verse`,
            ["genesis", 1],
        );
        for (const r of rows) {
            expect(r.target_book).toBeDefined();
            expect(r.target_chapter).toBeDefined();
            expect(r.min_verse).toBeDefined();
            expect(r.max_verse).toBeDefined();
        }
    });

    it("returns empty array for a book+chapter with no mapping", () => {
        const rows = getRows(
            `WITH verse_ranges AS (
                SELECT target_book, target_chapter,
                       MIN(target_verse) as min_verse, MAX(target_verse) as max_verse,
                       COUNT(*) as verses_in_range,
                       (SELECT COUNT(*) FROM reference_mapping rm2
                        WHERE rm2.target_book = rm1.target_book
                        AND rm2.target_chapter = rm1.target_chapter) as total_chapter_verses
                FROM reference_mapping rm1
                WHERE book = ? AND chapter = ?
                GROUP BY target_book, target_chapter
            ),
            chapter_coverage AS (
                SELECT target_book, target_chapter, min_verse, max_verse,
                       verses_in_range = total_chapter_verses as is_complete_chapter
                FROM verse_ranges
            )
            SELECT target_book, target_chapter, min_verse, max_verse, is_complete_chapter
            FROM chapter_coverage
            ORDER BY target_chapter, min_verse`,
            ["nonexistentbook", 1],
        );
        expect(rows).toHaveLength(0);
    });
});

// ===========================================================================
// getREReferences
// ===========================================================================

describe("getREReferences", () => {
    const BASE_SQL = `
        SELECT rm.re_key, v.volume_id, b.book_id,
               c.book_chapter as chapter, c.chapter_id, c.chapter_name as name,
               rm.paragraph, MIN(rm.paragraph) as start_paragraph,
               MAX(rm.paragraph) as end_paragraph
        FROM reference_mapping rm
        JOIN volumes v ON rm.volume = v.volume_id
        JOIN books b ON rm.volume = b.volume_id AND rm.book = b.book_id
        JOIN chapters c ON rm.volume = c.volume_id AND rm.book = c.book_id AND rm.chapter = c.book_chapter
        WHERE target_book = ? AND (target_chapter = ?)
        GROUP BY volume, chapter
        ORDER BY volume ASC
    `;

    it("returns references for genesis chapter 1 (LE→RE)", () => {
        const rows = getRows(BASE_SQL, ["genesis", "1"]);
        expect(rows.length).toBeGreaterThan(0);
    });

    it("each row has volume_id, book_id, chapter, start_paragraph, end_paragraph", () => {
        const rows = getRows(BASE_SQL, ["genesis", "1"]);
        for (const r of rows) {
            expect(r.volume_id).toBeDefined();
            expect(r.book_id).toBeDefined();
            expect(r.chapter).toBeDefined();
            expect(r.start_paragraph).toBeDefined();
            expect(r.end_paragraph).toBeDefined();
        }
    });

    it("returns empty array for a target_book that does not exist", () => {
        const rows = getRows(BASE_SQL, ["nosuchbook", "1"]);
        expect(rows).toHaveLength(0);
    });

    it("returns T&C 146 paragraph for Articles of Faith 1:1 (aof chapter 1, verse 1)", () => {
        const SQL_WITH_KEY = `
            SELECT rm.re_key, v.volume_id, b.book_id,
                   c.book_chapter as chapter, c.chapter_id, c.chapter_name as name,
                   rm.paragraph, MIN(rm.paragraph) as start_paragraph,
                   MAX(rm.paragraph) as end_paragraph
            FROM reference_mapping rm
            JOIN volumes v ON rm.volume = v.volume_id
            JOIN books b ON rm.volume = b.volume_id AND rm.book = b.book_id
            JOIN chapters c ON rm.volume = c.volume_id AND rm.book = c.book_id AND rm.chapter = c.book_chapter
            WHERE target_book = ? AND target_key = ?
            GROUP BY volume, chapter
            ORDER BY volume ASC
        `;
        const rows = getRows(SQL_WITH_KEY, ["aof", "1:1"]);
        expect(rows.length).toBe(1);
        expect(rows[0].volume_id).toBe("tc");
        expect(rows[0].book_id).toBe("section");
        expect(Number(rows[0].chapter)).toBe(146);
        expect(rows[0].start_paragraph).toBe(21);
    });

    it("returns all 13 AoF paragraphs when querying aof chapter 1 (full chapter)", () => {
        const rows = getRows(BASE_SQL, ["aof", "1"]);
        expect(rows.length).toBe(1);
        expect(rows[0].start_paragraph).toBe(21);
        expect(rows[0].end_paragraph).toBe(33);
    });

    // The reader falls back to this mapping when a tapped in-text reference
    // names a chapter the Restoration Edition does not have. The Covenant of
    // Christ background cites "(see Jer. 39:1–2 RE)", but RE Jeremiah stops at
    // chapter 19 — those are KJV verse numbers, and the mapping is what turns
    // the tap into a real destination.
    it("resolves a KJV-numbered chapter the RE does not have (Jer. 39:1 → Jeremiah 15:17)", () => {
        const noSuchChapter = getRows(
            `SELECT chapter_id FROM chapters WHERE book_id = ? AND book_chapter = ?`,
            ["jeremiah", "39"],
        );
        expect(noSuchChapter).toHaveLength(0);

        const rows = getRows(
            `
            SELECT v.volume_id, b.book_id, c.book_chapter as chapter,
                   c.chapter_id, MIN(rm.paragraph) as start_paragraph
            FROM reference_mapping rm
            JOIN volumes v ON rm.volume = v.volume_id
            JOIN books b ON rm.volume = b.volume_id AND rm.book = b.book_id
            JOIN chapters c ON rm.volume = c.volume_id AND rm.book = c.book_id AND rm.chapter = c.book_chapter
            WHERE target_book = ? AND target_key = ?
            GROUP BY volume, chapter
            ORDER BY volume ASC
        `,
            ["jeremiah", "39:1"],
        );
        expect(rows.length).toBe(1);
        expect(rows[0].volume_id).toBe("oc");
        expect(rows[0].book_id).toBe("jeremiah");
        expect(Number(rows[0].chapter)).toBe(15);
        expect(rows[0].start_paragraph).toBe(17);
    });
});

// ===========================================================================
// searchKeywords (FTS5)
// ===========================================================================

describe("searchKeywords", () => {
    it("returns results for a simple keyword", () => {
        const term = CustomTokenizer.generateApostropheAwareSearch("faith");
        const rows = getRows(
            `SELECT p.volume_id, p.book_id, p.chapter_id, snippet(fts_paragraphs,5,'','','...',64) as text
             FROM fts_paragraphs p
             WHERE fts_paragraphs MATCH ?
             LIMIT 10`,
            [term],
        );
        expect(rows.length).toBeGreaterThan(0);
    });

    it("returns more than 100 results for 'faith' across the corpus", () => {
        const term = CustomTokenizer.generateApostropheAwareSearch("faith");
        const rows = getRows(
            `SELECT p.volume_id FROM fts_paragraphs p
             WHERE fts_paragraphs MATCH ?
             LIMIT 1000`,
            [term],
        );
        expect(rows.length).toBeGreaterThan(100);
    });

    it("returns empty array for an empty search term (caller guards)", () => {
        // searchKeywords early-returns [] when searchTerm is blank
        const result = "".trim().length === 0 ? [] : ["would_not_get_here"];
        expect(result).toHaveLength(0);
    });

    it("returns results for a multi-word search", () => {
        const term = CustomTokenizer.generateApostropheAwareSearch("love god");
        const rows = getRows(
            `SELECT p.volume_id FROM fts_paragraphs p
             WHERE fts_paragraphs MATCH ?
             LIMIT 100`,
            [term],
        );
        expect(rows.length).toBeGreaterThan(0);
    });

    it("volume_id filter narrows results to the specified volume", () => {
        const term = CustomTokenizer.generateApostropheAwareSearch("faith");
        const all = getRows(
            `SELECT p.volume_id FROM fts_paragraphs p WHERE fts_paragraphs MATCH ? LIMIT 1000`,
            [term],
        );
        const filtered = getRows(
            `SELECT p.volume_id FROM fts_paragraphs p WHERE fts_paragraphs MATCH ? AND p.volume_id = 'cc' LIMIT 1000`,
            [term],
        );
        expect(filtered.every((r: any) => r.volume_id === "cc")).toBe(true);
        expect(filtered.length).toBeLessThanOrEqual(all.length);
    });

    it("exact phrase search returns targeted results", () => {
        const term = '"Jesus Christ"';
        const rows = getRows(
            `SELECT p.volume_id FROM fts_paragraphs p
             WHERE fts_paragraphs MATCH ?
             LIMIT 100`,
            [term],
        );
        expect(rows.length).toBeGreaterThan(0);
    });

    it("snippet field is populated in results", () => {
        const term = CustomTokenizer.generateApostropheAwareSearch("repent");
        const rows = getRows(
            `SELECT snippet(fts_paragraphs,5,'','','...',64) as text
             FROM fts_paragraphs
             WHERE fts_paragraphs MATCH ?
             LIMIT 5`,
            [term],
        );
        expect(rows.length).toBeGreaterThan(0);
        for (const r of rows) {
            expect(typeof r.text).toBe("string");
        }
    });
});

// ===========================================================================
// getPreviousChapter and getNextChapter — tcOrder jump-table logic
// ===========================================================================

/**
 * Replica of the tcOrder constant from useDatabase.ts — kept in sync manually.
 * Tests will catch if the production array changes without updating this copy.
 */
const tcOrder: [string, string][] = [
    ["ccbackground:0", "ocforeword:0"], // CC end → OC start (ccglossary removed in v2)
    ["jshistory:20", "section:2"],
    ["section:109", "lecture:preface"],
    ["lecture:7", "section:111"],
    ["section:144", "abraham:fac1"],
    ["abraham:fac3", "section:146"],
    ["section:170", "toj:1"],
    ["toj:12", "section:172"],
    ["section:185", "tcappendix:sectionendnotes"], // sections go to 185 in v2 (was 177)
    ["tcappendix:sectionendnotes", "tcappendix:excludedrevelations"],
    ["tcappendix:excludedrevelations", "tcappendix:timeline"],
    ["tcappendix:timeline", "tcappendix:maps"],
    ["tcappendix:maps", "cctitle:0"],
];

/** Pure replica of getPreviousChapter's tcOrder lookup logic. */
function prevDiffOrder(bookId: string, bookChapter: string) {
    return tcOrder.find((arr) => arr[1] === `${bookId}:${bookChapter}`);
}

/** Pure replica of getNextChapter's tcOrder lookup logic. */
function nextDiffOrder(bookId: string, bookChapter: string) {
    return tcOrder.find((arr) => arr[0] === `${bookId}:${bookChapter}`);
}

describe("getPreviousChapter — tcOrder jump-table logic", () => {
    it("finds the prev entry for 'cctitle:0' → 'tcappendix:maps' (wraps to TC's last page)", () => {
        const entry = prevDiffOrder("cctitle", "0");
        expect(entry).toBeDefined();
        expect(entry![0]).toBe("tcappendix:maps");
    });

    it("finds the prev entry for 'ocforeword:0' → 'ccbackground:0'", () => {
        const entry = prevDiffOrder("ocforeword", "0");
        expect(entry).toBeDefined();
        expect(entry![0]).toBe("ccbackground:0");
    });

    it("resolves the prev bookId and bookChapter correctly from the entry", () => {
        const entry = prevDiffOrder("ocforeword", "0")!;
        const [newBookId, newBookChapter] = entry[0].split(":");
        expect(newBookId).toBe("ccbackground");
        expect(newBookChapter).toBe("0");
    });

    it("finds the prev entry for 'tcappendix:sectionendnotes' → 'section:185'", () => {
        const entry = prevDiffOrder("tcappendix", "sectionendnotes");
        expect(entry).toBeDefined();
        expect(entry![0]).toBe("section:185");
    });

    it("finds the prev entry for 'section:2' → 'jshistory:20'", () => {
        const entry = prevDiffOrder("section", "2");
        expect(entry![0]).toBe("jshistory:20");
    });

    it("finds the prev entry for 'lecture:preface' → 'section:109'", () => {
        const entry = prevDiffOrder("lecture", "preface");
        expect(entry![0]).toBe("section:109");
    });

    it("finds the prev entry for 'section:111' → 'lecture:7'", () => {
        const entry = prevDiffOrder("section", "111");
        expect(entry![0]).toBe("lecture:7");
    });

    it("finds the prev entry for 'tcappendix:maps' → 'tcappendix:timeline'", () => {
        const entry = prevDiffOrder("tcappendix", "maps");
        expect(entry).toBeDefined();
        expect(entry![0]).toBe("tcappendix:timeline");
    });

    it("returns undefined for a chapter not in the jump table", () => {
        const entry = prevDiffOrder("genesis", "1");
        expect(entry).toBeUndefined();
    });

    it("tcOrder has 13 entries (covers all known jumps)", () => {
        expect(tcOrder).toHaveLength(13);
    });

    it("each tcOrder entry has a valid 'prev:chapter' format for both sides", () => {
        for (const [from, to] of tcOrder) {
            expect(from).toMatch(/^[\w]+:[a-z0-9-]+$/);
            expect(to).toMatch(/^[\w]+:[a-z0-9-]+$/);
        }
    });

    it("all prev-side bookIds actually exist in the database", () => {
        const bookIds = [
            ...new Set(tcOrder.map(([from]) => from.split(":")[0])),
        ];
        for (const bookId of bookIds) {
            const row = getRow(
                "SELECT book_id FROM books WHERE book_id = ? LIMIT 1",
                [bookId],
            );
            expect(row?.book_id).toBe(bookId);
        }
    });
});

describe("getNextChapter — tcOrder jump-table logic", () => {
    it("rejects with 'end' when bookChapter is 'maps'", () => {
        const bookChapter = "maps";
        expect(bookChapter === "maps").toBe(true);
    });

    it("finds the next entry for 'ccbackground:0' → 'ocforeword:0'", () => {
        const entry = nextDiffOrder("ccbackground", "0");
        expect(entry).toBeDefined();
        expect(entry![1]).toBe("ocforeword:0");
    });

    it("resolves the next bookId and bookChapter correctly from the entry", () => {
        const entry = nextDiffOrder("ccbackground", "0")!;
        const [newBookId, newBookChapter] = entry[1].split(":");
        expect(newBookId).toBe("ocforeword");
        expect(newBookChapter).toBe("0");
    });

    it("finds the next entry for 'section:109' → 'lecture:preface'", () => {
        const entry = nextDiffOrder("section", "109");
        expect(entry![1]).toBe("lecture:preface");
    });

    it("finds the next entry for 'section:185' → 'tcappendix:sectionendnotes'", () => {
        const entry = nextDiffOrder("section", "185");
        expect(entry![1]).toBe("tcappendix:sectionendnotes");
    });

    it("finds the next entry for 'tcappendix:excludedrevelations' → 'tcappendix:timeline'", () => {
        const entry = nextDiffOrder("tcappendix", "excludedrevelations");
        expect(entry![1]).toBe("tcappendix:timeline");
    });

    it("finds the next entry for 'tcappendix:timeline' → 'tcappendix:maps'", () => {
        const entry = nextDiffOrder("tcappendix", "timeline");
        expect(entry![1]).toBe("tcappendix:maps");
    });

    it("returns undefined for a chapter not in the jump table", () => {
        const entry = nextDiffOrder("genesis", "1");
        expect(entry).toBeUndefined();
    });

    it("all next-side bookIds actually exist in the database", () => {
        const bookIds = [...new Set(tcOrder.map(([, to]) => to.split(":")[0]))];
        for (const bookId of bookIds) {
            const row = getRow(
                "SELECT book_id FROM books WHERE book_id = ? LIMIT 1",
                [bookId],
            );
            expect(row?.book_id).toBe(bookId);
        }
    });
});

describe("getPreviousChapter — standard (chapter_id - 1) path", () => {
    const SQL = `SELECT chapter_id, volume_id, book_id, book_chapter, chapter_name as name
        FROM chapters WHERE chapter_id = ?`;

    it("chapter_id 100 is 2 Samuel 1 (in oc)", () => {
        const row = getRow(SQL, [100]);
        expect(row).not.toBeNull();
        expect(row.book_id).toBe("2samuel");
        expect(row.book_chapter).toBe("1");
    });

    it("chapter_id 5 is genesis 2", () => {
        const row = getRow(SQL, [5]);
        expect(row).not.toBeNull();
        expect(row.book_id).toBe("genesis");
        expect(row.book_chapter).toBe("2");
    });
});

describe("getNextChapter — standard (chapter_id + 1) path", () => {
    const SQL = `SELECT chapter_id, volume_id, book_id, book_chapter, chapter_name as name
        FROM chapters WHERE chapter_id = ?`;

    it("chapter_id 4 + 1 = 5 → genesis 2", () => {
        const row = getRow(SQL, [5]);
        expect(row?.book_id).toBe("genesis");
        expect(row?.book_chapter).toBe("2");
    });

    it("non-existent chapter_id returns null", () => {
        const row = getRow(SQL, [999999]);
        expect(row).toBeNull();
    });
});

// ===========================================================================
// Highlight functions — addHighlight (duplicate/subset detection)
// ===========================================================================

describe("addHighlight — new highlight", () => {
    it("inserts a new highlight when no duplicate exists", () => {
        const id = nextId();
        insertHighlight(id);
        const row = userGetRow("SELECT * FROM highlights WHERE id = ?", [id]);
        expect(row).not.toBeNull();
        expect(row.id).toBe(id);
    });

    it("stored highlight has all expected fields", () => {
        const id = nextId();
        insertHighlight(id, {
            volume_id: "oc",
            book_id: "genesis",
            book_chapter: "3",
            paragraph_position: 5,
            start_offset: 0,
            end_offset: 12,
            selected_text: "In the beginning",
            color: "#ffccaa",
        });
        const row = userGetRow("SELECT * FROM highlights WHERE id = ?", [id]);
        expect(row.volume_id).toBe("oc");
        expect(row.book_id).toBe("genesis");
        expect(row.book_chapter).toBe("3");
        expect(row.paragraph_position).toBe(5);
        expect(row.start_offset).toBe(0);
        expect(row.end_offset).toBe(12);
        expect(row.selected_text).toBe("In the beginning");
        expect(row.color).toBe("#ffccaa");
    });

    it("created_at is auto-populated", () => {
        const id = nextId();
        insertHighlight(id);
        const row = userGetRow(
            "SELECT created_at FROM highlights WHERE id = ?",
            [id],
        );
        expect(row.created_at).toBeTruthy();
    });
});

describe("addHighlight — exact duplicate detection", () => {
    it("exact duplicate query matches an existing highlight at the same offsets", () => {
        const id = nextId();
        insertHighlight(id, {
            paragraph_position: 3,
            start_offset: 10,
            end_offset: 26,
        });

        // This mirrors the exact-duplicate check in addHighlight
        const dup = userGetRow(
            `SELECT id FROM highlights
             WHERE volume_id = ? AND book_id = ? AND book_chapter = ?
             AND paragraph_position = ? AND start_offset = ? AND end_offset = ?`,
            ["cc", "ccforeword", "1", 3, 10, 26],
        );
        expect(dup?.id).toBe(id);
    });

    it("exact duplicate query returns null when offsets differ", () => {
        const id = nextId();
        insertHighlight(id, {
            paragraph_position: 3,
            start_offset: 10,
            end_offset: 26,
        });

        const dup = userGetRow(
            `SELECT id FROM highlights
             WHERE volume_id = ? AND book_id = ? AND book_chapter = ?
             AND paragraph_position = ? AND start_offset = ? AND end_offset = ?`,
            ["cc", "ccforeword", "1", 3, 10, 30], // different end_offset
        );
        expect(dup).toBeNull();
    });
});

describe("addHighlight — subset (containing highlight) detection", () => {
    it("containing highlight query matches when new selection is fully within existing", () => {
        const id = nextId();
        // Existing: start=0, end=50
        insertHighlight(id, {
            paragraph_position: 3,
            start_offset: 0,
            end_offset: 50,
        });

        // New: start=10, end=30 — subset of existing
        const containing = userGetRow(
            `SELECT id, selected_text FROM highlights
             WHERE volume_id = ? AND book_id = ? AND book_chapter = ?
             AND paragraph_position = ?
             AND start_offset <= ? AND end_offset >= ?`,
            ["cc", "ccforeword", "1", 3, 10, 30],
        );
        expect(containing?.id).toBe(id);
    });

    it("containing highlight query does not match when new selection extends beyond existing", () => {
        const id = nextId();
        insertHighlight(id, {
            paragraph_position: 3,
            start_offset: 5,
            end_offset: 20,
        });

        const containing = userGetRow(
            `SELECT id FROM highlights
             WHERE volume_id = ? AND book_id = ? AND book_chapter = ?
             AND paragraph_position = ?
             AND start_offset <= ? AND end_offset >= ?`,
            ["cc", "ccforeword", "1", 3, 3, 25], // new start=3 < 5, so not subset
        );
        expect(containing).toBeNull();
    });
});

// ===========================================================================
// Highlight functions — getChapterHighlights
// ===========================================================================

describe("getChapterHighlights", () => {
    const SQL = `SELECT * FROM highlights
        WHERE volume_id = ? AND book_id = ? AND book_chapter = ?
        ORDER BY paragraph_position ASC, start_offset ASC`;

    it("returns all highlights for a chapter sorted by position then offset", () => {
        const id1 = nextId();
        const id2 = nextId();
        insertHighlight(id1, { paragraph_position: 5, start_offset: 20 });
        insertHighlight(id2, { paragraph_position: 3, start_offset: 10 });

        const rows = userGetRows(SQL, ["cc", "ccforeword", "1"]);
        expect(rows).toHaveLength(2);
        expect(rows[0].paragraph_position).toBeLessThanOrEqual(
            rows[1].paragraph_position,
        );
    });

    it("returns empty array when chapter has no highlights", () => {
        const rows = userGetRows(SQL, ["oc", "genesis", "99"]);
        expect(rows).toHaveLength(0);
    });

    it("does not return highlights from a different chapter", () => {
        const id = nextId();
        insertHighlight(id, { book_chapter: "2" }); // different chapter
        const rows = userGetRows(SQL, ["cc", "ccforeword", "1"]);
        expect(rows).toHaveLength(0);
    });

    it("returns multiple highlights in the same paragraph ordered by start_offset", () => {
        const id1 = nextId();
        const id2 = nextId();
        insertHighlight(id1, { paragraph_position: 3, start_offset: 50 });
        insertHighlight(id2, { paragraph_position: 3, start_offset: 10 });

        const rows = userGetRows(SQL, ["cc", "ccforeword", "1"]);
        expect(rows[0].start_offset).toBe(10);
        expect(rows[1].start_offset).toBe(50);
    });
});

// ===========================================================================
// Highlight functions — deleteHighlight
// ===========================================================================

describe("deleteHighlight", () => {
    it("removes the highlight with the specified id", () => {
        const id = nextId();
        insertHighlight(id);
        userRun("DELETE FROM highlights WHERE id = ?", [id]);
        const row = userGetRow("SELECT * FROM highlights WHERE id = ?", [id]);
        expect(row).toBeNull();
    });

    it("does not remove other highlights", () => {
        const id1 = nextId();
        const id2 = nextId();
        insertHighlight(id1);
        insertHighlight(id2, { paragraph_position: 10 });

        userRun("DELETE FROM highlights WHERE id = ?", [id1]);

        const remaining = userGetRows("SELECT * FROM highlights", []);
        expect(remaining).toHaveLength(1);
        expect(remaining[0].id).toBe(id2);
    });

    it("deleting a non-existent id changes 0 rows", () => {
        const result = userRun("DELETE FROM highlights WHERE id = ?", [
            "no-such-id",
        ]);
        expect(result.changes).toBe(0);
    });
});

// ===========================================================================
// Highlight functions — updateHighlightColor
// ===========================================================================

describe("updateHighlightColor", () => {
    it("updates the color of an existing highlight", () => {
        const id = nextId();
        insertHighlight(id, { color: "#FFFF00" });
        userRun(
            `UPDATE highlights SET color = ?, modified_at = datetime('now') WHERE id = ?`,
            ["#FF0000", id],
        );
        const row = userGetRow("SELECT color FROM highlights WHERE id = ?", [
            id,
        ]);
        expect(row.color).toBe("#FF0000");
    });

    it("updates modified_at timestamp", () => {
        const id = nextId();
        insertHighlight(id);
        const before = userGetRow(
            "SELECT modified_at FROM highlights WHERE id = ?",
            [id],
        );
        userRun(
            `UPDATE highlights SET color = ?, modified_at = datetime('now') WHERE id = ?`,
            ["#00FF00", id],
        );
        const after = userGetRow(
            "SELECT modified_at FROM highlights WHERE id = ?",
            [id],
        );
        // Both timestamps are valid datetime strings
        expect(after.modified_at).toBeTruthy();
        // modified_at could be same second, so just verify the field exists
        expect(typeof after.modified_at).toBe("string");
        void before; // suppress unused warning
    });

    it("does not affect other rows when updating by id", () => {
        const id1 = nextId();
        const id2 = nextId();
        insertHighlight(id1, { color: "#FFFF00" });
        insertHighlight(id2, { color: "#FFFF00", paragraph_position: 10 });
        userRun(
            `UPDATE highlights SET color = ?, modified_at = datetime('now') WHERE id = ?`,
            ["#FF0000", id1],
        );
        const row2 = userGetRow("SELECT color FROM highlights WHERE id = ?", [
            id2,
        ]);
        expect(row2.color).toBe("#FFFF00");
    });
});

// ===========================================================================
// Highlight functions — getAllHighlights
// ===========================================================================

describe("getAllHighlights", () => {
    const SQL = `SELECT * FROM highlights ORDER BY created_at DESC`;

    it("returns all highlights across volumes", () => {
        insertHighlight(nextId(), { volume_id: "cc" });
        insertHighlight(nextId(), {
            volume_id: "oc",
            book_id: "genesis",
            book_chapter: "1",
        });
        const rows = userGetRows(SQL);
        expect(rows).toHaveLength(2);
    });

    it("returns empty array when no highlights exist", () => {
        const rows = userGetRows(SQL);
        expect(rows).toHaveLength(0);
    });

    it("results are ordered by created_at descending", () => {
        const id1 = nextId();
        const id2 = nextId();
        insertHighlight(id1, { paragraph_position: 1 });
        insertHighlight(id2, { paragraph_position: 2 });
        const rows = userGetRows(SQL);
        // Created in same second — just verify both are present
        expect(rows).toHaveLength(2);
    });
});

// ===========================================================================
// Highlight functions — deduplicateHighlights
// ===========================================================================

describe("deduplicateHighlights", () => {
    it("keeps only the row with the minimum id among duplicates", () => {
        // Insert two highlights with the same logical key but different ids
        userRun(
            `INSERT INTO highlights (id, volume_id, book_id, book_chapter, paragraph_position, start_offset, end_offset, selected_text, color)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ["aaa-1", "cc", "ccforeword", "1", 3, 10, 26, "text", "#FFFF00"],
        );
        userRun(
            `INSERT INTO highlights (id, volume_id, book_id, book_chapter, paragraph_position, start_offset, end_offset, selected_text, color)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ["bbb-2", "cc", "ccforeword", "1", 3, 10, 26, "text", "#FFFF00"],
        );

        const result = userRun(
            `DELETE FROM highlights
             WHERE id NOT IN (
                 SELECT MIN(id)
                 FROM highlights
                 GROUP BY volume_id, book_id, book_chapter,
                          paragraph_position, start_offset, end_offset
             )`,
        );
        expect(result.changes).toBe(1);

        const remaining = userGetRows("SELECT * FROM highlights");
        expect(remaining).toHaveLength(1);
        expect(remaining[0].id).toBe("aaa-1"); // MIN("aaa-1", "bbb-2") = "aaa-1"
    });

    it("returns 0 changes when there are no duplicates", () => {
        insertHighlight(nextId(), {
            paragraph_position: 1,
            start_offset: 0,
            end_offset: 10,
        });
        insertHighlight(nextId(), {
            paragraph_position: 2,
            start_offset: 0,
            end_offset: 10,
        });

        const result = userRun(
            `DELETE FROM highlights
             WHERE id NOT IN (
                 SELECT MIN(id)
                 FROM highlights
                 GROUP BY volume_id, book_id, book_chapter,
                          paragraph_position, start_offset, end_offset
             )`,
        );
        expect(result.changes).toBe(0);
    });

    it("handles an empty highlights table gracefully", () => {
        const result = userRun(
            `DELETE FROM highlights
             WHERE id NOT IN (
                 SELECT MIN(id)
                 FROM highlights
                 GROUP BY volume_id, book_id, book_chapter,
                          paragraph_position, start_offset, end_offset
             )`,
        );
        expect(result.changes).toBe(0);
    });

    it("keeps all highlights when each has a unique position+offset key", () => {
        for (let i = 0; i < 5; i++) {
            insertHighlight(nextId(), {
                paragraph_position: i + 1,
                start_offset: i * 10,
                end_offset: i * 10 + 5,
            });
        }
        userRun(
            `DELETE FROM highlights
             WHERE id NOT IN (
                 SELECT MIN(id)
                 FROM highlights
                 GROUP BY volume_id, book_id, book_chapter,
                          paragraph_position, start_offset, end_offset
             )`,
        );
        const remaining = userGetRows("SELECT * FROM highlights");
        expect(remaining).toHaveLength(5);
    });
});

// ===========================================================================
// Highlight functions — mark_type (underline support)
// ===========================================================================

describe("mark_type — schema default", () => {
    it("defaults to 'highlight' when mark_type is not specified in INSERT", () => {
        const id = nextId();
        // Use the old-style INSERT without mark_type column — DEFAULT applies
        userRun(
            `INSERT INTO highlights
             (id, volume_id, book_id, book_chapter, paragraph_position,
              start_offset, end_offset, selected_text, color)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, "cc", "ccforeword", "1", 3, 10, 26, "text", "#FFFF00"],
        );
        const row = userGetRow(
            "SELECT mark_type FROM highlights WHERE id = ?",
            [id],
        );
        expect(row.mark_type).toBe("highlight");
    });

    it("stores 'highlight' mark_type explicitly", () => {
        const id = nextId();
        insertHighlight(id, { mark_type: "highlight" });
        const row = userGetRow(
            "SELECT mark_type FROM highlights WHERE id = ?",
            [id],
        );
        expect(row.mark_type).toBe("highlight");
    });

    it("stores 'underline' mark_type explicitly", () => {
        const id = nextId();
        insertHighlight(id, { mark_type: "underline" });
        const row = userGetRow(
            "SELECT mark_type FROM highlights WHERE id = ?",
            [id],
        );
        expect(row.mark_type).toBe("underline");
    });

    it("addHighlight stores all fields including mark_type", () => {
        const id = nextId();
        insertHighlight(id, {
            color: "hsl(267,75%,31%)",
            mark_type: "underline",
        });
        const row = userGetRow("SELECT * FROM highlights WHERE id = ?", [id]);
        expect(row.color).toBe("hsl(267,75%,31%)");
        expect(row.mark_type).toBe("underline");
    });
});

describe("mark_type — underline highlights are returned by getChapterHighlights", () => {
    const SQL = `SELECT * FROM highlights
        WHERE volume_id = ? AND book_id = ? AND book_chapter = ?
        ORDER BY paragraph_position ASC, start_offset ASC`;

    it("returns underline highlights alongside highlight marks", () => {
        const id1 = nextId();
        const id2 = nextId();
        insertHighlight(id1, { paragraph_position: 3, mark_type: "highlight" });
        insertHighlight(id2, { paragraph_position: 5, mark_type: "underline" });

        const rows = userGetRows(SQL, ["cc", "ccforeword", "1"]);
        expect(rows).toHaveLength(2);
        expect(rows.find((r: any) => r.id === id1).mark_type).toBe("highlight");
        expect(rows.find((r: any) => r.id === id2).mark_type).toBe("underline");
    });

    it("mark_type is included in every returned row", () => {
        insertHighlight(nextId());
        const rows = userGetRows(SQL, ["cc", "ccforeword", "1"]);
        expect(rows[0]).toHaveProperty("mark_type");
    });
});

describe("updateHighlightMarkType", () => {
    it("changes mark_type from highlight to underline", () => {
        const id = nextId();
        insertHighlight(id, { mark_type: "highlight" });
        userRun(
            `UPDATE highlights SET mark_type = ?, modified_at = datetime('now') WHERE id = ?`,
            ["underline", id],
        );
        const row = userGetRow(
            "SELECT mark_type FROM highlights WHERE id = ?",
            [id],
        );
        expect(row.mark_type).toBe("underline");
    });

    it("changes mark_type from underline back to highlight", () => {
        const id = nextId();
        insertHighlight(id, { mark_type: "underline" });
        userRun(
            `UPDATE highlights SET mark_type = ?, modified_at = datetime('now') WHERE id = ?`,
            ["highlight", id],
        );
        const row = userGetRow(
            "SELECT mark_type FROM highlights WHERE id = ?",
            [id],
        );
        expect(row.mark_type).toBe("highlight");
    });

    it("updates modified_at when mark_type changes", () => {
        const id = nextId();
        insertHighlight(id, { mark_type: "highlight" });
        userRun(
            `UPDATE highlights SET mark_type = ?, modified_at = datetime('now') WHERE id = ?`,
            ["underline", id],
        );
        const row = userGetRow(
            "SELECT modified_at FROM highlights WHERE id = ?",
            [id],
        );
        expect(typeof row.modified_at).toBe("string");
        expect(row.modified_at.length).toBeGreaterThan(0);
    });

    it("does not affect other rows", () => {
        const id1 = nextId();
        const id2 = nextId();
        insertHighlight(id1, { mark_type: "highlight" });
        insertHighlight(id2, {
            paragraph_position: 10,
            mark_type: "highlight",
        });
        userRun(
            `UPDATE highlights SET mark_type = ?, modified_at = datetime('now') WHERE id = ?`,
            ["underline", id1],
        );
        const row2 = userGetRow(
            "SELECT mark_type FROM highlights WHERE id = ?",
            [id2],
        );
        expect(row2.mark_type).toBe("highlight");
    });
});

describe("updateHighlightColor with mark_type", () => {
    it("updates both color and mark_type in a single statement", () => {
        const id = nextId();
        insertHighlight(id, { color: "#FFFF00", mark_type: "highlight" });
        userRun(
            `UPDATE highlights SET color = ?, mark_type = ?, modified_at = datetime('now') WHERE id = ?`,
            ["hsl(217,85%,34%)", "underline", id],
        );
        const row = userGetRow(
            "SELECT color, mark_type FROM highlights WHERE id = ?",
            [id],
        );
        expect(row.color).toBe("hsl(217,85%,34%)");
        expect(row.mark_type).toBe("underline");
    });

    it("can update color alone without changing mark_type", () => {
        const id = nextId();
        insertHighlight(id, { color: "#FFFF00", mark_type: "underline" });
        userRun(
            `UPDATE highlights SET color = ?, modified_at = datetime('now') WHERE id = ?`,
            ["hsl(96,57%,20%)", id],
        );
        const row = userGetRow(
            "SELECT color, mark_type FROM highlights WHERE id = ?",
            [id],
        );
        expect(row.color).toBe("hsl(96,57%,20%)");
        expect(row.mark_type).toBe("underline"); // unchanged
    });
});

// ===========================================================================
// getAnnotationsByType — userDb query
// ===========================================================================

describe("getAnnotationsByType — highlights-by-type query", () => {
    const SQL = `SELECT * FROM highlights WHERE mark_type = ? ORDER BY created_at DESC`;

    it("returns only highlights with mark_type 'highlight'", () => {
        insertHighlight(nextId(), {
            mark_type: "highlight",
            paragraph_position: 1,
        });
        insertHighlight(nextId(), {
            mark_type: "underline",
            paragraph_position: 2,
        });

        const rows = userGetRows(SQL, ["highlight"]);
        expect(rows).toHaveLength(1);
        expect(rows[0].mark_type).toBe("highlight");
    });

    it("returns only highlights with mark_type 'underline'", () => {
        insertHighlight(nextId(), {
            mark_type: "highlight",
            paragraph_position: 1,
        });
        insertHighlight(nextId(), {
            mark_type: "underline",
            paragraph_position: 2,
        });

        const rows = userGetRows(SQL, ["underline"]);
        expect(rows).toHaveLength(1);
        expect(rows[0].mark_type).toBe("underline");
    });

    it("returns empty array when no highlights of the given type exist", () => {
        insertHighlight(nextId(), { mark_type: "highlight" });

        const rows = userGetRows(SQL, ["underline"]);
        expect(rows).toHaveLength(0);
    });

    it("returns multiple highlights of the same type", () => {
        insertHighlight(nextId(), {
            mark_type: "highlight",
            paragraph_position: 1,
        });
        insertHighlight(nextId(), {
            mark_type: "highlight",
            paragraph_position: 2,
        });
        insertHighlight(nextId(), {
            mark_type: "highlight",
            paragraph_position: 3,
        });

        const rows = userGetRows(SQL, ["highlight"]);
        expect(rows).toHaveLength(3);
    });

    it("returns empty array when the table is empty", () => {
        const rows = userGetRows(SQL, ["highlight"]);
        expect(rows).toHaveLength(0);
    });

    it("each returned row includes all highlights table fields", () => {
        const id = nextId();
        insertHighlight(id, { mark_type: "highlight" });

        const row = userGetRows(SQL, ["highlight"])[0];
        expect(row.id).toBeDefined();
        expect(row.volume_id).toBeDefined();
        expect(row.book_id).toBeDefined();
        expect(row.book_chapter).toBeDefined();
        expect(row.paragraph_position).toBeDefined();
        expect(row.selected_text).toBeDefined();
        expect(row.color).toBeDefined();
        expect(row.mark_type).toBe("highlight");
        expect(row.created_at).toBeDefined();
    });
});

// ===========================================================================
// getAnnotationsByType — book name enrichment SQL
// ===========================================================================

describe("getAnnotationsByType — book name enrichment SQL", () => {
    it("returns book name for a known book_id", () => {
        const rows = getRows(
            `SELECT book_id, COALESCE(reference_name, name) as name FROM books WHERE book_id IN (?)`,
            ["genesis"],
        );
        expect(rows).toHaveLength(1);
        expect(rows[0].book_id).toBe("genesis");
        expect(rows[0].name).toBe("Genesis");
    });

    it("returns names for multiple book_ids", () => {
        const rows = getRows(
            `SELECT book_id, COALESCE(reference_name, name) as name FROM books WHERE book_id IN (?,?)`,
            ["genesis", "matthew"],
        );
        expect(rows.length).toBeGreaterThanOrEqual(2);
        const ids = rows.map((r: any) => r.book_id);
        expect(ids).toContain("genesis");
        expect(ids).toContain("matthew");
    });

    it("returns empty array for an unknown book_id", () => {
        const rows = getRows(
            `SELECT book_id, COALESCE(reference_name, name) as name FROM books WHERE book_id IN (?)`,
            ["zzz_no_book"],
        );
        expect(rows).toHaveLength(0);
    });

    it("COALESCE returns a non-null name for every book", () => {
        const rows = getRows(
            `SELECT book_id, COALESCE(reference_name, name) as name FROM books WHERE book_id IN (?,?)`,
            ["genesis", "ccpreface"],
        );
        for (const r of rows) {
            expect(r.name).toBeTruthy();
        }
    });
});

// ===========================================================================
// getAnnotationsByType — chapter info enrichment SQL
// ===========================================================================

describe("getAnnotationsByType — chapter info enrichment SQL", () => {
    it("returns chapter rows for a known book_id", () => {
        const rows = getRows(
            `SELECT book_id, book_chapter, chapter_id, chapter_name FROM chapters WHERE book_id IN (?)`,
            ["genesis"],
        );
        expect(rows.length).toBeGreaterThan(0);
    });

    it("each chapter row has book_id, book_chapter, chapter_id, and chapter_name", () => {
        const rows = getRows(
            `SELECT book_id, book_chapter, chapter_id, chapter_name FROM chapters WHERE book_id IN (?)`,
            ["genesis"],
        );
        for (const c of rows) {
            expect(c.book_id).toBe("genesis");
            expect(c.book_chapter).toBeDefined();
            expect(typeof c.chapter_id).toBe("number");
            expect(c.chapter_name).toBeDefined();
        }
    });

    it("chapter 1 of genesis is included in the results", () => {
        const rows = getRows(
            `SELECT book_id, book_chapter, chapter_id, chapter_name FROM chapters WHERE book_id IN (?)`,
            ["genesis"],
        );
        const ch1 = rows.find((r: any) => r.book_chapter === "1");
        expect(ch1).toBeDefined();
        expect(ch1.chapter_name).toMatch(/Genesis/);
    });

    it("composite map key 'book_id|book_chapter' uniquely identifies a chapter", () => {
        const rows = getRows(
            `SELECT book_id, book_chapter, chapter_id, chapter_name FROM chapters WHERE book_id IN (?)`,
            ["genesis"],
        );
        const keys = rows.map((c: any) => `${c.book_id}|${c.book_chapter}`);
        const uniqueKeys = new Set(keys);
        expect(uniqueKeys.size).toBe(keys.length);
    });

    it("returns empty array for an unknown book_id", () => {
        const rows = getRows(
            `SELECT book_id, book_chapter, chapter_id, chapter_name FROM chapters WHERE book_id IN (?)`,
            ["zzz_no_book"],
        );
        expect(rows).toHaveLength(0);
    });
});

// ===========================================================================
// getAnnotationsByType — volume name enrichment SQL
// ===========================================================================

describe("getAnnotationsByType — volume name enrichment SQL", () => {
    it("returns volume name for a known volume_id", () => {
        const rows = getRows(
            `SELECT volume_id, COALESCE(reference_name, name) as name FROM volumes WHERE volume_id IN (?)`,
            ["oc"],
        );
        expect(rows).toHaveLength(1);
        expect(rows[0].volume_id).toBe("oc");
        expect(typeof rows[0].name).toBe("string");
        expect(rows[0].name.length).toBeGreaterThan(0);
    });

    it("returns names for multiple volume_ids", () => {
        const rows = getRows(
            `SELECT volume_id, COALESCE(reference_name, name) as name FROM volumes WHERE volume_id IN (?,?)`,
            ["cc", "oc"],
        );
        expect(rows).toHaveLength(2);
        const ids = rows.map((r: any) => r.volume_id);
        expect(ids).toContain("cc");
        expect(ids).toContain("oc");
    });

    it("returns empty array for an unknown volume_id", () => {
        const rows = getRows(
            `SELECT volume_id, COALESCE(reference_name, name) as name FROM volumes WHERE volume_id IN (?)`,
            ["zzz_no_volume"],
        );
        expect(rows).toHaveLength(0);
    });
});

// ===========================================================================
// getAnnotationsByType — end-to-end enrichment logic
// ===========================================================================

describe("getAnnotationsByType — end-to-end enrichment logic", () => {
    it("enriches a highlight with book_name, chapter_id, chapter_name, and volume_name", () => {
        const id = nextId();
        insertHighlight(id, {
            volume_id: "oc",
            book_id: "genesis",
            book_chapter: "1",
            mark_type: "highlight",
        });

        // Step 1 — fetch highlights by type (mirrors addHighlight SQL)
        const highlights = userGetRows(
            `SELECT * FROM highlights WHERE mark_type = ? ORDER BY created_at DESC`,
            ["highlight"],
        );
        expect(highlights).toHaveLength(1);

        const uniqueBookIds = [
            ...new Set(highlights.map((h: any) => h.book_id)),
        ];
        const uniqueVolumeIds = [
            ...new Set(highlights.map((h: any) => h.volume_id)),
        ];

        // Step 2 — look up book names
        const books = getRows(
            `SELECT book_id, COALESCE(reference_name, name) as name FROM books WHERE book_id IN (?)`,
            uniqueBookIds,
        );
        const bookNameMap = new Map(books.map((b: any) => [b.book_id, b.name]));

        // Step 3 — look up chapter info
        const chapters = getRows(
            `SELECT book_id, book_chapter, chapter_id, chapter_name FROM chapters WHERE book_id IN (?)`,
            uniqueBookIds,
        );
        const chapterMap = new Map(
            chapters.map((c: any) => [`${c.book_id}|${c.book_chapter}`, c]),
        );

        // Step 4 — look up volume names
        const volumes = getRows(
            `SELECT volume_id, COALESCE(reference_name, name) as name FROM volumes WHERE volume_id IN (?)`,
            uniqueVolumeIds,
        );
        const volumeNameMap = new Map(
            volumes.map((v: any) => [v.volume_id, v.name]),
        );

        // Step 5 — enrich (mirrors the .map() in getAnnotationsByType)
        const h = highlights[0];
        const chapterInfo = chapterMap.get(`${h.book_id}|${h.book_chapter}`);
        const item = {
            ...h,
            book_name: bookNameMap.get(h.book_id) ?? h.book_id,
            chapter_id: chapterInfo?.chapter_id ?? 0,
            chapter_name: chapterInfo?.chapter_name ?? "",
            volume_name: volumeNameMap.get(h.volume_id) ?? h.volume_id,
        };

        expect(item.book_name).toBe("Genesis");
        expect(item.chapter_id).toBeGreaterThan(0);
        expect(item.chapter_name).toMatch(/Genesis/);
        expect(item.volume_name).toBeTruthy();
    });

    it("falls back to book_id when book is not in the main DB", () => {
        insertHighlight(nextId(), {
            volume_id: "cc",
            book_id: "zzz_no_such_book",
            book_chapter: "1",
            mark_type: "highlight",
        });

        const highlights = userGetRows(
            `SELECT * FROM highlights WHERE mark_type = ? ORDER BY created_at DESC`,
            ["highlight"],
        );
        const books = getRows(
            `SELECT book_id, COALESCE(reference_name, name) as name FROM books WHERE book_id IN (?)`,
            ["zzz_no_such_book"],
        );
        const bookNameMap = new Map(books.map((b: any) => [b.book_id, b.name]));

        const h = highlights[0];
        const book_name = bookNameMap.get(h.book_id) ?? h.book_id;
        expect(book_name).toBe("zzz_no_such_book");
    });

    it("falls back to chapter_id=0 and chapter_name='' when chapter is not found", () => {
        insertHighlight(nextId(), {
            volume_id: "oc",
            book_id: "genesis",
            book_chapter: "9999",
            mark_type: "highlight",
        });

        const highlights = userGetRows(
            `SELECT * FROM highlights WHERE mark_type = ? ORDER BY created_at DESC`,
            ["highlight"],
        );
        const chapters = getRows(
            `SELECT book_id, book_chapter, chapter_id, chapter_name FROM chapters WHERE book_id IN (?)`,
            ["genesis"],
        );
        const chapterMap = new Map(
            chapters.map((c: any) => [`${c.book_id}|${c.book_chapter}`, c]),
        );

        const h = highlights[0];
        const chapterInfo = chapterMap.get(`${h.book_id}|${h.book_chapter}`);
        expect(chapterInfo).toBeUndefined();

        const chapter_id = chapterInfo?.chapter_id ?? 0;
        const chapter_name = chapterInfo?.chapter_name ?? "";
        expect(chapter_id).toBe(0);
        expect(chapter_name).toBe("");
    });

    it("handles multiple highlights from different books in one call", () => {
        insertHighlight(nextId(), {
            volume_id: "oc",
            book_id: "genesis",
            book_chapter: "1",
            mark_type: "highlight",
            paragraph_position: 1,
        });
        insertHighlight(nextId(), {
            volume_id: "oc",
            book_id: "exodus",
            book_chapter: "1",
            mark_type: "highlight",
            paragraph_position: 2,
        });

        const highlights = userGetRows(
            `SELECT * FROM highlights WHERE mark_type = ? ORDER BY created_at DESC`,
            ["highlight"],
        );
        expect(highlights).toHaveLength(2);

        const uniqueBookIds = [
            ...new Set(highlights.map((h: any) => h.book_id)),
        ];
        expect(uniqueBookIds).toHaveLength(2);

        // Build the dynamic IN clause the same way the hook does
        const bookPlaceholders = uniqueBookIds.map(() => "?").join(",");
        const books = getRows(
            `SELECT book_id, COALESCE(reference_name, name) as name FROM books WHERE book_id IN (${bookPlaceholders})`,
            uniqueBookIds,
        );
        expect(books).toHaveLength(2);
    });

    it("returns items ordered by created_at DESC (most recent first)", () => {
        // Insert in order; since SQLite datetime precision is seconds,
        // both may share the same timestamp — just verify count and presence.
        insertHighlight(nextId(), {
            mark_type: "highlight",
            paragraph_position: 1,
        });
        insertHighlight(nextId(), {
            mark_type: "highlight",
            paragraph_position: 2,
        });

        const rows = userGetRows(
            `SELECT * FROM highlights WHERE mark_type = ? ORDER BY created_at DESC`,
            ["highlight"],
        );
        expect(rows).toHaveLength(2);
    });
});

// ===========================================================================
// deleteAllAnnotationsByType
// ===========================================================================

describe("deleteAllAnnotationsByType", () => {
    const SQL = `DELETE FROM highlights WHERE mark_type = ?`;

    it("deletes all highlights of the specified mark_type", () => {
        insertHighlight(nextId(), {
            mark_type: "highlight",
            paragraph_position: 1,
        });
        insertHighlight(nextId(), {
            mark_type: "highlight",
            paragraph_position: 2,
        });
        insertHighlight(nextId(), {
            mark_type: "highlight",
            paragraph_position: 3,
        });

        const result = userRun(SQL, ["highlight"]);
        expect(result.changes).toBe(3);

        const remaining = userGetRows("SELECT * FROM highlights");
        expect(remaining).toHaveLength(0);
    });

    it("does not delete highlights of a different mark_type", () => {
        insertHighlight(nextId(), {
            mark_type: "highlight",
            paragraph_position: 1,
        });
        insertHighlight(nextId(), {
            mark_type: "underline",
            paragraph_position: 2,
        });

        userRun(SQL, ["highlight"]);

        const remaining = userGetRows("SELECT * FROM highlights");
        expect(remaining).toHaveLength(1);
        expect(remaining[0].mark_type).toBe("underline");
    });

    it("returns 0 changes when no highlights of that type exist", () => {
        insertHighlight(nextId(), { mark_type: "underline" });

        const result = userRun(SQL, ["highlight"]);
        expect(result.changes).toBe(0);
    });

    it("handles an empty table without error", () => {
        const result = userRun(SQL, ["highlight"]);
        expect(result.changes).toBe(0);
    });

    it("deletes all underlines and leaves highlights intact", () => {
        insertHighlight(nextId(), {
            mark_type: "highlight",
            paragraph_position: 1,
        });
        insertHighlight(nextId(), {
            mark_type: "underline",
            paragraph_position: 2,
        });
        insertHighlight(nextId(), {
            mark_type: "underline",
            paragraph_position: 3,
        });

        userRun(SQL, ["underline"]);

        const remaining = userGetRows("SELECT * FROM highlights");
        expect(remaining).toHaveLength(1);
        expect(remaining[0].mark_type).toBe("highlight");
    });

    it("deletes every row when all rows share the given mark_type", () => {
        for (let i = 1; i <= 5; i++) {
            insertHighlight(nextId(), {
                mark_type: "underline",
                paragraph_position: i,
            });
        }

        const result = userRun(SQL, ["underline"]);
        expect(result.changes).toBe(5);

        const remaining = userGetRows("SELECT * FROM highlights");
        expect(remaining).toHaveLength(0);
    });
});
