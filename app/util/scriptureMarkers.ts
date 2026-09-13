/**
 * Inline text markers embedded in the raw scripture source text.
 *
 * This is the single source of truth for the marker vocabulary, shared by:
 *  - `HtmlProcessor` — styles/transforms the markers into HTML for the reader.
 *  - plain-text consumers (e.g. the Screens overview preview) — strips them.
 *
 * Each entry is a RegExp *source* string (no flags) so every caller can build a
 * RegExp with the flags it needs without sharing a mutable `lastIndex`.
 */
export const MARKER_PATTERNS = {
    /** Second-person pronoun markers. */
    pronoun: "2PSI|2PSF|2PP|2PG",
    /** LEChapter followed by the chapter number (captured). */
    leChapter: "LEChapter(\\d+)",
    /** LEVerse followed by an optional verse number. */
    leVerse: "LEVerse(\\d*)",
    /** End-of-verse marker. */
    verseEnd: "VerseEnd",
    /** Verse followed by the verse number (captured). */
    verse: "Verse(\\d+)",
} as const;

/** Builds a fresh RegExp for a marker source with the given flags. */
export function markerRegExp(
    source: keyof typeof MARKER_PATTERNS,
    flags?: string,
): RegExp {
    return new RegExp(MARKER_PATTERNS[source], flags);
}

/**
 * Removes every inline scripture marker from a plain-text string, replacing each
 * with a single space. Callers should collapse whitespace afterwards.
 */
export function stripScriptureMarkers(text: string): string {
    return text
        .replace(markerRegExp("leChapter", "g"), " ")
        .replace(markerRegExp("leVerse", "g"), " ")
        .replace(markerRegExp("verseEnd", "g"), " ")
        .replace(markerRegExp("verse", "g"), " ")
        .replace(markerRegExp("pronoun", "g"), " ");
}
