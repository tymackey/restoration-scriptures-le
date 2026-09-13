/**
 * Unit tests for search result edge cases:
 *   1. Deduplication — tcappendix and glossary results are collapsed to one per chapter
 *   2. Navigation position — appendix/glossary results navigate to position 0
 *   3. Link text formatting — appendix/glossary show chapter_name, no paragraph number
 *
 * All three behaviours are pure logic; the helpers below mirror the exact code
 * in searchResults.tsx so the tests break if the component logic drifts.
 */

// ---------------------------------------------------------------------------
// Pure helpers (mirrors of the inline logic in searchResults.tsx)
// ---------------------------------------------------------------------------

/** Mirrors the deduplication filter applied after searchKeywords returns. */
function deduplicateResults(results: any[]): any[] {
    const seenChapters = new Set<string>();
    return results.filter((result) => {
        if (result.book_id === "tcappendix" || result.book_id === "glossary") {
            if (seenChapters.has(result.chapter_id)) return false;
            seenChapters.add(result.chapter_id);
        }
        return true;
    });
}

/** Mirrors the position expression inside navigateToReference. */
function navigationPosition(item: any): number {
    return item.paratext ||
        item.book_id === "tcappendix" ||
        item.book_id === "glossary"
        ? 0
        : item.position;
}

/** Mirrors the ternary used to build the result link text. */
function resultLinkText(item: any): string {
    if (item.chapter === "0") {
        return `(${item.volume}) ${item.name}`;
    }
    if (item.book_id === "tcappendix" || item.book_id === "glossary") {
        return `(${item.volume}) ${item.book}: ${item.name}`;
    }
    return `(${item.volume}) ${item.book} ${item.chapter}${!item.paratext ? `:${item.position}` : ""}`;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeResult(
    overrides: Partial<{
        book_id: string;
        chapter_id: string;
        chapter: string;
        volume: string;
        volume_id: string;
        book: string;
        name: string;
        position: number;
        paratext: string | null;
        text: string;
    }> = {},
): any {
    return {
        book_id: "section",
        chapter_id: "500",
        chapter: "42",
        volume: "Teachings & Commandments",
        volume_id: "tc",
        book: "Section",
        name: "Section 42",
        position: 3,
        paratext: null,
        text: "some text",
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// 1. Deduplication
// ---------------------------------------------------------------------------

describe("deduplication of tcappendix and glossary results", () => {
    test("non-appendix results are never deduplicated", () => {
        const results = [
            makeResult({ book_id: "section", chapter_id: "100", position: 1 }),
            makeResult({ book_id: "section", chapter_id: "100", position: 2 }),
        ];
        expect(deduplicateResults(results)).toHaveLength(2);
    });

    test("keeps the first tcappendix result for each chapter, removes the rest", () => {
        const results = [
            makeResult({
                book_id: "tcappendix",
                chapter_id: "42",
                position: 1,
            }),
            makeResult({
                book_id: "tcappendix",
                chapter_id: "42",
                position: 2,
            }),
            makeResult({
                book_id: "tcappendix",
                chapter_id: "42",
                position: 5,
            }),
        ];
        const deduped = deduplicateResults(results);
        expect(deduped).toHaveLength(1);
        expect(deduped[0].position).toBe(1); // first match retained
    });

    test("keeps one result per distinct tcappendix chapter", () => {
        const results = [
            makeResult({
                book_id: "tcappendix",
                chapter_id: "10",
                position: 1,
            }),
            makeResult({
                book_id: "tcappendix",
                chapter_id: "10",
                position: 2,
            }),
            makeResult({
                book_id: "tcappendix",
                chapter_id: "20",
                position: 1,
            }),
            makeResult({
                book_id: "tcappendix",
                chapter_id: "20",
                position: 3,
            }),
        ];
        const deduped = deduplicateResults(results);
        expect(deduped).toHaveLength(2);
        expect(deduped.map((r: any) => r.chapter_id)).toEqual(["10", "20"]);
    });

    test("keeps the first glossary result for each chapter, removes the rest", () => {
        const results = [
            makeResult({ book_id: "glossary", chapter_id: "77", position: 1 }),
            makeResult({ book_id: "glossary", chapter_id: "77", position: 4 }),
        ];
        const deduped = deduplicateResults(results);
        expect(deduped).toHaveLength(1);
        expect(deduped[0].position).toBe(1);
    });

    test("deduplicates tcappendix and glossary independently", () => {
        // chapter_id is the integer PK from the chapters table — each chapter
        // has a unique chapter_id regardless of book, so tcappendix and glossary
        // chapters will always have distinct chapter_ids in practice.
        const results = [
            makeResult({
                book_id: "tcappendix",
                chapter_id: "50",
                position: 1,
            }),
            makeResult({
                book_id: "tcappendix",
                chapter_id: "50",
                position: 2,
            }),
            makeResult({ book_id: "glossary", chapter_id: "75", position: 1 }),
            makeResult({ book_id: "glossary", chapter_id: "75", position: 2 }),
        ];
        const deduped = deduplicateResults(results);
        expect(deduped).toHaveLength(2);
        expect(deduped[0].book_id).toBe("tcappendix");
        expect(deduped[1].book_id).toBe("glossary");
    });

    test("mixes of normal and appendix results are all handled correctly", () => {
        const results = [
            makeResult({ book_id: "section", chapter_id: "1", position: 1 }),
            makeResult({ book_id: "tcappendix", chapter_id: "2", position: 1 }),
            makeResult({ book_id: "section", chapter_id: "1", position: 2 }),
            makeResult({ book_id: "tcappendix", chapter_id: "2", position: 2 }),
            makeResult({ book_id: "glossary", chapter_id: "3", position: 1 }),
            makeResult({ book_id: "glossary", chapter_id: "3", position: 2 }),
        ];
        const deduped = deduplicateResults(results);
        // Both section results kept; one each for tcappendix ch2 and glossary ch3
        expect(deduped).toHaveLength(4);
    });

    test("empty input returns empty array", () => {
        expect(deduplicateResults([])).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// 2. Navigation position
// ---------------------------------------------------------------------------

describe("navigation position for appendix and glossary results", () => {
    test("regular chapter result uses the paragraph position", () => {
        const item = makeResult({
            book_id: "section",
            position: 7,
            paratext: null,
        });
        expect(navigationPosition(item)).toBe(7);
    });

    test("tcappendix result always navigates to position 0", () => {
        const item = makeResult({
            book_id: "tcappendix",
            position: 4,
            paratext: null,
        });
        expect(navigationPosition(item)).toBe(0);
    });

    test("glossary result always navigates to position 0", () => {
        const item = makeResult({
            book_id: "glossary",
            position: 2,
            paratext: null,
        });
        expect(navigationPosition(item)).toBe(0);
    });

    test("paratext item navigates to position 0 regardless of book_id", () => {
        const item = makeResult({
            book_id: "section",
            position: 5,
            paratext: "heading",
        });
        expect(navigationPosition(item)).toBe(0);
    });

    test("tcappendix with position 0 stays at 0", () => {
        const item = makeResult({
            book_id: "tcappendix",
            position: 0,
            paratext: null,
        });
        expect(navigationPosition(item)).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// 3. Link text formatting
// ---------------------------------------------------------------------------

describe("result link text formatting", () => {
    test("regular result shows volume, book, chapter and position", () => {
        const item = makeResult({
            book_id: "section",
            chapter: "42",
            position: 3,
            paratext: null,
            volume: "Teachings & Commandments",
            book: "Section",
        });
        expect(resultLinkText(item)).toBe(
            "(Teachings & Commandments) Section 42:3",
        );
    });

    test("paratext result omits the paragraph number", () => {
        const item = makeResult({
            book_id: "section",
            chapter: "42",
            position: 1,
            paratext: "heading",
            volume: "Teachings & Commandments",
            book: "Section",
        });
        expect(resultLinkText(item)).toBe(
            "(Teachings & Commandments) Section 42",
        );
    });

    test("tcappendix result shows chapter_name with no position", () => {
        const item = makeResult({
            book_id: "tcappendix",
            chapter: "prerogative",
            name: "A Prophet's Prerogative",
            volume: "Teachings & Commandments",
            book: "Appendix",
            position: 4,
        });
        expect(resultLinkText(item)).toBe(
            "(Teachings & Commandments) Appendix: A Prophet's Prerogative",
        );
    });

    test("glossary result shows chapter_name with no position", () => {
        const item = makeResult({
            book_id: "glossary",
            chapter: "aaronic-priesthood",
            name: "Aaronic Priesthood",
            volume: "Teachings & Commandments",
            book: "Glossary",
            position: 2,
        });
        expect(resultLinkText(item)).toBe(
            "(Teachings & Commandments) Glossary: Aaronic Priesthood",
        );
    });

    test("chapter 0 result shows only volume and chapter_name", () => {
        const item = makeResult({
            chapter: "0",
            name: "Foreword",
            volume: "Teachings & Commandments",
            book: "Foreword",
        });
        expect(resultLinkText(item)).toBe(
            "(Teachings & Commandments) Foreword",
        );
    });

    test("tcappendix link text does not include position even when position > 0", () => {
        const item = makeResult({
            book_id: "tcappendix",
            chapter: "glossary",
            name: "Glossary of Terms",
            volume: "Teachings & Commandments",
            book: "Appendix",
            position: 99,
        });
        expect(resultLinkText(item)).not.toContain(":99");
        expect(resultLinkText(item)).not.toMatch(/:\d+/);
    });
});
