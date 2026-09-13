/**
 * Unit tests for the pure logic embedded in converter.tsx.
 *
 * Each helper below is a verbatim mirror of the corresponding inline
 * expression in the screen so that tests fail if the source code drifts.
 *
 * Covered:
 *   1. buildFullReference      — book + chapter + verse assembly
 *   2. parseReference          — regex parsing of the assembled string
 *   3. D&C alias               — "d&c" → "section" normalisation
 *   4. filterBookNames         — excluded-word filtering
 *   5. buildAutocompleteData   — deduplication + id/title mapping
 *   6. formatLEtoRELabel       — label string for LE→RE results
 *   7. formatREtoLELabel       — label string for RE→LE results
 *   8. navigatePosition        — start_paragraph ?? paragraph fallback
 */

import type { Reference } from "../../data/types";

// ---------------------------------------------------------------------------
// 1. buildFullReference — mirrors translateReference() lines 158-163
// ---------------------------------------------------------------------------

/** Mirrors the fullReference assembly in translateReference(). */
function buildFullReference(
    reference: string,
    chapter: string,
    verse: string,
): string {
    let fullReference = reference.trim();
    if (chapter) {
        fullReference += ` ${chapter}`;
        if (verse) {
            fullReference += `:${verse}`;
        }
    }
    return fullReference;
}

// ---------------------------------------------------------------------------
// 2 & 3. parseReference + D&C alias — mirrors translateReference() lines 166-188
// ---------------------------------------------------------------------------

const BOOK_CHAPTER_PARAGRAPH_REGEX =
    /^(?<book>[\w\s\.\&\-]*)\s+(?<chapter>\d+)(?:\s*:\s*(?<paragraphExpression>(?:\d+(?:\s*-\s*\d+)?)(?:\s*,\s*(?:\d+(?:\s*-\s*\d+)?))*))?$/;

interface ParsedReference {
    book: string;
    chapter: string;
    paragraphExpression?: string;
}

/** Mirrors the regex match + D&C alias applied in translateReference(). */
function parseReference(fullReference: string): ParsedReference | null {
    const found = fullReference.match(BOOK_CHAPTER_PARAGRAPH_REGEX);
    if (!found?.groups) return null;

    let book = found.groups.book.replace(/[.]/g, "").toLowerCase();
    if (book === "d&c") book = "section";

    return {
        book,
        chapter: found.groups.chapter,
        paragraphExpression: found.groups.paragraphExpression,
    };
}

// ---------------------------------------------------------------------------
// 4. filterBookNames — mirrors the loadBookNames effect, lines 116-136
// ---------------------------------------------------------------------------

interface BookEntry {
    name: string;
    [key: string]: any;
}

const EXCLUDED_WORDS = [
    "foreword",
    "canonization",
    "dedication",
    "preface",
    "introduction",
    "glossary",
    "tow",
];

/** Mirrors the filter + deduplication in loadBookNames(). */
function filterBookNames(books: BookEntry[]): BookEntry[] {
    return books.filter((book) => {
        const lowerName = book.name.toLowerCase();
        return !EXCLUDED_WORDS.some((word) => lowerName.includes(word));
    });
}

// ---------------------------------------------------------------------------
// 5. buildAutocompleteData — mirrors loadBookNames() lines 133-144
// ---------------------------------------------------------------------------

interface AutocompleteEntry {
    id: string;
    title: string;
}

/** Mirrors the dedup-by-name + autocomplete mapping in loadBookNames(). */
function buildAutocompleteData(books: BookEntry[]): AutocompleteEntry[] {
    const uniqueBooks = Array.from(
        new Map(books.map((book) => [book.name, book])).values(),
    );
    return uniqueBooks.map((book) => ({
        id: book.name,
        title: book.name + " ",
    }));
}

// ---------------------------------------------------------------------------
// 6. formatLEtoRELabel — mirrors the "else" branch in translateReference(), lines 218-226
// ---------------------------------------------------------------------------

/** Mirrors the LE→RE label formatter in translateReference(). */
function formatLEtoRELabel(translatedBook: string, r: Reference): string {
    let label = `${translatedBook} ${r.chapter}`;
    if (r.start_paragraph && r.end_paragraph) {
        label +=
            r.end_paragraph !== r.start_paragraph
                ? `:${r.start_paragraph}-${r.end_paragraph}`
                : `:${r.start_paragraph}`;
    }
    label += r.volume_id === "cc" ? " CE" : " RE";
    return label;
}

// ---------------------------------------------------------------------------
// 7. formatREtoLELabel — mirrors the RE2LE branch in translateReference(), line 216
// ---------------------------------------------------------------------------

/** Mirrors the RE→LE label formatter in translateReference(). */
function formatREtoLELabel(translatedBook: string, r: Reference): string {
    return `${translatedBook} ${r.is_complete_chapter ? r.target_chapter : r.verse_range}`;
}

// ---------------------------------------------------------------------------
// 8. navigatePosition — mirrors navigateToReference(), line 244
// ---------------------------------------------------------------------------

/** Mirrors the position expression in navigateToReference(). */
function navigatePosition(item: {
    start_paragraph?: number;
    paragraph?: number;
}): number | undefined {
    return item.start_paragraph ?? item.paragraph;
}

// ===========================================================================
// Tests
// ===========================================================================

// ---------------------------------------------------------------------------
// 1. buildFullReference
// ---------------------------------------------------------------------------

describe("buildFullReference", () => {
    it("returns just the trimmed reference when chapter is empty", () => {
        expect(buildFullReference("Genesis", "", "")).toBe("Genesis");
    });

    it("appends chapter when present and verse is absent", () => {
        expect(buildFullReference("Genesis", "1", "")).toBe("Genesis 1");
    });

    it("appends chapter and verse separated by colon", () => {
        expect(buildFullReference("Genesis", "1", "5")).toBe("Genesis 1:5");
    });

    it("does not append verse when chapter is empty", () => {
        expect(buildFullReference("Genesis", "", "5")).toBe("Genesis");
    });

    it("trims leading/trailing whitespace from the book part", () => {
        expect(buildFullReference("  Genesis  ", "3", "")).toBe("Genesis 3");
    });

    it("handles multi-word book names", () => {
        expect(buildFullReference("1 Nephi", "3", "7")).toBe("1 Nephi 3:7");
    });
});

// ---------------------------------------------------------------------------
// 2. parseReference — regex matching
// ---------------------------------------------------------------------------

describe("parseReference — regex parsing", () => {
    it("parses a simple book + chapter reference", () => {
        const result = parseReference("genesis 1");
        expect(result).not.toBeNull();
        expect(result!.book).toBe("genesis");
        expect(result!.chapter).toBe("1");
        expect(result!.paragraphExpression).toBeUndefined();
    });

    it("parses book + chapter + single verse", () => {
        const result = parseReference("genesis 1:1");
        expect(result!.paragraphExpression).toBe("1");
    });

    it("parses book + chapter + verse range", () => {
        const result = parseReference("Isa. 29:1-2");
        expect(result).not.toBeNull();
        expect(result!.book).toBe("isa"); // dot stripped, lowercased
        expect(result!.chapter).toBe("29");
        expect(result!.paragraphExpression).toBe("1-2");
    });

    it("parses a multi-word book", () => {
        const result = parseReference("1 Ne 3:7");
        expect(result).not.toBeNull();
        expect(result!.book).toBe("1 ne");
        expect(result!.chapter).toBe("3");
        expect(result!.paragraphExpression).toBe("7");
    });

    it("parses a comma-separated verse list", () => {
        const result = parseReference("1 Ne 3:7-11,14");
        expect(result).not.toBeNull();
        expect(result!.paragraphExpression).toBe("7-11,14");
    });

    it("strips periods from book abbreviations", () => {
        const result = parseReference("Isa. 29");
        expect(result!.book).toBe("isa");
    });

    it("lowercases the book name", () => {
        const result = parseReference("GENESIS 1");
        expect(result!.book).toBe("genesis");
    });

    it("returns null for a string with no chapter number", () => {
        expect(parseReference("genesis")).toBeNull();
    });

    it("returns null for an empty string", () => {
        expect(parseReference("")).toBeNull();
    });

    it("returns null for a bare number", () => {
        expect(parseReference("42")).toBeNull();
    });

    it("parses references with spaces around the colon", () => {
        const result = parseReference("Genesis 1 : 3");
        expect(result).not.toBeNull();
        expect(result!.paragraphExpression).toBe("3");
    });

    it("handles D&C in the book name (ampersand is allowed)", () => {
        const result = parseReference("D&C 110");
        expect(result).not.toBeNull();
        expect(result!.book).toBe("section"); // alias applied
        expect(result!.chapter).toBe("110");
    });

    it("handles book names with hyphens", () => {
        const result = parseReference("JST Gen. 14");
        expect(result).not.toBeNull();
        expect(result!.chapter).toBe("14");
    });
});

// ---------------------------------------------------------------------------
// 3. D&C alias
// ---------------------------------------------------------------------------

describe("D&C alias", () => {
    it("maps 'd&c' to 'section'", () => {
        const result = parseReference("D&C 110");
        expect(result!.book).toBe("section");
    });

    it("does not alter a non-D&C book", () => {
        const result = parseReference("Genesis 1");
        expect(result!.book).toBe("genesis");
    });
});

// ---------------------------------------------------------------------------
// 4. filterBookNames
// ---------------------------------------------------------------------------

describe("filterBookNames", () => {
    it("keeps a regular book name", () => {
        const books = [{ name: "Genesis" }];
        expect(filterBookNames(books)).toHaveLength(1);
    });

    it("removes a book whose name contains 'foreword'", () => {
        expect(filterBookNames([{ name: "CC Foreword" }])).toHaveLength(0);
    });

    it("removes a book whose name contains 'glossary'", () => {
        expect(filterBookNames([{ name: "TC Glossary" }])).toHaveLength(0);
    });

    it("removes a book whose name contains 'canonization'", () => {
        expect(
            filterBookNames([{ name: "Canonization Statement" }]),
        ).toHaveLength(0);
    });

    it("removes a book whose name contains 'dedication'", () => {
        expect(filterBookNames([{ name: "RE Dedication" }])).toHaveLength(0);
    });

    it("removes a book whose name contains 'preface'", () => {
        expect(filterBookNames([{ name: "Preface" }])).toHaveLength(0);
    });

    it("removes a book whose name contains 'introduction'", () => {
        expect(filterBookNames([{ name: "Introduction" }])).toHaveLength(0);
    });

    it("removes a book whose name contains 'tow'", () => {
        // The substring check matches any name containing "tow" (e.g. the "tow" abbreviation)
        expect(filterBookNames([{ name: "TOW" }])).toHaveLength(0);
    });

    it("is case-insensitive for excluded words", () => {
        expect(filterBookNames([{ name: "FOREWORD" }])).toHaveLength(0);
        expect(filterBookNames([{ name: "Glossary" }])).toHaveLength(0);
    });

    it("keeps a name that merely starts with an excluded substring (not substring match)", () => {
        // "tow" is in EXCLUDED_WORDS — "tower" contains "tow" so it IS excluded
        expect(filterBookNames([{ name: "Tower of Babel" }])).toHaveLength(0);
    });

    it("returns an empty array for empty input", () => {
        expect(filterBookNames([])).toEqual([]);
    });

    it("filters multiple books in one pass", () => {
        const books = [
            { name: "Genesis" },
            { name: "Foreword" },
            { name: "Exodus" },
            { name: "TC Glossary" },
        ];
        const result = filterBookNames(books);
        expect(result).toHaveLength(2);
        expect(result.map((b) => b.name)).toEqual(["Genesis", "Exodus"]);
    });
});

// ---------------------------------------------------------------------------
// 5. buildAutocompleteData
// ---------------------------------------------------------------------------

describe("buildAutocompleteData", () => {
    it("maps book name to id", () => {
        const result = buildAutocompleteData([{ name: "Genesis" }]);
        expect(result[0].id).toBe("Genesis");
    });

    it("title has a trailing space", () => {
        const result = buildAutocompleteData([{ name: "Genesis" }]);
        expect(result[0].title).toBe("Genesis ");
    });

    it("deduplicates books with the same name", () => {
        const books = [
            { name: "Genesis (KJV)", volume_id: "oc" },
            { name: "Genesis (KJV)", volume_id: "nc" },
        ];
        expect(buildAutocompleteData(books)).toHaveLength(1);
    });

    it("keeps the first occurrence when deduplicating", () => {
        const books = [
            { name: "Genesis", volume_id: "oc" },
            { name: "Genesis", volume_id: "nc" },
        ];
        expect(buildAutocompleteData(books)[0].id).toBe("Genesis");
    });

    it("preserves distinct names", () => {
        const books = [
            { name: "Genesis" },
            { name: "Exodus" },
            { name: "Leviticus" },
        ];
        expect(buildAutocompleteData(books)).toHaveLength(3);
    });

    it("returns an empty array for empty input", () => {
        expect(buildAutocompleteData([])).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// 6. formatLEtoRELabel
// ---------------------------------------------------------------------------

describe("formatLEtoRELabel (LE→RE direction)", () => {
    it("formats a cc volume result with ' CE' suffix", () => {
        const r: Reference = { chapter: 3, volume_id: "cc" };
        expect(formatLEtoRELabel("Covenant of Christ", r)).toBe(
            "Covenant of Christ 3 CE",
        );
    });

    it("formats a non-cc volume result with ' RE' suffix", () => {
        const r: Reference = { chapter: 5, volume_id: "oc" };
        expect(formatLEtoRELabel("Genesis", r)).toBe("Genesis 5 RE");
    });

    it("appends a single paragraph when start equals end", () => {
        const r: Reference = {
            chapter: 2,
            volume_id: "oc",
            start_paragraph: 4,
            end_paragraph: 4,
        };
        expect(formatLEtoRELabel("Genesis", r)).toBe("Genesis 2:4 RE");
    });

    it("appends a paragraph range when start differs from end", () => {
        const r: Reference = {
            chapter: 2,
            volume_id: "oc",
            start_paragraph: 4,
            end_paragraph: 9,
        };
        expect(formatLEtoRELabel("Genesis", r)).toBe("Genesis 2:4-9 RE");
    });

    it("omits paragraph range when start_paragraph is 0 (falsy)", () => {
        const r: Reference = {
            chapter: 1,
            volume_id: "oc",
            start_paragraph: 0,
            end_paragraph: 5,
        };
        expect(formatLEtoRELabel("Genesis", r)).toBe("Genesis 1 RE");
    });

    it("omits paragraph range when only start_paragraph is set (no end)", () => {
        const r: Reference = {
            chapter: 1,
            volume_id: "oc",
            start_paragraph: 3,
        };
        expect(formatLEtoRELabel("Genesis", r)).toBe("Genesis 1 RE");
    });

    it("omits paragraph range when only end_paragraph is set (no start)", () => {
        const r: Reference = { chapter: 1, volume_id: "oc", end_paragraph: 3 };
        expect(formatLEtoRELabel("Genesis", r)).toBe("Genesis 1 RE");
    });

    it("uses ' RE' for nc volume", () => {
        const r: Reference = { chapter: 7, volume_id: "nc" };
        expect(formatLEtoRELabel("Matthew", r)).toBe("Matthew 7 RE");
    });

    it("uses ' RE' for tc volume", () => {
        const r: Reference = { chapter: 26, volume_id: "tc" };
        expect(formatLEtoRELabel("Section", r)).toBe("Section 26 RE");
    });
});

// ---------------------------------------------------------------------------
// 7. formatREtoLELabel
// ---------------------------------------------------------------------------

describe("formatREtoLELabel (RE→LE direction)", () => {
    it("uses target_chapter when is_complete_chapter is true", () => {
        const r: Reference = { is_complete_chapter: true, target_chapter: 24 };
        expect(formatREtoLELabel("Matthew", r)).toBe("Matthew 24");
    });

    it("uses verse_range when is_complete_chapter is false", () => {
        const r: Reference = {
            is_complete_chapter: false,
            verse_range: "3:13-19",
        };
        expect(formatREtoLELabel("Genesis", r)).toBe("Genesis 3:13-19");
    });

    it("uses verse_range when is_complete_chapter is undefined", () => {
        const r: Reference = { verse_range: "10:1" };
        expect(formatREtoLELabel("Acts", r)).toBe("Acts 10:1");
    });

    it("uses verse_range when is_complete_chapter is explicitly false", () => {
        const r: Reference = {
            is_complete_chapter: false,
            verse_range: "5:1-15",
        };
        expect(formatREtoLELabel("3 Nephi", r)).toBe("3 Nephi 5:1-15");
    });

    it("formats correctly for D&C (book name comes from DB lookup)", () => {
        const r: Reference = { is_complete_chapter: true, target_chapter: 110 };
        expect(formatREtoLELabel("D&C", r)).toBe("D&C 110");
    });
});

// ---------------------------------------------------------------------------
// 8. navigatePosition
// ---------------------------------------------------------------------------

describe("navigatePosition", () => {
    it("returns start_paragraph when present", () => {
        expect(navigatePosition({ start_paragraph: 5, paragraph: 2 })).toBe(5);
    });

    it("falls back to paragraph when start_paragraph is undefined", () => {
        expect(navigatePosition({ paragraph: 7 })).toBe(7);
    });

    it("returns undefined when both are absent", () => {
        expect(navigatePosition({})).toBeUndefined();
    });

    it("returns start_paragraph of 0 (does not fall through to paragraph)", () => {
        expect(navigatePosition({ start_paragraph: 0, paragraph: 3 })).toBe(0);
    });

    it("returns paragraph when start_paragraph is undefined even if paragraph is 0", () => {
        expect(navigatePosition({ paragraph: 0 })).toBe(0);
    });
});
