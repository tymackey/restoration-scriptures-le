/**
 * Tests for HtmlProcessor search highlighting.
 *
 * Covers: basic word matching, multi-word unquoted search, single-letter word
 * filtering, full-phrase match (including single-letter words within the phrase),
 * quoted phrase search, HTML attribute safety, and edge cases.
 */

import { vi } from "vitest";

import * as cheerio from "cheerio";
import { HtmlProcessor } from "../HtmlProcessor";

// Mock heavy/native dependencies not relevant to highlighting logic
vi.mock("../FontLoader", () => ({ getFontFaceCss: async () => "" }));
vi.mock("../../styles/webviewStyles.js", () => ({ default: "" }));
vi.mock("../ImageUtils", () => ({
    generateImageReplacementScript: () => "",
    preloadImagesFromHTML: async () => ({}),
}));
vi.mock("../ScrollTracker", () => ({
    ScrollTracker: { generateScrollTrackingScript: () => "" },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Run processHtml with the given paragraph content and search term.
 * Returns a cheerio root scoped to the full output document.
 */
async function process(
    bodyContent: string,
    searchTerm: string,
): Promise<cheerio.CheerioAPI> {
    const html = `<p>${bodyContent}</p>`;
    const result = await HtmlProcessor.processHtml(
        html,
        true,
        undefined,
        searchTerm,
    );
    return cheerio.load(result);
}

/** Return the text content of every search-highlight span in the document. */
function highlights($: cheerio.CheerioAPI): string[] {
    const spans: string[] = [];
    $("span.search-highlight").each((_, el) => {
        spans.push($(el).text());
    });
    return spans;
}

// ---------------------------------------------------------------------------
// 1. Basic word matching
// ---------------------------------------------------------------------------

describe("basic word matching", () => {
    test("highlights a matching word", async () => {
        const $ = await process("The quick brown fox", "fox");
        expect(highlights($)).toEqual(["fox"]);
    });

    test("matching is case-insensitive", async () => {
        const $ = await process("The Quick Brown Fox", "quick");
        expect(highlights($)).toEqual(["Quick"]);
    });

    test("highlights all occurrences", async () => {
        const $ = await process(
            "faith without works is dead, but faith endures",
            "faith",
        );
        expect(highlights($)).toEqual(["faith", "faith"]);
    });

    test("highlights within word variants (no word boundary for unquoted words)", async () => {
        // Porter stemming means "love" matches "loved", "lovely", etc.
        // Our highlighting should match within words too.
        const $ = await process("love is found in lovely deeds", "love");
        const h = highlights($);
        expect(h.some((s) => s === "love")).toBe(true);
        expect(h.some((s) => s.includes("love"))).toBe(true); // also in "lovely"
    });

    test("produces no highlights when nothing matches", async () => {
        const $ = await process("The quick brown fox", "elephant");
        expect(highlights($)).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// 2. Empty / trivial search term
// ---------------------------------------------------------------------------

describe("empty search term", () => {
    test("produces no highlights for empty string", async () => {
        const $ = await process("The quick brown fox", "");
        expect(highlights($)).toEqual([]);
    });

    test("produces no highlights for whitespace-only term", async () => {
        const $ = await process("The quick brown fox", "   ");
        expect(highlights($)).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// 3. Multi-word unquoted search — individual word highlighting
// ---------------------------------------------------------------------------

describe("multi-word unquoted search", () => {
    test("highlights each multi-letter word independently", async () => {
        const $ = await process(
            "the offender was punished for word crimes",
            "offender word",
        );
        const h = highlights($);
        expect(h).toContain("offender");
        expect(h).toContain("word");
    });

    test("does not highlight single-letter words independently", async () => {
        // "a" appears standalone but is not part of the full phrase here
        const $ = await process(
            "he said a prayer and waited",
            "offender for a word",
        );
        expect(highlights($)).not.toContain("a");
    });

    test("does not produce any single-character highlights", async () => {
        const $ = await process(
            "he is an offender for a word and a half",
            "offender for a word",
        );
        const singleChar = highlights($).filter((h) => h.trim().length === 1);
        expect(singleChar).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// 4. Full-phrase match including single-letter words
// ---------------------------------------------------------------------------

describe("full-phrase highlight when phrase appears verbatim", () => {
    test("highlights the full phrase as a unit when it appears in the text", async () => {
        const $ = await process(
            "he is an offender for a word spoken in haste",
            "offender for a word",
        );
        expect(highlights($)).toContain("offender for a word");
    });

    test("the single-letter word within the matched phrase is part of the highlight", async () => {
        // "a" is inside the highlighted span, not a separate span
        const result = await HtmlProcessor.processHtml(
            "<p>he is an offender for a word</p>",
            true,
            undefined,
            "offender for a word",
        );
        const $ = cheerio.load(result);
        const h = highlights($);
        expect(h.some((s) => s.includes(" a "))).toBe(true); // 'a' is part of the phrase span
    });

    test("highlights phrase occurrence AND individual-word occurrences elsewhere", async () => {
        const $ = await process(
            "offender for a word. The offender faced judgment.",
            "offender for a word",
        );
        const h = highlights($);
        expect(h).toContain("offender for a word"); // full phrase
        expect(h).toContain("offender"); // standalone second occurrence
    });

    test("standalone single-letter words outside the phrase are not highlighted", async () => {
        const $ = await process(
            "offender for a word and a half",
            "offender for a word",
        );
        // "a half" — the "a" there must not be highlighted
        const h = highlights($);
        const singleChar = h.filter((s) => s.trim().length === 1);
        expect(singleChar).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// 5. Quoted phrase search
// ---------------------------------------------------------------------------

describe("quoted phrase search", () => {
    test("highlights the exact quoted phrase", async () => {
        const $ = await process(
            "he is an offender for a word",
            '"offender for a word"',
        );
        expect(highlights($)).toContain("offender for a word");
    });

    test("respects word boundaries — does not match inside longer words", async () => {
        const $ = await process("passage through the pass", '"pass"');
        const h = highlights($);
        expect(h).toContain("pass");
        expect(h).not.toContain("passage");
    });

    test("single-letter words in quoted phrase ARE highlighted", async () => {
        // Quoted search overrides the single-letter filter entirely
        const $ = await process(
            "he is an offender for a word",
            '"offender for a word"',
        );
        const combinedText = highlights($).join(" ");
        expect(combinedText).toContain(" a ");
    });

    test("supports iOS smart/curly quotes (\u201C\u201D)", async () => {
        const $ = await process(
            "he is an offender for a word",
            "\u201Coffender for a word\u201D",
        );
        expect(highlights($)).toContain("offender for a word");
    });

    test("supports straight single quotes", async () => {
        const $ = await process("glory and honor", "'glory'");
        expect(highlights($)).toContain("glory");
    });

    test("no highlights when quoted phrase is not present", async () => {
        const $ = await process("he was righteous", '"offender for a word"');
        expect(highlights($)).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// 6. HTML attribute safety (regression: searching for short words corrupted HTML)
// ---------------------------------------------------------------------------

describe("HTML attribute safety", () => {
    test('searching for "a" does not corrupt HTML attribute text', async () => {
        const result = await HtmlProcessor.processHtml(
            "<p>before them after</p>",
            true,
            undefined,
            "offender for a word",
        );
        const $ = cheerio.load(result);
        const textContent = $("body").text();
        // None of these substrings should appear as rendered text
        expect(textContent).not.toContain("class=");
        expect(textContent).not.toContain("style=");
        expect(textContent).not.toContain("rgba");
        expect(textContent).not.toContain("border-radius");
        expect(textContent).not.toContain("search-highlight");
    });

    test('searching for "a" does not produce highlight spans inside HTML tags', async () => {
        const result = await HtmlProcessor.processHtml(
            "<p>a man walked away</p>",
            true,
            undefined,
            "a",
        );
        const $ = cheerio.load(result);
        // The output HTML must be parseable and all highlight spans must
        // contain only expected text — not CSS attribute fragments
        $("span.search-highlight").each((_, el) => {
            const t = $(el).text();
            expect(t).not.toMatch(/class=|style=|rgba|border/);
        });
    });

    test("highlight spans are not nested (no double-wrapping)", async () => {
        const result = await HtmlProcessor.processHtml(
            "<p>offender for a word</p>",
            true,
            undefined,
            "offender for a word",
        );
        const $ = cheerio.load(result);
        const nested = $("span.search-highlight span.search-highlight");
        expect(nested.length).toBe(0);
    });

    test("highlight spans do not appear inside existing element attributes", async () => {
        // Input with an anchor — the href value must not be mutated
        const result = await HtmlProcessor.processHtml(
            '<p>see <a href="/ref/grace">grace and peace</a> here</p>',
            true,
            undefined,
            "grace",
        );
        const $ = cheerio.load(result);
        // href should be unchanged
        const href = $("a").attr("href");
        expect(href).toBe("/ref/grace");
        // The word "grace" inside the anchor text should still be highlighted
        expect(highlights($)).toContain("grace");
    });
});

// ---------------------------------------------------------------------------
// 7. Edge cases
// ---------------------------------------------------------------------------

describe("edge cases", () => {
    test("handles regex special characters in search term without throwing", async () => {
        const $ = await process("he said (hello) to her", "(hello)");
        // Should not throw; may or may not match depending on escaping
        expect(() => highlights($)).not.toThrow();
    });

    test("regex special characters in search term are escaped, not treated as regex", async () => {
        // "." would match any char if unescaped — it should only match a literal dot
        const $ = await process("end of verse 1.2 and 1x2", "1.2");
        const h = highlights($);
        expect(h).toContain("1.2");
        expect(h).not.toContain("1x2"); // "." must not match 'x'
    });

    test("multiple distinct words are all highlighted", async () => {
        const $ = await process(
            "righteousness and mercy and grace abound",
            "righteousness grace",
        );
        const h = highlights($);
        expect(h).toContain("righteousness");
        expect(h).toContain("grace");
    });

    test("overlapping term ranges do not produce malformed output", async () => {
        // "for" is contained within "afford" — ensure no double highlight
        const result = await HtmlProcessor.processHtml(
            "<p>they could not afford to wait</p>",
            true,
            undefined,
            "afford for",
        );
        const $ = cheerio.load(result);
        // Must parse cleanly with no nested highlight spans
        expect($("span.search-highlight span.search-highlight").length).toBe(0);
    });

    test("does not highlight across element boundaries", async () => {
        // Each <p> is processed independently; a phrase split across two
        // paragraphs should not be highlighted
        const result = await HtmlProcessor.processHtml(
            "<p>offender for</p><p>a word here</p>",
            true,
            undefined,
            "offender for a word",
        );
        const $ = cheerio.load(result);
        // No span should span across both paragraphs
        expect(highlights($)).not.toContain("offender for a word");
    });
});

// ---------------------------------------------------------------------------
// 8. addParagraphIds — paragraph-ID assignment for <p>-based chapters
//    (T&C Appendix / Glossary fix)
// ---------------------------------------------------------------------------

/**
 * Run processHtml with arbitrary HTML and return a cheerio root of the result.
 * Unlike the `process` helper above this does NOT wrap the input in a <p>.
 */
async function processRaw(
    html: string,
    volume_id?: string,
): Promise<cheerio.CheerioAPI> {
    const result = await HtmlProcessor.processHtml(html, true, volume_id);
    return cheerio.load(result);
}

describe("addParagraphIds — <p>-only chapters (T&C Glossary/Appendix)", () => {
    test('single <p> element receives id="1"', async () => {
        const $ = await processRaw("<p>Aaronic Priesthood content.</p>");
        // <p> is converted to <div> by the tag-name mutation step
        expect($("div#1").length).toBe(1);
        expect($("div#1").text()).toContain("Aaronic Priesthood content.");
    });

    test("multiple <p> elements receive sequential ids starting at 1", async () => {
        const $ = await processRaw(
            "<p>First paragraph.</p>" +
                "<p>Second paragraph.</p>" +
                "<p>Third paragraph.</p>",
        );
        expect($("div#1").text()).toContain("First paragraph.");
        expect($("div#2").text()).toContain("Second paragraph.");
        expect($("div#3").text()).toContain("Third paragraph.");
    });

    test("footnote <p> elements inside .footnotes also receive sequential ids", async () => {
        const $ = await processRaw(
            '<ol class="simple-text">' +
                '  <h3 class="chap">Abomination</h3>' +
                "  <p>Main content.<sup>1</sup></p>" +
                '  <div class="footnotes">' +
                "    <p><sup>1</sup> A reference.</p>" +
                "    <p><sup>2</sup> Another reference.</p>" +
                "  </div>" +
                "</ol>",
        );
        // Position 1 = main body paragraph
        expect($("div#1").text()).toContain("Main content.");
        // Positions 2 and 3 = footnote paragraphs
        expect($("div#2").text()).toContain("A reference.");
        expect($("div#3").text()).toContain("Another reference.");
    });

    test("all <p> elements are converted to <div> with their ids intact", async () => {
        const $ = await processRaw("<p>Alpha.</p><p>Beta.</p>");
        // No <p> elements should remain after processing
        expect($("p").length).toBe(0);
        // Both should now be <div> elements with numeric ids
        expect($("div#1").length).toBe(1);
        expect($("div#2").length).toBe(1);
    });

    test('<p class="glossary-entry"> is also converted to <div> with an id', async () => {
        const $ = await processRaw(
            '<p class="glossary-entry"><b>Term</b> definition text.</p>',
        );
        expect($("p").length).toBe(0);
        // Should be a div (class preserved but tag changed) with id="1"
        expect($("div#1").length).toBe(1);
        expect($("div#1").text()).toContain("Term");
        // Bold tag inside must survive the conversion
        expect($("div#1 b").length).toBe(1);
    });

    test("<p> elements with other classes get ids assigned", async () => {
        const $ = await processRaw(
            '<p class="centered"><i>A psalm of attribution.</i></p>' +
                "<p>Main body text.</p>",
        );
        expect($("div#1").length).toBe(1);
        expect($("div#2").length).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// 9. styleCCVerses — verse marker styling preserves inline formatting
//    (regression: italic headings were flattened, e.g. before 2 Nephi 8:4)
// ---------------------------------------------------------------------------

describe("styleCCVerses — inline formatting survives verse styling", () => {
    test("italic heading inside a verse-bearing paragraph is preserved", async () => {
        // Mirrors the raw source before 2 Nephi 8:4 in the bundled DB.
        const $ = await processRaw(
            "<p>LEChapter12 Verse1 <i>The word that Isaiah the son of Amoz " +
                "saw concerning Judah and Jerusalem. VerseEnd</i></p>",
        );
        // The <i> tag must survive
        expect($("i").length).toBe(1);
        expect($("i").text()).toContain("The word that Isaiah");
        // VerseEnd marker must be gone from rendered text
        expect($("body").text()).not.toContain("VerseEnd");
        // Verse1 marker must be gone (rendered as an empty sup, number hidden)
        expect($("body").text()).not.toContain("Verse1");
        // LEChapter marker becomes the chapter span
        expect($("span.le-chapter").text()).toBe("12");
    });

    test("bold text inside a verse-bearing element is preserved", async () => {
        const $ = await processRaw(
            '<ol class="simple-text">' +
                '<li id="1">Verse2 And he said, <b>Behold</b>, I come. VerseEnd</li>' +
                "</ol>",
        );
        expect($("b").text()).toBe("Behold");
        expect($("body").text()).not.toContain("VerseEnd");
        expect($("body").text()).not.toContain("Verse2");
    });

    test("verse number and following plain word stay together in a nowrap span", async () => {
        const $ = await processRaw(
            '<ol class="simple-text">' +
                '<li id="1">Verse5 And it came to pass. VerseEnd</li>' +
                "</ol>",
        );
        const nowrap = $('span[style*="nowrap"]');
        expect(nowrap.length).toBe(1);
        expect(nowrap.find("sup.le-verse").text()).toBe("5");
        expect(nowrap.text()).toContain("And");
    });

    test("verse marker immediately followed by an inline tag still renders its number", async () => {
        const $ = await processRaw(
            '<ol class="simple-text">' +
                '<li id="1">Verse7 <i>italic opening word</i> rest. VerseEnd</li>' +
                "</ol>",
        );
        // Number is rendered
        expect($("sup.le-verse").text()).toContain("7");
        // The italic tag is preserved
        expect($("i").text()).toBe("italic opening word");
        // No raw marker leaks through
        expect($("body").text()).not.toContain("Verse7");
    });
});

describe("paragraph bottom spacing — p-block class on converted paragraphs", () => {
    test("a plain paragraph becomes a div carrying the p-block class", async () => {
        const $ = await processRaw("<p>Some paragraph text.</p>");
        expect($("div.p-block").length).toBe(1);
        expect($("div.p-block").text()).toContain("Some paragraph text.");
    });

    test("an id-less heading paragraph between verses still gets p-block spacing", async () => {
        // Mirrors 2 Nephi 8: an italic <p> heading sandwiched between <li> verses.
        // addParagraphIds bails (because <li id> exist), so the heading div has no
        // id — the p-block class is what gives it bottom spacing before the verse.
        const $ = await processRaw(
            '<ol class="simple-text">' +
                '<li id="3">Prior verse. VerseEnd</li>' +
                "<p>LEChapter12 Verse1 <i>The word that Isaiah saw. VerseEnd</i></p>" +
                '<li id="4">Verse2 And it shall come to pass. VerseEnd</li>' +
                "</ol>",
        );
        const heading = $("div.p-block");
        expect(heading.length).toBe(1);
        expect(heading.attr("id")).toBeUndefined();
        expect(heading.find("i").text()).toContain("The word that Isaiah");
    });

    test("existing class on a paragraph is preserved alongside p-block", async () => {
        const $ = await processRaw(
            '<p class="centered"><i>A psalm of attribution.</i></p>',
        );
        const div = $("div.centered");
        expect(div.length).toBe(1);
        expect(div.hasClass("p-block")).toBe(true);
    });
});

describe("addParagraphIds — standard verse-list chapters are unaffected", () => {
    test('does NOT add numeric ids to <p> elements when <li id="N"> elements are present', async () => {
        const $ = await processRaw(
            '<ol class="simple-text">' +
                '  <p class="centered"><i>A psalm of David.</i></p>' +
                '  <li id="1">Verse one text.</li>' +
                '  <li id="2">Verse two text.</li>' +
                "</ol>",
        );
        // The <li> ids must be unchanged
        expect($("li#1").text()).toContain("Verse one text.");
        expect($("li#2").text()).toContain("Verse two text.");
        // The <p class="centered"> must NOT have received id="1" (which would
        // collide with <li id="1"> and break getElementById-based highlight lookup)
        const centeredDiv = $("div").filter((_, el) => {
            return (
                $(el).text().includes("A psalm of David") && !$(el).attr("id")
            );
        });
        expect(centeredDiv.length).toBe(1);
    });

    test('<li id="N"> elements keep their original numeric ids', async () => {
        const $ = await processRaw(
            '<ol class="simple-text">' +
                '  <li id="1">First verse.</li>' +
                '  <li id="2">Second verse.</li>' +
                '  <li id="3">Third verse.</li>' +
                "</ol>",
        );
        expect($("li#1").text()).toContain("First verse.");
        expect($("li#2").text()).toContain("Second verse.");
        expect($("li#3").text()).toContain("Third verse.");
    });

    test('no duplicate ids are created when <li id="N"> elements are present', async () => {
        const $ = await processRaw(
            '<ol class="simple-text">' +
                '  <p class="centered">Intro.</p>' +
                '  <li id="1">Verse one.</li>' +
                "</ol>",
        );
        // There must be at most one element with id="1"
        expect($("#1").length).toBe(1);
        expect($("li#1").length).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// Scripture reference linking
// ---------------------------------------------------------------------------

const REFERENCE_BOOK_NAMES = [
    "genesis",
    "gen",
    "john",
    "1 john",
    "jacob",
    "mosiah",
    "mark",
    "hebrews",
    "heb",
    "isaiah",
    "isa",
    "alma",
    "psalm",
    "section",
    "jsh",
    "2 nephi",
    "3 nephi",
    "teachings and commandments",
    "t&c",
    "revelation",
    "tsj",
    "moroni",
];

/** Reference text is glued with non-breaking spaces; normalize for comparison. */
function refText(a: cheerio.Cheerio<any>): string {
    return a.text().replace(/ /g, " ");
}

async function processRefs(bodyContent: string): Promise<cheerio.CheerioAPI> {
    const result = await HtmlProcessor.processHtml(
        `<p>${bodyContent}</p>`,
        true,
        undefined,
        undefined,
        REFERENCE_BOOK_NAMES,
    );
    return cheerio.load(result);
}

describe("scripture reference linking", () => {
    test("links a basic Book chapter:paragraph reference", async () => {
        const $ = await processRefs("As found in Genesis 4:14, the account...");
        const a = $("a.scripture-ref");
        expect(a.length).toBe(1);
        expect(refText(a)).toBe("Genesis 4:14");
        expect(a.attr("href")).toBe("reref://genesis/4/14/");
    });

    test("carries the CE edition suffix into the href", async () => {
        const $ = await processRefs("(2 Nephi 11:8 CE) says that...");
        const a = $("a.scripture-ref");
        expect(refText(a)).toBe("2 Nephi 11:8 CE");
        expect(a.attr("href")).toBe("reref://2%20nephi/11/8/CE");
    });

    test("resolves the T&C abbreviation and keeps the ampersand as text", async () => {
        const $ = await processRefs("as directed (T&C 82:20). Thus...");
        const a = $("a.scripture-ref");
        expect(refText(a)).toBe("T&C 82:20");
        expect(a.attr("href")).toBe("reref://t%26c/82/20/");
    });

    test("links the full Teachings and Commandments name", async () => {
        const $ = await processRefs(
            "see Teachings and Commandments 105:13 for more",
        );
        const a = $("a.scripture-ref");
        expect(a.attr("href")).toBe(
            "reref://teachings%20and%20commandments/105/13/",
        );
    });

    test("links a standalone bracketed reference", async () => {
        const $ = await processRefs("the fifth chapter of John [John 5:5]");
        const a = $("a.scripture-ref");
        expect(a.length).toBe(1);
        expect(refText(a)).toBe("John 5:5");
        expect(a.attr("href")).toBe("reref://john/5/5/");
    });

    test("T&C 110 exception: links a KJV ref followed by its bracketed RE ref to the RE target", async () => {
        const $ = await processRefs(
            "as it is written, Mark 16:16 [Mark 8:6], and whoso believeth...",
        );
        const a = $("a.scripture-ref");
        expect(a.length).toBe(1);
        expect(refText(a)).toBe("Mark 16:16 [Mark 8:6]");
        // Target is the bracketed RE reference, not the KJV chapter:verse.
        expect(a.attr("href")).toBe("reref://mark/8/6/");
    });

    test("T&C 110 exception: tolerates a period between the KJV ref and the bracket", async () => {
        const $ = await processRefs(
            "he that believes and is baptized shall be saved. Mark 16:16. [Mark 8:6]",
        );
        const a = $("a.scripture-ref");
        expect(a.length).toBe(1);
        expect(refText(a)).toBe("Mark 16:16. [Mark 8:6]");
        expect(a.attr("href")).toBe("reref://mark/8/6/");
    });

    test("T&C 110 exception: resolves an abbreviated bracketed book (Heb.)", async () => {
        const $ = await processRefs(
            "it is impossible to please God. Hebrews 11:6 [Heb. 1:38]: without faith...",
        );
        const a = $("a.scripture-ref");
        expect(a.length).toBe(1);
        expect(refText(a)).toBe("Hebrews 11:6 [Heb. 1:38]");
        expect(a.attr("href")).toBe("reref://heb/1/38/");
    });

    test("T&C 110 exception: tolerates a comma between the book name and chapter:verse", async () => {
        const $ = await processRefs(
            "Thus says the author of the epistle to the Hebrews, 11:3 [Heb. 1:36]: through faith...",
        );
        const a = $("a.scripture-ref");
        expect(a.length).toBe(1);
        expect(refText(a)).toBe("Hebrews, 11:3 [Heb. 1:36]");
        expect(a.attr("href")).toBe("reref://heb/1/36/");
    });

    test("T&C 110 exception: bracketed ref can name a different book than the KJV ref", async () => {
        const $ = await processRefs(
            "let no man deceive you. John 3:7 [1 John 1:14]: little children...",
        );
        const a = $("a.scripture-ref");
        expect(a.length).toBe(1);
        expect(refText(a)).toBe("John 3:7 [1 John 1:14]");
        expect(a.attr("href")).toBe("reref://1%20john/1/14/");
    });

    test("does not link unknown books", async () => {
        const $ = await processRefs("Nowhere 3:16 is not a known book");
        expect($("a.scripture-ref").length).toBe(0);
    });

    test("links multiple references in one paragraph", async () => {
        const $ = await processRefs("Compare Genesis 4:14 with Mosiah 1:16.");
        const hrefs = $("a.scripture-ref")
            .map((_, el) => $(el).attr("href"))
            .get();
        expect(hrefs).toEqual([
            "reref://genesis/4/14/",
            "reref://mosiah/1/16/",
        ]);
    });

    test("is a no-op when no book names are supplied", async () => {
        const $ = await processRaw("As found in Genesis 4:14, the account...");
        expect($("a.scripture-ref").length).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Quoted blog-post titles — glossary footnotes cite blog posts whose titles
// are themselves chapter:verse strings (see "Abominable/Abomination"), so a
// reference tightly wrapped in quotation marks is a title, not a citation.
// ---------------------------------------------------------------------------

describe("quoted reference-shaped titles", () => {
    test("does not link a reference used as a quoted blog-post title", async () => {
        const $ = await processRefs(
            "“1 Nephi 13: 31–32,” June 29, 2010, blog post.",
        );
        expect($("a.scripture-ref").length).toBe(0);
    });

    test("does not link when the closing quote follows a period instead of a comma", async () => {
        const $ = await processRefs("“Alma 13:17–18.” June 15, 2010.");
        expect($("a.scripture-ref").length).toBe(0);
    });

    test("does not link a straight-quoted title", async () => {
        const $ = await processRefs('"Alma 13:17-18," June 15, 2010.');
        expect($("a.scripture-ref").length).toBe(0);
    });

    test("still links a reference that merely appears inside a longer quoted sentence", async () => {
        const $ = await processRefs(
            "He said, “as it is written in Genesis 4:14, so it shall be.”",
        );
        const a = $("a.scripture-ref");
        expect(a.length).toBe(1);
        expect(refText(a)).toBe("Genesis 4:14");
    });
});

// ---------------------------------------------------------------------------
// Chapter-only references — only trusted inside a citation aside
// ---------------------------------------------------------------------------

describe("chapter-only references", () => {
    test("links a chapter-only reference inside square brackets", async () => {
        const $ = await processRefs("a chiastic structure [Alma 17]");
        const a = $("a.scripture-ref");
        expect(refText(a)).toBe("Alma 17");
        expect(a.attr("href")).toBe("reref://alma/17//");
    });

    test("links a chapter-only reference in a (see ...) aside", async () => {
        const $ = await processRefs("the canonization process (see T&C 158)");
        const a = $("a.scripture-ref");
        expect(refText(a)).toBe("T&C 158");
        expect(a.attr("href")).toBe("reref://t%26c/158//");
    });

    test("carries an edition suffix on a bracketed chapter-only reference", async () => {
        const $ = await processRefs("the last days [Isaiah 16 RE]");
        const a = $("a.scripture-ref");
        expect(refText(a)).toBe("Isaiah 16 RE");
        expect(a.attr("href")).toBe("reref://isaiah/16//RE");
    });

    test("links a chapter range in a (see ...) aside", async () => {
        const $ = await processRefs("as covenanted (see T&C 156–174)");
        const a = $("a.scripture-ref");
        expect(refText(a)).toBe("T&C 156–174");
        expect(a.attr("href")).toBe("reref://t%26c/156//");
    });

    test("resolves a bracketed 'See also Section N' cross-reference", async () => {
        const $ = await processRefs("[See also Section 2]");
        const a = $("a.scripture-ref");
        expect(refText(a)).toBe("Section 2");
        expect(a.attr("href")).toBe("reref://section/2//");
    });

    test("does NOT link a bare chapter-only reference in running prose", async () => {
        const $ = await processRefs(
            "Psalm 23 is well known, and Section 130 of the LDS Doctrine and Covenants is not.",
        );
        expect($("a.scripture-ref").length).toBe(0);
    });

    test("does NOT link a chapter-only reference in a non-citation parenthetical", async () => {
        const $ = await processRefs("he wrote it down (Alma 17 was cited)");
        expect($("a.scripture-ref").length).toBe(0);
    });

    test("still links the chapter:paragraph form outside any aside", async () => {
        const $ = await processRefs("Psalm 23:1 is well known");
        expect($("a.scripture-ref").attr("href")).toBe("reref://psalm/23/1/");
    });
});

// ---------------------------------------------------------------------------
// Punctuation and spacing tolerance
// ---------------------------------------------------------------------------

describe("reference punctuation tolerance", () => {
    test("matches an abbreviation with no space before the chapter", async () => {
        const $ = await processRefs("in the beginning [Gen.2:17–19]");
        const a = $("a.scripture-ref");
        expect(refText(a)).toBe("Gen.2:17–19");
        expect(a.attr("href")).toBe("reref://gen/2/17/");
    });

    test("tolerates a space after the colon", async () => {
        const $ = await processRefs("as written [Isa. 18: 7–8]");
        const a = $("a.scripture-ref");
        expect(refText(a)).toBe("Isa. 18: 7–8");
        expect(a.attr("href")).toBe("reref://isa/18/7/");
    });

    test("keeps a comma-separated paragraph list in one anchor", async () => {
        const $ = await processRefs("compare 2 Nephi 1:10, 22 CE for this");
        const a = $("a.scripture-ref");
        expect(a.length).toBe(1);
        expect(refText(a)).toBe("2 Nephi 1:10, 22 CE");
        expect(a.attr("href")).toBe("reref://2%20nephi/1/10/CE");
    });

    test("links each reference of a semicolon-separated list separately", async () => {
        const $ = await processRefs("(see Mark 3; 3 Nephi 5:6)");
        const hrefs = $("a.scripture-ref")
            .map((_, el) => $(el).attr("href"))
            .get();
        expect(hrefs).toEqual(["reref://mark/3//", "reref://3%20nephi/5/6/"]);
    });

    test("links a bare chapter:paragraph shorthand for the same book", async () => {
        const $ = await processRefs(
            "he accuses others and opposes the Father (see Revelation 4:4; 8:6). Satan's accusations...",
        );
        const a = $("a.scripture-ref");
        expect(a.length).toBe(2);
        expect(refText(a.eq(0))).toBe("Revelation 4:4");
        expect(a.eq(0).attr("href")).toBe("reref://revelation/4/4/");
        expect(refText(a.eq(1))).toBe("8:6");
        expect(a.eq(1).attr("href")).toBe("reref://revelation/8/6/");
    });

    test("links a chained shorthand list of more than two chapters", async () => {
        const $ = await processRefs("as taught (see TSJ 5:19; 6:16; 9:3–4)");
        const hrefs = $("a.scripture-ref")
            .map((_, el) => $(el).attr("href"))
            .get();
        expect(hrefs).toEqual([
            "reref://tsj/5/19/",
            "reref://tsj/6/16/",
            "reref://tsj/9/3/",
        ]);
    });

    test("links an 'and'-joined chapter:paragraph shorthand for the same book", async () => {
        const $ = await processRefs("(Moroni 4:1 and 5:1 CE)");
        const a = $("a.scripture-ref");
        expect(a.length).toBe(2);
        expect(refText(a.eq(0))).toBe("Moroni 4:1");
        expect(a.eq(0).attr("href")).toBe("reref://moroni/4/1/");
        expect(refText(a.eq(1))).toBe("5:1 CE");
        expect(a.eq(1).attr("href")).toBe("reref://moroni/5/1/CE");
    });

    test("does not treat a comma verse list as a chapter shorthand chain", async () => {
        const $ = await processRefs("compare 2 Nephi 1:10, 22 CE for this");
        const a = $("a.scripture-ref");
        expect(a.length).toBe(1);
        expect(refText(a)).toBe("2 Nephi 1:10, 22 CE");
    });
});

// ---------------------------------------------------------------------------
// References split across inline markup
// ---------------------------------------------------------------------------

describe("references spanning inline markup", () => {
    test("links a reference whose bracket opens with an italic 'see'", async () => {
        const $ = await processRefs("as taught [<i>see</i> T&C 9:5]");
        const a = $("a.scripture-ref");
        expect(a.length).toBe(1);
        expect(refText(a)).toBe("T&C 9:5");
        expect(a.attr("href")).toBe("reref://t%26c/9/5/");
    });

    test("links a reference in an italicised header", async () => {
        const $ = await processRefs(
            "<i>Thus says the prophet, Hebrews 11:3 [Heb. 1:36]</i>",
        );
        const a = $("a.scripture-ref");
        expect(a.length).toBe(1);
        expect(refText(a)).toBe("Hebrews 11:3 [Heb. 1:36]");
        expect(a.attr("href")).toBe("reref://heb/1/36/");
    });

    test("links a reference whose book name sits in its own element", async () => {
        const $ = await processRefs(
            '[See also <span class="SMALL-CAPS">jsh</span> 13:21–23.]',
        );
        // The reference straddles two text nodes, so each covered node gets its
        // own anchor — both pointing at the same target.
        const hrefs = $("a.scripture-ref")
            .map((_, el) => $(el).attr("href"))
            .get();
        expect(hrefs.length).toBeGreaterThan(0);
        expect(new Set(hrefs)).toEqual(new Set(["reref://jsh/13/21/"]));
        expect(
            $("a.scripture-ref")
                .map((_, el) => refText($(el)))
                .get()
                .join(""),
        ).toBe("jsh 13:21–23");
    });

    test("does not descend into existing links or highlights", async () => {
        const $ = await processRefs(
            '<a href="x">Genesis 4:14</a> and <span class="user-highlight">Mosiah 1:16</span>',
        );
        expect($("a.scripture-ref").length).toBe(0);
    });
});
