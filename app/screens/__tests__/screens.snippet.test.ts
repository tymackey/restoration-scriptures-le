// Mock useDatabase so importing screens.tsx doesn't pull in expo-sqlite.
import { extractSnippet } from "../screens";

vi.mock("../../data/useDatabase", () => ({
    useDatabase: () => ({ getChapterText: vi.fn() }),
}));

describe("extractSnippet", () => {
    it("returns an empty string for empty html", () => {
        expect(extractSnippet("", 5)).toBe("");
    });

    it("strips HTML tags and collapses whitespace", () => {
        const html = "<p>Hello   <b>there</b>\n\nworld</p>";
        expect(extractSnippet(html, 0)).toBe("Hello there world");
    });

    it("decodes/removes entities like &nbsp;", () => {
        const html = "<p>a&nbsp;b&amp;c</p>";
        expect(extractSnippet(html, 0)).toBe("a b c");
    });

    it("starts from the chapter beginning when position is 0", () => {
        const html = '<p id="1">First para</p><p id="2">Second para</p>';
        expect(extractSnippet(html, 0)).toBe("First para Second para");
    });

    it("starts one paragraph before the given position (lead-in context)", () => {
        const html =
            '<p id="1">One</p><p id="2">Two</p><p id="3">Three</p><p id="4">Four</p>';
        // position 3 -> starts at id 2 (one before)
        expect(extractSnippet(html, 3)).toBe("Two Three Four");
    });

    it("starts at the paragraph itself when position is 1", () => {
        const html = '<p id="1">One</p><p id="2">Two</p>';
        expect(extractSnippet(html, 1)).toBe("One Two");
    });

    it("falls back to the chapter start when the position id is absent", () => {
        const html = '<p id="1">Only para</p>';
        expect(extractSnippet(html, 99)).toBe("Only para");
    });

    it("truncates very long text to 240 characters", () => {
        const long = "word ".repeat(200);
        const html = `<p id="1">${long}</p>`;
        expect(extractSnippet(html, 0).length).toBeLessThanOrEqual(240);
    });

    it("strips inline chapter/verse metadata markers", () => {
        const html =
            '<li id="1">LEChapter5Verse1 In the beginning</li><li id="2">Verse2 And the earth</li>';
        expect(extractSnippet(html, 0)).toBe("In the beginning And the earth");
    });

    it("strips LEVerse markers, VerseEnd, and pronoun markers", () => {
        const html = '<li id="1">LEVerse3 Hear O 2PP Israel VerseEnd</li>';
        expect(extractSnippet(html, 0)).toBe("Hear O Israel");
    });

    it("keeps drop-cap letters joined to the rest of the word", () => {
        const html =
            '<li id="1"><span class="dropcap">J</span>oseph Smith</li>';
        expect(extractSnippet(html, 0)).toBe("Joseph Smith");
    });

    it("keeps small-caps single-letter spans joined", () => {
        const html =
            '<li id="1"><span>J</span><span>OSEPH</span>&nbsp;<span>S</span><span>MITH</span> warned</li>';
        expect(extractSnippet(html, 0)).toBe("JOSEPH SMITH warned");
    });

    it("still separates words across block boundaries", () => {
        const html = '<li id="1">the whole world.</li><li id="2">For God</li>';
        expect(extractSnippet(html, 0)).toBe("the whole world. For God");
    });

    it("preserves legitimate single-letter words", () => {
        const html = '<li id="1">I thank God, O my soul, for a word</li>';
        expect(extractSnippet(html, 0)).toBe(
            "I thank God, O my soul, for a word",
        );
    });
});
