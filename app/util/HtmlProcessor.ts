import * as cheerio from "cheerio";
import { getFontFaceCss } from "./FontLoader";
import webviewStyles from "../styles/webviewStyles.js";
import {
    generateImageReplacementScript,
    preloadImagesFromHTML,
} from "./ImageUtils";
import { ScrollTracker } from "./ScrollTracker";
import { MARKER_PATTERNS, markerRegExp } from "./scriptureMarkers";
import {
    BLOCK_TAGS,
    BLOCK_SELECTOR,
    buildBookAlternation,
    buildReferenceSource,
    findReferenceLinks,
    type ReferenceLink,
    type TextPiece,
    type TextSlice,
} from "./scriptureReferences";

/**
 * Processes HTML content to apply verse and chapter styling, and remove empty anchors.
 * This utility performs the same transformations as the JavaScript functions in webviewScripts.js
 * but processes the HTML on the React Native side before it's passed to the WebView.
 */
export class HtmlProcessor {
    private $: cheerio.CheerioAPI;

    constructor(html: string) {
        this.$ = cheerio.load(html, {
            decodeEntities: false, // Preserve HTML entities
            xmlMode: false,
        });
    }

    private stripPronounMarkers(): void {
        try {
            const re = markerRegExp("pronoun", "g");
            this.$("p, li").each((_, element) => {
                const $element = this.$(element);
                const original = $element.html();
                if (!original || !re.test(original)) return;
                re.lastIndex = 0;
                $element.html(original.replace(re, "").replace(/  +/g, " "));
            });
        } catch (error) {
            console.error("Error in stripPronounMarkers:", error);
        }
    }

    /**
     * Applies verse styling to paragraph and list item elements.
     * Converts VerseEnd, Verse1, and Verse{number} patterns to appropriate HTML.
     *
     * Operates on the element's innerHTML (not its flattened text) so that inline
     * markup such as italicized headings — e.g. `Verse1 <i>The word that Isaiah…</i>`
     * before 2 Nephi 8:4 — survives the transformation. Reading `.text()` here would
     * discard those `<i>`/`<b>` tags whenever the element also carried a verse marker.
     */
    private styleCCVerses(): void {
        try {
            const elements = this.$("p, li");

            elements.each((_, element) => {
                const $element = this.$(element);
                const originalHtml = $element.html();
                if (!originalHtml) return;

                // Skip elements with no verse patterns — avoids touching inner HTML
                if (
                    !new RegExp(
                        `${MARKER_PATTERNS.verseEnd}|${MARKER_PATTERNS.verse}`,
                    ).test(originalHtml)
                )
                    return;

                let html = originalHtml;

                // Remove VerseEnd
                html = html.replace(markerRegExp("verseEnd", "g"), "");

                // Verse 1's number is not displayed — replace with an empty sup
                html = html.replace(/Verse1 /, "<sup></sup>");

                // Wrap each verse number with the immediately following word in a nowrap
                // span so the red number and the first word of the verse always stay on
                // the same line. The following-word capture stops at a tag boundary
                // (`[^\s<]+`) so it never swallows an opening inline tag.
                const reVerse = new RegExp(
                    `${MARKER_PATTERNS.verse} ([^\\s<]+)`,
                    "g",
                );
                html = html.replace(
                    reVerse,
                    '<span style="white-space:nowrap"><sup class="le-verse">$1</sup> $2</span>',
                );

                // Any verse marker immediately followed by an inline tag (so no plain
                // word to pair with) still needs its number rendered on its own.
                html = html.replace(
                    markerRegExp("verse", "g"),
                    '<sup class="le-verse">$1</sup>',
                );

                $element.html(html.trim());
            });
        } catch (error) {
            console.error("Error in styleCCVerses:", error);
        }
    }

    /**
     * Applies chapter styling by converting LEChapter{number} patterns to span elements.
     */
    private styleCCChapters(): void {
        try {
            const elements = this.$("p, li");

            elements.each((_, element) => {
                const $element = this.$(element);
                const re = markerRegExp("leChapter", "g");

                // Process each text node within the element
                $element.contents().each((_, node) => {
                    if (node.type === "text") {
                        const text = node.data || "";
                        let lastIndex = 0;
                        let newHtml = "";

                        // Find all matches
                        let match;
                        while ((match = re.exec(text)) !== null) {
                            // Add text before the match
                            if (match.index > lastIndex) {
                                newHtml += text.slice(lastIndex, match.index);
                            }

                            // Add the span element
                            newHtml += `<span class="le-chapter">${match[1]}</span>`;

                            lastIndex = match.index + match[0].length;
                        }

                        // Add remaining text
                        if (lastIndex < text.length) {
                            newHtml += text.slice(lastIndex);
                        }

                        // Replace the text node with the new HTML
                        if (newHtml !== text) {
                            this.$(node).replaceWith(newHtml);
                        }
                    }
                });
            });
        } catch (error) {
            console.error("Error in styleCCChapters:", error);
        }
    }

    /**
     * Adds sequential numeric IDs to <p> elements that lack one, but ONLY when
     * the chapter has no <li id="N"> paragraph elements already.
     *
     * Regular scripture chapters (OC, NC, TC sections, CC, BoFM) use
     * <li id="1">, <li id="2">, … for their paragraphs, so those elements
     * already give SelectionHandler the numeric IDs it needs and must not be
     * disturbed.  Adding IDs to <p> elements in those chapters would create
     * duplicate IDs (e.g. both <p id="1"> and <li id="1">), breaking
     * getElementById-based highlight restoration.
     *
     * T&C Appendix/Glossary chapters use plain <p> tags with no IDs at all,
     * causing SelectionHandler.findParagraphContainer() to return null and the
     * highlight modal never to appear.  For those chapters this method assigns
     * ids 1, 2, 3 … in document order, matching the `position` column in the
     * paragraphs table.
     */
    private addParagraphIds(): void {
        try {
            // Bail out if any <li> element already carries a numeric id — that means
            // this is a standard verse-list chapter and IDs are already correct.
            let hasLiIds = false;
            this.$("li").each((_, el) => {
                if (/^\d+$/.test(this.$(el).attr("id") || "")) {
                    hasLiIds = true;
                    return false; // break
                }
            });
            if (hasLiIds) return;

            let counter = 1;
            this.$("p").each((_, element) => {
                const $el = this.$(element);
                const existingId = $el.attr("id");
                if (!existingId || !/^\d+$/.test(existingId)) {
                    $el.attr("id", String(counter));
                }
                counter++;
            });
        } catch (error) {
            console.error("Error in addParagraphIds:", error);
        }
    }

    /**
     * Prevents scripture references from wrapping across lines by replacing the
     * internal spaces of a reference with non-breaking spaces.
     *
     * Two spaces within a reference can fall at a line boundary:
     *   1. Between the book name and the chapter:verse — "Matthew 2:10" breaking
     *      into "Matthew" / "2:10". Fixed by gluing the space before any
     *      chapter:verse token to the preceding word.
     *   2. Inside a numbered book name — "1 Nephi", "2 Timothy" breaking into
     *      "1" / "Nephi". Fixed by gluing a leading 1–4 numeral to a following
     *      capitalized word. This also occasionally glues a stray "number +
     *      Capitalized word" (e.g. "2 Nephites"), which is harmless — a
     *      non-breaking space only ever keeps two tokens on the same line.
     *
     * Each replaced space becomes a non-breaking space (U+00A0). The chapter:verse
     * token itself ("2:10", "3:7-9") never breaks on its own since neither ':'
     * nor '-' are break opportunities.
     *
     * Operates directly on text-node data (no re-parse) so surrounding markup —
     * cross-reference anchors, verse spans, etc. — is untouched.
     */
    private preventReferenceLineBreaks(): void {
        try {
            // Book name (non-space) + whitespace + chapter:verse.
            const reChapterVerse = /(\S)[ \t]+(\d+:\d+)/g;
            // Leading 1–4 numeral + whitespace + capitalized book word.
            const reNumberedBook = /\b([1-4])[ \t]+([A-Z])/g;
            const NBSP = " ";

            const walk = (node: any): void => {
                if (node.type === "text") {
                    const text = node.data as string;
                    // Every reference and numbered book contains a digit; skip
                    // the regex work for text nodes that have none.
                    if (!text || !/\d/.test(text)) return;
                    const replaced = text
                        .replace(reChapterVerse, `$1${NBSP}$2`)
                        .replace(reNumberedBook, `$1${NBSP}$2`);
                    if (replaced !== text) node.data = replaced;
                } else if (node.type === "tag") {
                    (node.children ?? []).forEach(walk);
                }
            };

            (this.$("body").get(0)?.children ?? []).forEach(walk);
        } catch (error) {
            console.error("Error in preventReferenceLineBreaks:", error);
        }
    }

    /**
     * Wraps in-text scripture references in tappable anchors so the reader can
     * navigate to them, where the book name is one of the known Restoration
     * Edition names/synonyms passed in `bookNames`. Resolving a book name to a
     * book_id/volume happens at click time (the anchor href just carries the raw
     * reference components), keeping this processor free of any database
     * dependency.
     *
     * Three forms are recognised (see `scriptureReferences.ts` for the pattern):
     *
     *   1. `Book chapter:paragraph` anywhere in the text — "Genesis 4:14",
     *      "T&C 82:20", "2 Nephi 11:8 CE".
     *   2. `Book chapter` — too ambiguous for running prose ("Psalm 23",
     *      "Lecture 7"), so it is only linked inside a citation aside: square
     *      brackets ("[Alma 17]") or a parenthetical opening with see/cf./
     *      compare ("(see T&C 158)").
     *   3. `KJV ref [RE ref]` — T&C 110 (Lectures on Faith) and the glossary
     *      write the traditional reference first and the Restoration Edition
     *      equivalent in brackets, e.g. "Hebrews 11:3 [Heb. 1:36]". The whole
     *      span becomes one anchor targeting the bracketed RE reference, whose
     *      numbers are the ones that address RE paragraphs.
     *
     * Matching runs over each block's *flattened* text rather than one text node
     * at a time, so a reference is still found when inline markup splits it —
     * "[<i>see</i> T&C 9:5]", or a book name inside a small-caps span. Anchors
     * are then applied per text node, which keeps the surrounding markup intact;
     * a reference straddling two nodes yields one anchor per node, both pointing
     * at the same target.
     *
     * Existing anchors, highlight spans and the red verse/chapter markers are
     * never descended into.
     */
    private linkScriptureReferences(bookNames: string[]): void {
        const alternation = buildBookAlternation(bookNames);
        if (!alternation) return;

        try {
            const referenceSource = buildReferenceSource(alternation);

            this.$(BLOCK_SELECTOR).each((_, element) => {
                const pieces: TextPiece[] = [];
                let flat = "";

                const collect = (node: any): void => {
                    if (node.type === "text") {
                        const data = (node.data as string) ?? "";
                        if (!data) return;
                        pieces.push({
                            node,
                            start: flat.length,
                            end: flat.length + data.length,
                        });
                        flat += data;
                        return;
                    }
                    if (node.type !== "tag") return;
                    // A nested block is matched on its own pass; existing links,
                    // highlights and verse markers are left alone entirely.
                    if (node.name === "a" || BLOCK_TAGS.has(node.name)) return;
                    const cls = node.attribs?.class ?? "";
                    if (
                        cls.includes("user-highlight") ||
                        cls.includes("search-highlight") ||
                        cls.includes("le-verse") ||
                        cls.includes("le-chapter")
                    )
                        return;
                    (node.children ?? []).forEach(collect);
                };

                ((element as any).children ?? []).forEach(collect);

                // Every reference contains a digit; skip the regex work for
                // blocks that have none.
                if (!flat || !/\d/.test(flat)) return;

                const links = findReferenceLinks(flat, referenceSource);
                if (links.length > 0) this.applyReferenceLinks(pieces, links);
            });
        } catch (error) {
            console.error("Error in linkScriptureReferences:", error);
        }
    }

    /**
     * Rewrites the text nodes covered by `links` so each linked span is wrapped
     * in an anchor, leaving every other node untouched.
     *
     * `pieces` maps each text node to its offsets within the flattened block
     * text that the links were found in.
     */
    private applyReferenceLinks(
        pieces: TextPiece[],
        links: ReferenceLink[],
    ): void {
        const esc = (s: string) =>
            s
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");

        // Clip each link to the portion falling inside each text node. Links
        // arrive in document order, so each node's slices are ordered too.
        const slicesByPiece = new Map<number, TextSlice[]>();
        for (const link of links) {
            for (let i = 0; i < pieces.length; i++) {
                const piece = pieces[i];
                if (piece.end <= link.start || piece.start >= link.end)
                    continue;
                const slices = slicesByPiece.get(i) ?? [];
                slices.push({
                    from: Math.max(link.start, piece.start) - piece.start,
                    to: Math.min(link.end, piece.end) - piece.start,
                    href: link.href,
                });
                slicesByPiece.set(i, slices);
            }
        }

        for (const [index, slices] of slicesByPiece) {
            const piece = pieces[index];
            const text = piece.node.data as string;
            let out = "";
            let cursor = 0;
            for (const slice of slices) {
                out += esc(text.slice(cursor, slice.from));
                out += `<a class="scripture-ref" href="${slice.href}">${esc(
                    text.slice(slice.from, slice.to),
                )}</a>`;
                cursor = slice.to;
            }
            out += esc(text.slice(cursor));
            this.$(piece.node).replaceWith(out);
        }
    }

    /**
     * Removes empty anchor tags (those with no href or href="#")
     */
    private removeEmptyAnchors(): void {
        try {
            this.$("a").each((_, element) => {
                const $element = this.$(element);
                const href = $element.attr("href");

                if (!href || href === "#") {
                    const text = $element.text();
                    $element.replaceWith(text);
                }
            });
        } catch (error) {
            console.error("Error in removeEmptyAnchors:", error);
        }
    }

    /**
     * Parses search terms to handle both phrases (quoted strings) and individual words
     * @param searchString - The search string to parse
     * @returns Array of search terms with type and value
     */
    private parseSearchTerms(
        searchString: string,
    ): { type: "phrase" | "word"; value: string }[] {
        const terms: { type: "phrase" | "word"; value: string }[] = [];
        const trimmed = searchString.trim();

        // Check if the entire string is quoted (phrase search)
        // Support both regular quotes and smart quotes (iOS auto-converts quotes)
        const startsWithQuote = /^["\u201C\u201D']/.test(trimmed);
        const endsWithQuote = /["\u201C\u201D']$/.test(trimmed);

        if (startsWithQuote && endsWithQuote) {
            // Remove quotes and add as a single phrase
            const phrase = trimmed.slice(1, -1);
            if (phrase.length > 0) {
                terms.push({ type: "phrase", value: phrase });
            }
        } else {
            // Split by spaces and handle individual quoted phrases within
            const parts = trimmed.split(" ");
            let currentPhrase = "";
            let inQuotes = false;
            let quoteChar = "";

            // Helper to check if string starts with any quote character (regular or smart)
            const startsWithAnyQuote = (str: string) =>
                /^["\u201C\u201D']/.test(str);
            const endsWithAnyQuote = (str: string) =>
                /["\u201C\u201D']$/.test(str);
            const getFirstChar = (str: string) => str.charAt(0);
            const getLastChar = (str: string) => str.charAt(str.length - 1);

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];

                if (!inQuotes) {
                    // Check if this part starts and ends with a quote (single word phrase)
                    if (
                        startsWithAnyQuote(part) &&
                        endsWithAnyQuote(part) &&
                        part.length > 2
                    ) {
                        // Single word phrase
                        const phrase = part.slice(1, -1);
                        if (phrase.length > 0) {
                            terms.push({ type: "phrase", value: phrase });
                        }
                    } else if (startsWithAnyQuote(part)) {
                        // Start of a multi-word phrase
                        inQuotes = true;
                        quoteChar = getFirstChar(part);
                        currentPhrase = part.slice(1);
                    } else if (part.length > 0) {
                        // Regular word
                        terms.push({ type: "word", value: part });
                    }
                } else {
                    // Inside quotes - check if this part ends with the same quote character
                    if (part.length > 0 && getLastChar(part) === quoteChar) {
                        // End of phrase
                        currentPhrase += " " + part.slice(0, -1);
                        if (currentPhrase.length > 0) {
                            terms.push({
                                type: "phrase",
                                value: currentPhrase,
                            });
                        }
                        inQuotes = false;
                        currentPhrase = "";
                    } else {
                        // Continue phrase
                        currentPhrase += " " + part;
                    }
                }
            }

            // Handle unclosed quotes
            if (inQuotes && currentPhrase.length > 0) {
                terms.push({ type: "phrase", value: currentPhrase });
            }
        }

        return terms;
    }

    /**
     * Applies search term highlighting to the HTML content.
     * Walks the DOM via cheerio to find raw text nodes, so regex never runs on HTML markup.
     */
    private applySearchHighlighting(searchTerm: string): void {
        if (!searchTerm || searchTerm.trim() === "") return;

        const HIGHLIGHT_CLASS = "search-highlight";
        const HIGHLIGHT_STYLE =
            "background-color: rgba(255, 140, 0, 0.65); border-radius: 2px;";

        try {
            const parsedTerms = this.parseSearchTerms(searchTerm);

            // When multiple unquoted words are searched, prepend the full phrase as a
            // synthetic phrase term so single-letter words within the phrase (e.g. "a"
            // in "offender for a word") are highlighted as part of the whole match
            // rather than being skipped during individual-word highlighting.
            const wordTerms = parsedTerms.filter((t) => t.type === "word");
            const searchTerms =
                wordTerms.length > 1
                    ? [
                          {
                              type: "phrase" as const,
                              value: wordTerms.map((t) => t.value).join(" "),
                          },
                          ...parsedTerms,
                      ]
                    : parsedTerms;

            /**
             * Given a plain-text string, find all non-overlapping match ranges for every
             * search term and return the string with highlight spans inserted.
             * All regex runs on plain text only — no HTML involved.
             */
            const highlightPlainText = (text: string): string => {
                type MatchRange = {
                    start: number;
                    end: number;
                    matched: string;
                };
                const ranges: MatchRange[] = [];

                for (const term of searchTerms) {
                    // Skip single-letter words — too noisy when Porter stemming is active
                    if (term.type === "word" && term.value.length === 1)
                        continue;
                    const escaped = term.value.replace(
                        /[.*+?^${}()|[\]\\]/g,
                        "\\$&",
                    );
                    const pattern =
                        term.type === "phrase"
                            ? new RegExp(`\\b${escaped}\\b`, "gi")
                            : new RegExp(escaped, "gi");

                    let m: RegExpExecArray | null;
                    while ((m = pattern.exec(text)) !== null) {
                        ranges.push({
                            start: m.index,
                            end: m.index + m[0].length,
                            matched: m[0],
                        });
                    }
                }

                if (ranges.length === 0) return text;

                // Sort by start position; prefer longer (phrase) matches on ties
                ranges.sort(
                    (a, b) =>
                        a.start - b.start ||
                        b.end - b.start - (a.end - a.start),
                );

                // Build output, skipping overlapping ranges
                let result = "";
                let cursor = 0;
                for (const range of ranges) {
                    if (range.start < cursor) continue; // overlaps a prior match — skip
                    result += text.slice(cursor, range.start);
                    result += `<span class="${HIGHLIGHT_CLASS}" style="${HIGHLIGHT_STYLE}">${range.matched}</span>`;
                    cursor = range.end;
                }
                result += text.slice(cursor);
                return result;
            };

            /**
             * Recursively walk DOM nodes.  Only text nodes are processed; existing
             * highlight spans are skipped to prevent double-wrapping.
             */
            const walkNode = (node: any): void => {
                if (node.type === "text") {
                    const original = node.data as string;
                    if (!original) return;
                    const replaced = highlightPlainText(original);
                    if (replaced !== original) {
                        this.$(node).replaceWith(replaced);
                    }
                } else if (node.type === "tag") {
                    // Don't descend into already-highlighted spans
                    if (
                        node.name === "span" &&
                        (node.attribs?.class ?? "").includes(HIGHLIGHT_CLASS)
                    )
                        return;
                    // Copy children array — DOM may be mutated by replaceWith during iteration
                    const children: any[] = [...(node.children ?? [])];
                    children.forEach(walkNode);
                }
            };

            this.$("p, li, div").each((_, element) => {
                const children: any[] = [...((element as any).children ?? [])];
                children.forEach(walkNode);
            });
        } catch (error) {
            console.error("Error applying search highlighting:", error);
        }
    }

    /**
     * Preloads images from the HTML content.
     * @param html - The HTML content to preload images from
     * @returns A promise that resolves to an object with image names as keys and base64 data URLs as values
     */
    private async preloadImages(
        html: string,
    ): Promise<{ [key: string]: string }> {
        const images = await preloadImagesFromHTML(html);
        return images;
    }

    /**
     * Processes the HTML content by applying all transformations.
     * @param displayLEVerses - Whether to show verse and chapter numbers
     * @param volume_id - The volume ID to determine if verses should be shown
     * @param searchTerm - Optional search term to highlight in the content
     * @returns The processed HTML as a string
     */
    public async process(
        displayLEVerses: boolean = true,
        volume_id?: string,
        searchTerm?: string,
        referenceBookNames?: string[],
    ): Promise<string> {
        try {
            // Strip pronoun markers (2PSI, 2PSF, 2PP, 2PG) before any other processing
            this.stripPronounMarkers();

            // Apply verse and chapter styling if needed
            this.styleCCVerses();
            this.styleCCChapters();

            // Wrap in-text scripture references in tappable anchors. Runs before
            // preventReferenceLineBreaks so the non-breaking-space pass also
            // glues the reference text now inside each anchor.
            if (referenceBookNames && referenceBookNames.length > 0) {
                this.linkScriptureReferences(referenceBookNames);
            }

            // Keep scripture references (e.g. "Matthew 2:10") from wrapping
            this.preventReferenceLineBreaks();

            // Apply search highlighting if search term is provided
            if (searchTerm) {
                this.applySearchHighlighting(searchTerm);
            }

            // Add sequential numeric IDs to <p> elements so SelectionHandler can
            // identify paragraph containers for chapters that use <p> instead of <li id="N">
            // (e.g. T&C Appendix, Glossary).
            this.addParagraphIds();

            // Remove empty anchors after all other transformations
            this.removeEmptyAnchors();

            // For some reason, <b> and <i> tags don't work if inside a <p> tag
            // for the Covenant of Christ glossary.  Mutate every <p> element's tag
            // name to "div" directly in Cheerio's DOM so that all attributes
            // (including any numeric id assigned by addParagraphIds) are preserved
            // automatically — no fragile regex needed.
            //
            // Also tag each converted element with the "p-block" class so the
            // stylesheet can give every paragraph consistent bottom spacing —
            // including id-less headings (e.g. the italic intro before 2 Nephi 8:4)
            // that the old `div[id] + div[id]` sibling rule never reached.
            this.$("p").each((_, el) => {
                el.name = "div";
                const existing = el.attribs.class;
                el.attribs.class = existing ? `${existing} p-block` : "p-block";
            });

            // Get the processed content
            const processedContent = this.$("body").html() || "";
            const finalContent = processedContent;

            // Preload images
            let imageReplacementScript = "";
            const base64Images = await this.preloadImages(processedContent);

            // Generate the image replacement script first
            imageReplacementScript =
                generateImageReplacementScript(base64Images);

            // Generate scroll tracking script
            const scrollTrackingScript =
                ScrollTracker.generateScrollTrackingScript();

            // Reference the bundled font files by URI rather than re-embedding
            // ~350 KB of base64 font data into every chapter document.
            const fontFaceCss = await getFontFaceCss();

            return `
        <!DOCTYPE html>
        <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
                <meta charset="UTF-8">
                <style>
                    /* Prevent FOUC by hiding content until styles are applied */
                    html:not(.styles-applied) body {
                        visibility: hidden;
                    }
                    html.styles-applied body {
                        visibility: visible;
                    }
                    ${webviewStyles}
                    ${fontFaceCss}
                </style>
            </head>
            <body class="${displayLEVerses ? "" : "hide-le"}">
                <section id="scriptureText">
                    ${finalContent}
                </section>
                <script>
                    // Global error handler for webview scripts
                    window.addEventListener('error', function(e) {
                        console.error('WebView script error:', e.error);
                    });
                    ${imageReplacementScript}
                    ${scrollTrackingScript}
                </script>
            </body>
        </html>
      `;
        } catch (error) {
            console.error("Error processing HTML:", error);
            return this.$.html();
        }
    }

    /**
     * Static method to process HTML content.
     * @param html - The HTML content to process
     * @param displayLEVerses - Whether to display red verse and chapter numbers
     * @param volume_id - The volume ID to determine if verses should be shown
     * @param searchTerm - Optional search term to highlight in the content
     * @returns The processed HTML as a string
     */
    public static async processHtml(
        html: string,
        displayLEVerses: boolean = true,
        volume_id?: string,
        searchTerm?: string,
        referenceBookNames?: string[],
    ): Promise<string> {
        const processor = new HtmlProcessor(html);
        return await processor.process(
            displayLEVerses,
            volume_id,
            searchTerm,
            referenceBookNames,
        );
    }
}

export default HtmlProcessor;
