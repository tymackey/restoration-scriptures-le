/**
 * Detection of in-text scripture references ("Genesis 4:14", "[Alma 17]",
 * "(see T&C 158)", "Hebrews 11:3 [Heb. 1:36]") in reader text.
 *
 * This module is pure text/regex logic: it takes a flattened string and returns
 * the spans that should become links. `HtmlProcessor` owns the DOM side —
 * flattening a block's text nodes into that string and wrapping the returned
 * spans in anchors. Keeping the two apart lets the heuristic be tested against
 * plain strings without a DOM.
 *
 * The `reref://book/chapter/paragraph/edition` href only carries the raw
 * reference components; resolving a book name to a book_id and a chapter
 * happens at click time in the reader, which has the database.
 */

/** A regular or non-breaking space. */
const SP = "[ \\u00A0]";

/**
 * Any dash used in a chapter or verse range: ASCII hyphen, the Unicode dash
 * block (hyphen, non-breaking hyphen, figure dash, en dash, em dash, horizontal
 * bar) and the minus sign. Printed references mix these freely.
 */
const DASH = "[-\\u2010-\\u2015\\u2212]";

/** Editions a reference may be tagged with — "2 Nephi 11:8 CE". */
const EDITIONS = "RE|CE|OC|NC";

/**
 * How far back to look for the opening delimiter of a "[…]" or "(see …)"
 * aside. Long enough for the asides that actually occur — "(see Book of
 * Doctrine and Covenants [T&C 154:9–18])" — without scanning whole paragraphs.
 */
const ASIDE_LOOKBEHIND = 200;

/**
 * A parenthetical aside that introduces cross-references rather than prose.
 * "(see …)", "(See also …)", "(cf. …)", "(compare …)".
 */
const SEE_ASIDE = /^\(\s*(?:see|cf\.?|compare)\b/i;

/**
 * Block-level elements. References never span two of these, so each one is
 * flattened and matched independently.
 */
export const BLOCK_TAGS = new Set([
    "p",
    "li",
    "div",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "blockquote",
    "td",
    "th",
    "dd",
    "dt",
    "figcaption",
]);

/** The same set as a cheerio selector. */
export const BLOCK_SELECTOR = Array.from(BLOCK_TAGS).join(", ");

/**
 * One text node of a block, with its offsets in that block's flattened text.
 */
export type TextPiece = {
    /** The cheerio text node. */
    node: any;
    /** Inclusive start offset of this node's text in the flattened block. */
    start: number;
    /** Exclusive end offset of this node's text in the flattened block. */
    end: number;
};

/** The portion of one link that falls inside a single text node. */
export type TextSlice = {
    /** Inclusive start offset within the text node. */
    from: number;
    /** Exclusive end offset within the text node. */
    to: number;
    /** `reref://` href the anchor navigates to. */
    href: string;
};

/** A span of the flattened text that should become an anchor. */
export type ReferenceLink = {
    /** Inclusive start offset into the flattened block text. */
    start: number;
    /** Exclusive end offset into the flattened block text. */
    end: number;
    /** `reref://` href the anchor navigates to. */
    href: string;
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Builds the book-name alternation from the known Restoration Edition book
 * names and their synonyms. Longest first so "2 nephi" wins over "nephi" and
 * "teachings and commandments" over shorter overlaps.
 */
export function buildBookAlternation(bookNames: string[]): string {
    if (!bookNames || bookNames.length === 0) return "";
    return Array.from(
        new Set(bookNames.map((n) => n.trim().toLowerCase()).filter(Boolean)),
    )
        .sort((a, b) => b.length - a.length)
        .map(escapeRe)
        .join("|");
}

/**
 * One reference: book, chapter, optional ":paragraph", optional range/list,
 * optional edition suffix.
 *
 * Capture groups (5 per fragment): book, book/chapter separator, chapter,
 * paragraph, edition. The paragraph group is `undefined` for the chapter-only
 * form ("T&C 158"); the separator is captured so a comma there can be rejected
 * for that form (see `findReferenceLinks`).
 */
function coreFragment(alternation: string): string {
    // No leading \b: the source occasionally runs a book name straight onto the
    // preceding token — a footnote marker ("<sup>1</sup>Teachings and
    // Commandments 157:15") or a dropped space ("see alsoActs 2:1 RE") — and a
    // word boundary would skip those. A book name still has to be followed by a
    // separator and a chapter number, which is what keeps the match honest.
    return (
        `(${alternation})` +
        // An abbreviating period may be followed by no space at all
        // ("[Gen.2:17–19]"); a spelled-out name needs whitespace, optionally
        // after a comma ("the epistle to the Hebrews, 11:3").
        `(\\.${SP}*|,?${SP}+)` +
        `(\\d+)` +
        // ":paragraph", tolerating spaces around the colon ("[Isa. 18: 7–8]"),
        // plus ranges and comma lists ("1 Nephi 1:10, 22", "Gen. 2:17–19").
        // A range may run into another chapter — "Gen. 6:8 - 7:4 RE".
        `(?:${SP}*:${SP}*(\\d+)(?:${SP}*${DASH}${SP}*\\d+(?:${SP}*:${SP}*\\d+)?)?` +
        `(?:${SP}*,${SP}*\\d+(?:${SP}*${DASH}${SP}*\\d+)?)*)?` +
        // The chapter-only form's range — "see T&C 156–174".
        `(?:${SP}*${DASH}${SP}*\\d+)?` +
        `(?:${SP}+(${EDITIONS})\\b)?`
    );
}

/**
 * Builds the full reference pattern source.
 *
 * A reference may optionally be followed by a bracketed second reference — the
 * "KJV [RE]" form used throughout T&C 110 (Lectures on Faith) and the glossary,
 * e.g. "Hebrews 11:3 [Heb. 1:36]". The bracketed reference is the Restoration
 * Edition one, so the whole span becomes a single anchor targeting it. A little
 * punctuation commonly sits between the two ("Mark 16:16. [Mark 8:6]"), and the
 * bracket may open with a short lead-in — "[see T&C 9:5]", "[LE; see also
 * Acts 2:1 RE]" — which the digit-free run before the reference allows for.
 *
 * Groups 1–5 describe the leading reference, groups 6–10 the bracketed one.
 */
export function buildReferenceSource(alternation: string): string {
    const core = coreFragment(alternation);
    return (
        core +
        `(?:[.,;:]?${SP}*\\[[^\\]\\d]{0,24}?` +
        core +
        `${SP}*[.,]?${SP}*\\])?`
    );
}

/**
 * True when `index` sits inside a "[…]" span, or inside a "(…)" span that opens
 * with "see"/"cf."/"compare".
 *
 * Both are strong signals that the surrounding text is a citation rather than
 * prose, which is what licenses the otherwise-ambiguous chapter-only reference
 * form. Without that gate, "Psalm 23", "Lecture 7" and "Section 130 of the LDS
 * Doctrine and Covenants" would all be linked as references.
 */
export function inReferenceAside(flat: string, index: number): boolean {
    const floor = Math.max(0, index - ASIDE_LOOKBEHIND);
    for (let i = index - 1; i >= floor; i--) {
        const ch = flat[i];
        if (ch === "]") break;
        if (ch === "[") return true;
    }
    for (let i = index - 1; i >= floor; i--) {
        const ch = flat[i];
        if (ch === ")") break;
        if (ch === "(") return SEE_ASIDE.test(flat.slice(i, index));
    }
    return false;
}

/** Opening double-quote characters mapped to their closing counterpart. */
const CLOSING_QUOTE: Record<string, string> = {
    "“": "”", // “ ”
    '"': '"',
};

/**
 * True when the match is wrapped tightly in quotation marks — an opening
 * quote directly before it, a closing quote directly after (allowing a single
 * trailing comma or period between the reference and the closing quote, as in
 * "Alma 13:17–18," June 15, 2010, blog post.).
 *
 * The glossary footnotes cite blog posts whose titles are themselves
 * chapter:verse strings (see "Abominable/Abomination"), so the same text that
 * looks like a reference elsewhere is here a title being quoted, not a
 * citation to follow. A loose "is this inside some quotes" check would also
 * swallow ordinary quoted prose that happens to mention a reference
 * mid-sentence, so the quotes must hug the match on both sides.
 */
export function isQuotedTitle(
    flat: string,
    start: number,
    end: number,
): boolean {
    if (start === 0) return false;
    const closing = CLOSING_QUOTE[flat[start - 1]];
    if (closing === undefined) return false;
    let i = end;
    if (flat[i] === "," || flat[i] === ".") i++;
    return flat[i] === closing;
}

/**
 * Guards against a book name matching in the middle of an ordinary word.
 *
 * The pattern has no leading `\b`, because the source sometimes runs a book
 * name straight onto the token before it — "<sup>1</sup>Teachings and
 * Commandments 157:15", "see alsoActs 2:1 RE". Both of those are still legible
 * as a new word: a case seam, upper after lower or after a digit. What must be
 * rejected is a match continuing the same word, which is how the synonym
 * "e jacob" would otherwise swallow the tail of "the Jacob 3:2".
 */
function startsCleanly(flat: string, index: number, matched: string): boolean {
    if (index === 0) return true;
    const previous = flat[index - 1];
    if (!/[A-Za-z\d]/.test(previous)) return true;
    return /[a-z\d]/.test(previous) && /[A-Z]/.test(matched[0]);
}

function buildHref(
    book: string,
    chapter: string,
    paragraph: string,
    edition: string,
): string {
    // Strip abbreviating periods so "Heb." and "heb" resolve through the same
    // `synonyms` row; the reader does the book_id lookup at click time.
    const bookKey = book.toLowerCase().replace(/\./g, "").trim();
    return (
        "reref://" +
        encodeURIComponent(bookKey) +
        "/" +
        chapter +
        "/" +
        paragraph +
        "/" +
        edition
    );
}

/**
 * Matches a chain of "; chapter:paragraph" or "and chapter:paragraph" items
 * directly following a reference — shorthand for repeating the same book, as
 * in "Revelation 4:4; 8:6" (glossary "Accuse"), "TSJ 5:19; 6:16; 9:3–4", or
 * "Moroni 4:1 and 5:1 CE" (Covenant of Christ "Ordinances"). Each item targets
 * a different chapter, so each gets its own link; only the "chapter:paragraph"
 * portion (plus its own edition suffix, if any — "and 5:1 CE" keeps "CE" with
 * that item) is linked, matching how a fully spelled-out semicolon list
 * already links each reference separately. An item's own edition suffix wins;
 * otherwise it falls back to the edition (if any) already on the reference
 * this chain follows.
 */
function matchTrailingReferences(
    flat: string,
    end: number,
    book: string,
    edition: string,
): { links: ReferenceLink[]; end: number } {
    const itemRe = new RegExp(
        `^(${SP}*;${SP}*|${SP}+and\\b${SP}+)(\\d+)${SP}*:${SP}*(\\d+)` +
            `(?:${SP}*${DASH}${SP}*\\d+(?:${SP}*:${SP}*\\d+)?)?` +
            `(?:${SP}+(${EDITIONS})\\b)?`,
        "i",
    );
    const links: ReferenceLink[] = [];
    let pos = end;

    let item: RegExpExecArray | null;
    while ((item = itemRe.exec(flat.slice(pos))) !== null) {
        links.push({
            start: pos + item[1].length,
            end: pos + item[0].length,
            href: buildHref(book, item[2], item[3], item[4] ?? edition),
        });
        pos += item[0].length;
    }

    return { links, end: pos };
}

/**
 * Finds every linkable scripture reference in a flattened block of text.
 *
 * Returns non-overlapping spans in document order, each with the `reref://`
 * href it should navigate to.
 */
export function findReferenceLinks(
    flat: string,
    referenceSource: string,
): ReferenceLink[] {
    const re = new RegExp(referenceSource, "gi");
    const links: ReferenceLink[] = [];
    let match: RegExpExecArray | null;

    while ((match = re.exec(flat)) !== null) {
        // Resume the scan just past a rejected start rather than past the whole
        // rejected match — "the Jacob 3:2" must fall through to "Jacob 3:2"
        // once the synonym "e jacob" is turned away.
        const reject = () => {
            re.lastIndex = match!.index + 1;
        };

        if (!startsCleanly(flat, match.index, match[0])) {
            reject();
            continue;
        }

        if (isQuotedTitle(flat, match.index, match.index + match[0].length)) {
            reject();
            continue;
        }

        // A trailing bracketed reference means the "KJV [RE]" form: target the
        // bracketed Restoration Edition reference, not the KJV chapter:verse
        // numbers that precede it.
        const bracketed = match[6] !== undefined;
        const [book, separator, chapter, paragraph, edition] = bracketed
            ? match.slice(6, 11)
            : match.slice(1, 6);

        if (!bracketed) {
            // A comma between the book name and the number nearly always
            // introduces a page or volume:page, not a chapter — "Analysis of
            // Textual Variants of the Book of Mormon, 2:1173–1174", "(See
            // Beloved Enos, 126–127, for a discussion of names)". The one
            // legitimate use is the "…the epistle to the Hebrews, 11:3
            // [Heb. 1:36]" phrasing in T&C 110, which is always vouched for by
            // the bracketed reference that follows it.
            if (separator.includes(",")) {
                reject();
                continue;
            }
            // "Book chapter:paragraph" is unambiguous anywhere. The chapter-only
            // "Book chapter" form is only trusted inside a citation aside.
            if (
                match[4] === undefined &&
                !inReferenceAside(flat, match.index)
            ) {
                reject();
                continue;
            }
        }

        links.push({
            start: match.index,
            end: match.index + match[0].length,
            href: buildHref(book, chapter, paragraph ?? "", edition ?? ""),
        });

        // "Book chapter:paragraph" may be followed by bare "; chapter:paragraph"
        // shorthand for further chapters of the same book. Chapter-only matches
        // are ambiguous enough without a paragraph too, so this only applies to
        // the unambiguous chapter:paragraph form.
        if (!bracketed && paragraph !== undefined) {
            const trailing = matchTrailingReferences(
                flat,
                match.index + match[0].length,
                book,
                edition ?? "",
            );
            if (trailing.links.length > 0) {
                links.push(...trailing.links);
                re.lastIndex = trailing.end;
            }
        }
    }

    return links;
}
