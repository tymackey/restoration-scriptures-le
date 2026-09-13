import { describe, expect, test } from "vitest";
import { buildScriptureLink, parseScriptureLink } from "../scriptureLink";

describe("parseScriptureLink", () => {
    test("parses the canonical form with .paragraph#paragraph", () => {
        expect(
            parseScriptureLink(
                "https://scriptures.info/scriptures/cc/ether/1.2#2",
            ),
        ).toEqual({ volume: "cc", book: "ether", chapter: "1", paragraph: 2 });
    });

    test("parses a chapter with no paragraph", () => {
        expect(
            parseScriptureLink(
                "https://scriptures.info/scriptures/oc/genesis/4",
            ),
        ).toEqual({
            volume: "oc",
            book: "genesis",
            chapter: "4",
            paragraph: 0,
        });
    });

    test("fragment wins over the path paragraph", () => {
        expect(
            parseScriptureLink(
                "https://scriptures.info/scriptures/bofm/alma/5.10#14",
            )?.paragraph,
        ).toBe(14);
    });

    test("accepts .paragraph without a fragment", () => {
        expect(
            parseScriptureLink(
                "https://scriptures.info/scriptures/bofm/alma/5.10",
            )?.paragraph,
        ).toBe(10);
    });

    test("decodes url-encoded book names and lower-cases", () => {
        expect(
            parseScriptureLink(
                "https://scriptures.info/scriptures/TC/T%26C/82.20",
            ),
        ).toEqual({ volume: "tc", book: "t&c", chapter: "82", paragraph: 20 });
    });

    test("strips query strings", () => {
        expect(
            parseScriptureLink(
                "https://scriptures.info/scriptures/cc/ether/1.2?utm_source=x#2",
            ),
        ).toEqual({ volume: "cc", book: "ether", chapter: "1", paragraph: 2 });
    });

    test("accepts www and http", () => {
        expect(
            parseScriptureLink(
                "http://www.scriptures.info/scriptures/cc/ether/1",
            )?.book,
        ).toBe("ether");
    });

    test("accepts the rescriptures:// scheme with a scriptures host", () => {
        expect(
            parseScriptureLink("rescriptures://scriptures/cc/ether/1.2#2"),
        ).toEqual({ volume: "cc", book: "ether", chapter: "1", paragraph: 2 });
    });

    test("accepts the rescriptures:// scheme without the scriptures segment", () => {
        expect(parseScriptureLink("rescriptures://cc/ether/1.2#2")).toEqual({
            volume: "cc",
            book: "ether",
            chapter: "1",
            paragraph: 2,
        });
    });

    test("keeps non-numeric chapters as strings", () => {
        expect(
            parseScriptureLink(
                "https://scriptures.info/scriptures/tc/lecture/preface",
            ),
        ).toEqual({
            volume: "tc",
            book: "lecture",
            chapter: "preface",
            paragraph: 0,
        });
    });

    test("non-numeric fragment falls back to paragraph 0", () => {
        expect(
            parseScriptureLink(
                "https://scriptures.info/scriptures/cc/ether/1#top",
            )?.paragraph,
        ).toBe(0);
    });

    test.each([
        null,
        undefined,
        "",
        "not a url",
        "https://example.com/scriptures/cc/ether/1",
        "https://scriptures.info/about",
        "https://scriptures.info/scriptures/cc/ether",
        "mailto:someone@scriptures.info",
    ])("rejects %s", (input) => {
        expect(parseScriptureLink(input as string)).toBeNull();
    });
});

describe("buildScriptureLink", () => {
    test("round-trips through the parser", () => {
        const url = buildScriptureLink("cc", "ether", "1", 2);
        expect(url).toBe("https://scriptures.info/scriptures/cc/ether/1.2#2");
        expect(parseScriptureLink(url)).toEqual({
            volume: "cc",
            book: "ether",
            chapter: "1",
            paragraph: 2,
        });
    });

    test("omits the paragraph when zero/absent", () => {
        expect(buildScriptureLink("oc", "genesis", "4")).toBe(
            "https://scriptures.info/scriptures/oc/genesis/4",
        );
    });
});
