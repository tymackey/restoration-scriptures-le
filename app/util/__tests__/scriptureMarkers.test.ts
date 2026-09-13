import {
    stripScriptureMarkers,
    markerRegExp,
    MARKER_PATTERNS,
} from "../scriptureMarkers";

describe("stripScriptureMarkers", () => {
    it("removes LEChapter markers", () => {
        expect(stripScriptureMarkers("LEChapter5 text").trim()).toBe("text");
    });

    it("removes Verse and VerseEnd markers", () => {
        expect(
            stripScriptureMarkers("Verse2 the earth VerseEnd")
                .replace(/\s+/g, " ")
                .trim(),
        ).toBe("the earth");
    });

    it("removes LEVerse markers", () => {
        expect(stripScriptureMarkers("LEVerse3 hear").trim()).toBe("hear");
    });

    it("removes second-person pronoun markers", () => {
        expect(
            stripScriptureMarkers("O 2PP Israel").replace(/\s+/g, " ").trim(),
        ).toBe("O Israel");
    });

    it("removes several marker kinds in one pass", () => {
        const input = "LEChapter5Verse1 In the 2PSI beginning VerseEnd";
        expect(stripScriptureMarkers(input).replace(/\s+/g, " ").trim()).toBe(
            "In the beginning",
        );
    });

    it("leaves marker-free text untouched", () => {
        expect(stripScriptureMarkers("Plain scripture text")).toBe(
            "Plain scripture text",
        );
    });
});

describe("markerRegExp", () => {
    it("builds a fresh RegExp from a marker source with flags", () => {
        const re = markerRegExp("verse", "g");
        expect(re.source).toBe(MARKER_PATTERNS.verse);
        expect(re.flags).toBe("g");
    });

    it("returns a new instance each call (no shared lastIndex)", () => {
        expect(markerRegExp("pronoun", "g")).not.toBe(
            markerRegExp("pronoun", "g"),
        );
    });
});
