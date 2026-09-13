// Parses an external "open in app" scripture link into its parts.
//
// Canonical form, as published on scriptures.info:
//   https://scriptures.info/scriptures/<volume>/<book>/<chapter>[.<paragraph>][#<paragraph>]
// e.g. https://scriptures.info/scriptures/cc/ether/1.2#2
//
// Also accepts the app's custom scheme (rescriptures://scriptures/cc/ether/1.2#2)
// and a chapter with no paragraph (/scriptures/oc/genesis/4).
//
// Kept dependency-free (no URL/Linking imports) so it is trivially unit-testable
// and safe to run on Hermes, which has only a partial URL implementation.

export type ScriptureLink = {
    // volume_id hint from the URL ("cc", "bofm", "oc", "nt", "tc", ...). Used to
    // disambiguate books that exist in more than one volume (e.g. "ether" is in
    // both "bofm" and "cc").
    volume: string;
    // Book synonym/slug as written in the URL, e.g. "ether", "1nephi", "t&c".
    book: string;
    // book_chapter, kept as a string — a few chapters are non-numeric.
    chapter: string;
    // Paragraph position to scroll to; 0 when the link omits one.
    paragraph: number;
};

const ACCEPTED_HOSTS = ["scriptures.info", "www.scriptures.info"];

export function parseScriptureLink(
    raw: string | null | undefined,
): ScriptureLink | null {
    if (!raw || typeof raw !== "string") return null;
    let rest = raw.trim();

    const schemeMatch = rest.match(/^([a-z][a-z0-9+.-]*):\/\//i);
    if (!schemeMatch) return null;
    const scheme = schemeMatch[1].toLowerCase();
    rest = rest.slice(schemeMatch[0].length);

    if (scheme === "https" || scheme === "http") {
        const slash = rest.indexOf("/");
        const host = (slash === -1 ? rest : rest.slice(0, slash))
            .toLowerCase()
            .split(":")[0];
        if (!ACCEPTED_HOSTS.includes(host)) return null;
        rest = slash === -1 ? "" : rest.slice(slash);
    } else if (scheme === "rescriptures") {
        // rescriptures://scriptures/cc/...  -> host segment is "scriptures"
        // rescriptures://cc/...             -> host segment is the volume
        const slash = rest.indexOf("/");
        const host = slash === -1 ? rest : rest.slice(0, slash);
        rest = slash === -1 ? "" : rest.slice(slash);
        if (host && host.toLowerCase() !== "scriptures") {
            rest = "/" + host + rest;
        }
    } else {
        return null;
    }

    let hash = "";
    const hashIdx = rest.indexOf("#");
    if (hashIdx !== -1) {
        hash = rest.slice(hashIdx + 1);
        rest = rest.slice(0, hashIdx);
    }
    const queryIdx = rest.indexOf("?");
    if (queryIdx !== -1) rest = rest.slice(0, queryIdx);

    let segments: string[];
    try {
        segments = rest
            .split("/")
            .filter(Boolean)
            .map((s) => decodeURIComponent(s));
    } catch {
        return null;
    }
    if (segments[0]?.toLowerCase() === "scriptures") segments.shift();
    if (segments.length < 3) return null;

    const [volume, book, chapterPart] = segments;
    const dot = chapterPart.indexOf(".");
    const chapter = dot === -1 ? chapterPart : chapterPart.slice(0, dot);
    const paragraphFromPath = dot === -1 ? "" : chapterPart.slice(dot + 1);

    // The fragment wins over the path form when both are present.
    const paragraphStr = hash.trim() || paragraphFromPath.trim();
    const paragraph = /^\d+$/.test(paragraphStr)
        ? parseInt(paragraphStr, 10)
        : 0;

    if (!volume || !book || !chapter) return null;

    return {
        volume: volume.toLowerCase(),
        book: book.toLowerCase(),
        chapter,
        paragraph,
    };
}

// Builds the canonical shareable link for a reference. Mirrors the parser so a
// round-trip is stable.
export function buildScriptureLink(
    volume: string,
    book: string,
    chapter: string,
    paragraph?: number,
): string {
    const base = `https://scriptures.info/scriptures/${encodeURIComponent(
        volume,
    )}/${encodeURIComponent(book)}/${encodeURIComponent(chapter)}`;
    return paragraph && paragraph > 0
        ? `${base}.${paragraph}#${paragraph}`
        : base;
}
