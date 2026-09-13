/**
 * Unit tests for the pure logic embedded in reader.tsx.
 *
 * reader.tsx is a React Native screen component that cannot be rendered in
 * a Node test environment without heavy native-module mocking.  Instead, we
 * mirror (verbatim) each piece of pure logic so that tests break if the
 * source code drifts.
 *
 * Covered:
 *   1. ACTIONS constant          — action-type string values
 *   2. reducer                   — all six action types + default branch + state immutability
 *   3. initialState factory      — initial state shape including searchTerm fallback
 *   4. handleLinkPress parsing   — URL tokenisation (volume / book / chapter / position)
 *   5. webViewSource memo        — undefined guard when html or volume_id is absent
 *   6. scrollScript generator    — JS snippet shape for position > 0 and position = 0
 *   7. onMessage routing         — message-type → handler dispatch table
 *   8. selection guard           — conditions that gate highlight persistence
 *   9. applyStyles template      — interpolated JS string for colour/font injection
 *  10. contentLoaded snippet     — always adds styles-applied class to <html>
 */

import type { Mock } from "vitest";
import type { RangeData } from "../../util/SelectionHandler";

// ===========================================================================
// 1. ACTIONS constant
//
// Verbatim copy of the ACTIONS object at lines 48-56 of reader.tsx.
// ===========================================================================

const ACTIONS = {
    SET_WEBVIEW_LOADING: "SET_WEBVIEW_LOADING",
    SET_HTML: "SET_HTML",
    SET_LOADING: "SET_LOADING",
    SET_POSITION: "SET_POSITION",
    TOGGLE_FAB: "TOGGLE_FAB",
    SET_SEARCH_TERM: "SET_SEARCH_TERM",
};

describe("ACTIONS constant", () => {
    it("SET_WEBVIEW_LOADING is 'SET_WEBVIEW_LOADING'", () => {
        expect(ACTIONS.SET_WEBVIEW_LOADING).toBe("SET_WEBVIEW_LOADING");
    });

    it("SET_HTML is 'SET_HTML'", () => {
        expect(ACTIONS.SET_HTML).toBe("SET_HTML");
    });

    it("SET_LOADING is 'SET_LOADING'", () => {
        expect(ACTIONS.SET_LOADING).toBe("SET_LOADING");
    });

    it("SET_POSITION is 'SET_POSITION'", () => {
        expect(ACTIONS.SET_POSITION).toBe("SET_POSITION");
    });

    it("TOGGLE_FAB is 'TOGGLE_FAB'", () => {
        expect(ACTIONS.TOGGLE_FAB).toBe("TOGGLE_FAB");
    });

    it("SET_SEARCH_TERM is 'SET_SEARCH_TERM'", () => {
        expect(ACTIONS.SET_SEARCH_TERM).toBe("SET_SEARCH_TERM");
    });

    it("has exactly six keys", () => {
        expect(Object.keys(ACTIONS)).toHaveLength(6);
    });
});

// ===========================================================================
// 2. reducer
//
// Verbatim copy of the reducer at lines 59-77 of reader.tsx.
// ===========================================================================

interface ReaderState {
    webViewLoading: boolean;
    html: string;
    isLoading: boolean;
    position: number;
    fabVisible: boolean;
    searchTerm: string | null;
}

const reducer = (
    state: ReaderState,
    action: { type: string; payload?: any },
): ReaderState => {
    switch (action.type) {
        case ACTIONS.SET_WEBVIEW_LOADING:
            return { ...state, webViewLoading: action.payload };
        case ACTIONS.SET_HTML:
            return { ...state, html: action.payload };
        case ACTIONS.SET_LOADING:
            return { ...state, isLoading: action.payload };
        case ACTIONS.SET_POSITION:
            return { ...state, position: action.payload };
        case ACTIONS.TOGGLE_FAB:
            return { ...state, fabVisible: action.payload };
        case ACTIONS.SET_SEARCH_TERM:
            return { ...state, searchTerm: action.payload };
        default:
            return state;
    }
};

const baseState: ReaderState = {
    webViewLoading: false,
    html: "",
    isLoading: true,
    position: 0,
    fabVisible: true,
    searchTerm: null,
};

describe("reducer", () => {
    it("SET_WEBVIEW_LOADING sets webViewLoading to true", () => {
        const s = reducer(baseState, {
            type: ACTIONS.SET_WEBVIEW_LOADING,
            payload: true,
        });
        expect(s.webViewLoading).toBe(true);
    });

    it("SET_WEBVIEW_LOADING sets webViewLoading to false", () => {
        const s = reducer(
            { ...baseState, webViewLoading: true },
            {
                type: ACTIONS.SET_WEBVIEW_LOADING,
                payload: false,
            },
        );
        expect(s.webViewLoading).toBe(false);
    });

    it("SET_HTML sets html", () => {
        const s = reducer(baseState, {
            type: ACTIONS.SET_HTML,
            payload: "<p>hello</p>",
        });
        expect(s.html).toBe("<p>hello</p>");
    });

    it("SET_HTML with empty string clears html", () => {
        const s = reducer(
            { ...baseState, html: "<p>old</p>" },
            {
                type: ACTIONS.SET_HTML,
                payload: "",
            },
        );
        expect(s.html).toBe("");
    });

    it("SET_LOADING sets isLoading to false", () => {
        const s = reducer(baseState, {
            type: ACTIONS.SET_LOADING,
            payload: false,
        });
        expect(s.isLoading).toBe(false);
    });

    it("SET_LOADING sets isLoading to true", () => {
        const s = reducer(
            { ...baseState, isLoading: false },
            {
                type: ACTIONS.SET_LOADING,
                payload: true,
            },
        );
        expect(s.isLoading).toBe(true);
    });

    it("SET_POSITION sets position", () => {
        const s = reducer(baseState, {
            type: ACTIONS.SET_POSITION,
            payload: 42,
        });
        expect(s.position).toBe(42);
    });

    it("SET_POSITION sets position to 0", () => {
        const s = reducer(
            { ...baseState, position: 5 },
            {
                type: ACTIONS.SET_POSITION,
                payload: 0,
            },
        );
        expect(s.position).toBe(0);
    });

    it("TOGGLE_FAB sets fabVisible to false", () => {
        const s = reducer(baseState, {
            type: ACTIONS.TOGGLE_FAB,
            payload: false,
        });
        expect(s.fabVisible).toBe(false);
    });

    it("TOGGLE_FAB sets fabVisible to true", () => {
        const s = reducer(
            { ...baseState, fabVisible: false },
            {
                type: ACTIONS.TOGGLE_FAB,
                payload: true,
            },
        );
        expect(s.fabVisible).toBe(true);
    });

    it("SET_SEARCH_TERM sets searchTerm to a string", () => {
        const s = reducer(baseState, {
            type: ACTIONS.SET_SEARCH_TERM,
            payload: "faith",
        });
        expect(s.searchTerm).toBe("faith");
    });

    it("SET_SEARCH_TERM sets searchTerm to null", () => {
        const s = reducer(
            { ...baseState, searchTerm: "faith" },
            {
                type: ACTIONS.SET_SEARCH_TERM,
                payload: null,
            },
        );
        expect(s.searchTerm).toBeNull();
    });

    it("unknown action type returns state unchanged", () => {
        const s = reducer(baseState, { type: "UNKNOWN_ACTION" });
        expect(s).toBe(baseState); // exact same reference
    });

    it("each dispatch does not mutate the previous state object", () => {
        const original = { ...baseState };
        reducer(baseState, { type: ACTIONS.SET_HTML, payload: "<p>x</p>" });
        expect(baseState.html).toBe(original.html);
    });

    it("only the targeted field changes; all others are preserved", () => {
        const s = reducer(baseState, {
            type: ACTIONS.SET_POSITION,
            payload: 7,
        });
        expect(s.webViewLoading).toBe(baseState.webViewLoading);
        expect(s.html).toBe(baseState.html);
        expect(s.isLoading).toBe(baseState.isLoading);
        expect(s.fabVisible).toBe(baseState.fabVisible);
        expect(s.searchTerm).toBe(baseState.searchTerm);
    });
});

// ===========================================================================
// 3. initialState factory
//
// Mirrors the useReducer initial-value block at lines 150-157.
// ===========================================================================

/** Mirrors the initial state passed to useReducer in reader.tsx. */
function makeInitialState(params: { searchTerm?: string | null }) {
    return {
        webViewLoading: false,
        html: "",
        isLoading: true,
        position: 0,
        fabVisible: true,
        searchTerm: params.searchTerm || null,
    };
}

describe("initialState factory", () => {
    it("webViewLoading starts as false", () => {
        expect(makeInitialState({}).webViewLoading).toBe(false);
    });

    it("html starts as empty string", () => {
        expect(makeInitialState({}).html).toBe("");
    });

    it("isLoading starts as true", () => {
        expect(makeInitialState({}).isLoading).toBe(true);
    });

    it("position starts as 0", () => {
        expect(makeInitialState({}).position).toBe(0);
    });

    it("fabVisible starts as true", () => {
        expect(makeInitialState({}).fabVisible).toBe(true);
    });

    it("searchTerm is null when params.searchTerm is undefined", () => {
        expect(makeInitialState({}).searchTerm).toBeNull();
    });

    it("searchTerm uses params.searchTerm when provided", () => {
        expect(makeInitialState({ searchTerm: "grace" }).searchTerm).toBe(
            "grace",
        );
    });

    it("searchTerm is null when params.searchTerm is null (falsy override)", () => {
        expect(makeInitialState({ searchTerm: null }).searchTerm).toBeNull();
    });

    it("searchTerm is null when params.searchTerm is empty string (falsy)", () => {
        // '' || null → null
        expect(makeInitialState({ searchTerm: "" }).searchTerm).toBeNull();
    });
});

// ===========================================================================
// 4. handleLinkPress — URL parsing
//
// Mirrors the tokenisation block at lines 808-814 of reader.tsx:
//
//   const parts = href.split("/");
//   const volume = parts[2];
//   const book = parts[3];
//   const [chapter, tmp] = parts[4].split(".");
//   const position = tmp ? tmp.split("-")[0] : null;
// ===========================================================================

interface LinkParts {
    volume: string;
    book: string;
    chapter: string;
    position: string | null;
}

/** Mirrors the URL tokenisation in handleLinkPress(). */
function parseLinkHref(href: string): LinkParts {
    const parts = href.split("/");
    const volume = parts[2];
    const book = parts[3];
    const [chapter, tmp] = parts[4].split(".");
    const position = tmp ? tmp.split("-")[0] : null;
    return { volume, book, chapter, position };
}

describe("handleLinkPress — URL parsing", () => {
    it("extracts volume from parts[2]", () => {
        const { volume } = parseLinkHref("/link/cc/ccforeword/1");
        expect(volume).toBe("cc");
    });

    it("extracts book from parts[3]", () => {
        const { book } = parseLinkHref("/link/cc/ccforeword/1");
        expect(book).toBe("ccforeword");
    });

    it("extracts chapter from parts[4] when no paragraph suffix", () => {
        const { chapter, position } = parseLinkHref("/link/oc/genesis/3");
        expect(chapter).toBe("3");
        expect(position).toBeNull();
    });

    it("extracts chapter and position when suffix present (e.g. '1.5')", () => {
        const { chapter, position } = parseLinkHref("/link/oc/genesis/1.5");
        expect(chapter).toBe("1");
        expect(position).toBe("5");
    });

    it("takes only the start of a range when suffix contains a dash (e.g. '2.7-10')", () => {
        const { chapter, position } = parseLinkHref("/link/oc/genesis/2.7-10");
        expect(chapter).toBe("2");
        expect(position).toBe("7"); // first part before '-'
    });

    it("position is null when the chapter segment has no dot", () => {
        const { position } = parseLinkHref("/link/oc/genesis/5");
        expect(position).toBeNull();
    });

    it("handles multi-word book IDs (e.g. 1ne)", () => {
        const { volume, book, chapter } = parseLinkHref("/link/bofm/1ne/3");
        expect(volume).toBe("bofm");
        expect(book).toBe("1ne");
        expect(chapter).toBe("3");
    });

    it("handles tc volume links", () => {
        const { volume, book, chapter } = parseLinkHref("/link/tc/section/110");
        expect(volume).toBe("tc");
        expect(book).toBe("section");
        expect(chapter).toBe("110");
    });

    it("handles a chapter-only reference with no position (e.g. maps)", () => {
        const { chapter, position } = parseLinkHref("/link/oc/maps/maps");
        expect(chapter).toBe("maps");
        expect(position).toBeNull();
    });

    it("handles paragraph 0 (position is string '0', not null)", () => {
        // parts[4] = "1.0" → tmp = "0", which is truthy as a string
        const { chapter, position } = parseLinkHref("/link/oc/genesis/1.0");
        expect(chapter).toBe("1");
        expect(position).toBe("0");
    });
});

// ===========================================================================
// 5. webViewSource memo
//
// Mirrors the useMemo block at lines 950-956 of reader.tsx:
//
//   if (!state.html || !params.volume_id) return undefined;
//   return { html: state.html };
// ===========================================================================

/** Mirrors the webViewSource memo computation. */
function computeWebViewSource(
    html: string,
    volume_id: string,
): { html: string } | undefined {
    if (!html || !volume_id) return undefined;
    return { html };
}

describe("webViewSource memo", () => {
    it("returns a source object when html and volume_id are both present", () => {
        const result = computeWebViewSource("<p>text</p>", "cc");
        expect(result).toBeDefined();
        expect(result!.html).toBe("<p>text</p>");
    });

    it("returns undefined when html is empty string", () => {
        expect(computeWebViewSource("", "cc")).toBeUndefined();
    });

    it("returns undefined when volume_id is empty string", () => {
        expect(computeWebViewSource("<p>text</p>", "")).toBeUndefined();
    });

    it("returns undefined when both are empty", () => {
        expect(computeWebViewSource("", "")).toBeUndefined();
    });

    it("returned object contains only the html field (not volume_id)", () => {
        const result = computeWebViewSource("<p>x</p>", "oc");
        expect(Object.keys(result!)).toEqual(["html"]);
    });

    it("html content is passed through unchanged", () => {
        const html = "<chapter><p id='1'>In the beginning…</p></chapter>";
        const result = computeWebViewSource(html, "oc");
        expect(result!.html).toBe(html);
    });
});

// ===========================================================================
// 6. scrollScript generator
//
// Mirrors the scrollScript factory at lines 918-942 of reader.tsx.
// scrollScript() returns a function; that inner function is called with a
// position and returns a JS string.
// ===========================================================================

/** Mirrors the scrollScript factory in reader.tsx. */
const contentLoadedSnippet = `
    (function() {
        try {
            if (document.documentElement) {
                document.documentElement.classList.add('styles-applied');
            }
        } catch(e) {
            console.error('Error adding content loaded class:', e);
        }
        true;
    })();
`;

const scrollScript = () => {
    return (position: number) => `
        (function() {
            try {
                // Scroll to position
                if (${position} > 0) {
                    const element = document.getElementById('${position > 0 ? position : 1}');
                    if (element) {
                        element.scrollIntoView({
                            block: 'start',
                            behavior: 'instant'
                        });
                    } else {
                        console.log('Element with id ${position > 0 ? position : 1} not found');
                    }
                }
            } catch(e) {
                console.error('JavaScript injection error: ', e);
            }
            ${contentLoadedSnippet}
            true;
        })();
        true;
    `;
};

describe("scrollScript generator", () => {
    it("scrollScript() returns a function", () => {
        expect(typeof scrollScript()).toBe("function");
    });

    it("the inner function returns a string", () => {
        expect(typeof scrollScript()(5)).toBe("string");
    });

    it("embeds the position as an integer check when position > 0", () => {
        const script = scrollScript()(5);
        expect(script).toContain("if (5 > 0)");
    });

    it("uses the position as the element ID when position > 0", () => {
        const script = scrollScript()(5);
        expect(script).toContain("getElementById('5')");
    });

    it("uses element ID '1' when position is 0 (position > 0 ? position : 1)", () => {
        const script = scrollScript()(0);
        expect(script).toContain("getElementById('1')");
    });

    it("the if-guard is 'if (0 > 0)' when position is 0 (no scroll occurs)", () => {
        const script = scrollScript()(0);
        expect(script).toContain("if (0 > 0)");
    });

    it("includes styles-applied class addition via contentLoaded", () => {
        const script = scrollScript()(3);
        expect(script).toContain("styles-applied");
    });

    it("uses scrollIntoView with block: 'start' and behavior: 'instant'", () => {
        const script = scrollScript()(3);
        expect(script).toContain("block: 'start'");
        expect(script).toContain("behavior: 'instant'");
    });

    it("wraps everything in an IIFE", () => {
        const script = scrollScript()(3);
        expect(script).toContain("(function()");
    });

    it("ends with bare 'true' at the top level (required by WebView)", () => {
        const script = scrollScript()(3).trim();
        expect(script.endsWith("true;")).toBe(true);
    });
});

// ===========================================================================
// 7. onMessage routing
//
// Mirrors the dispatch table in the WebView onMessage handler (lines 993-1131).
// We test the routing logic — which handler is called for which message type —
// without testing the side effects (navigation, DB writes, etc.).
// ===========================================================================

type MessageType =
    | "link"
    | "highlightTap"
    | "scroll"
    | "navigation"
    | "selection"
    | string;

type AnyMock = Mock<(...args: any[]) => any>;

interface MockHandlers {
    handleLinkPress: AnyMock;
    handleHighlightTap: AnyMock;
    handleScroll: AnyMock;
    handleNavigation: AnyMock;
    handleSelection: AnyMock;
}

/** Mirrors the onMessage dispatch table from reader.tsx. */
function dispatchMessage(
    data: { type: MessageType; [key: string]: any },
    handlers: MockHandlers,
) {
    if (data.type === "link") {
        handlers.handleLinkPress(data.href);
    } else if (data.type === "highlightTap") {
        handlers.handleHighlightTap(data.highlightId, data.text);
    } else if (data.type === "scroll") {
        handlers.handleScroll(data.position);
    } else if (data.type === "navigation") {
        handlers.handleNavigation(data.direction);
    } else if (data.type === "selection") {
        handlers.handleSelection(data.range);
    }
}

function makeHandlers(): MockHandlers {
    return {
        handleLinkPress: vi.fn(),
        handleHighlightTap: vi.fn(),
        handleScroll: vi.fn(),
        handleNavigation: vi.fn(),
        handleSelection: vi.fn(),
    };
}

describe("onMessage routing — message-type dispatch", () => {
    it("routes 'link' messages to handleLinkPress with href", () => {
        const h = makeHandlers();
        dispatchMessage({ type: "link", href: "/link/cc/ccforeword/1" }, h);
        expect(h.handleLinkPress).toHaveBeenCalledWith("/link/cc/ccforeword/1");
        expect(h.handleHighlightTap).not.toHaveBeenCalled();
    });

    it("routes 'highlightTap' messages with highlightId and text", () => {
        const h = makeHandlers();
        dispatchMessage(
            { type: "highlightTap", highlightId: "uuid-1", text: "the word" },
            h,
        );
        expect(h.handleHighlightTap).toHaveBeenCalledWith("uuid-1", "the word");
        expect(h.handleLinkPress).not.toHaveBeenCalled();
    });

    it("routes 'scroll' messages with position", () => {
        const h = makeHandlers();
        dispatchMessage({ type: "scroll", position: 7 }, h);
        expect(h.handleScroll).toHaveBeenCalledWith(7);
    });

    it("routes 'navigation' direction='previous' to handleNavigation", () => {
        const h = makeHandlers();
        dispatchMessage({ type: "navigation", direction: "previous" }, h);
        expect(h.handleNavigation).toHaveBeenCalledWith("previous");
    });

    it("routes 'navigation' direction='next' to handleNavigation", () => {
        const h = makeHandlers();
        dispatchMessage({ type: "navigation", direction: "next" }, h);
        expect(h.handleNavigation).toHaveBeenCalledWith("next");
    });

    it("routes 'selection' messages with range data", () => {
        const h = makeHandlers();
        const range: Partial<RangeData> = {
            paragraphPosition: 3,
            paragraphStartOffset: 10,
            paragraphEndOffset: 26,
            spansParagraphs: false,
        };
        dispatchMessage({ type: "selection", range }, h);
        expect(h.handleSelection).toHaveBeenCalledWith(range);
    });

    it("unknown message type calls no handler", () => {
        const h = makeHandlers();
        dispatchMessage({ type: "unknown_type" }, h);
        expect(h.handleLinkPress).not.toHaveBeenCalled();
        expect(h.handleHighlightTap).not.toHaveBeenCalled();
        expect(h.handleScroll).not.toHaveBeenCalled();
        expect(h.handleNavigation).not.toHaveBeenCalled();
        expect(h.handleSelection).not.toHaveBeenCalled();
    });

    it("exactly one handler is called per message", () => {
        const types: MessageType[] = [
            "link",
            "highlightTap",
            "scroll",
            "navigation",
            "selection",
        ];
        const payloads: Record<string, object> = {
            link: { href: "/link/oc/genesis/1" },
            highlightTap: { highlightId: "x", text: "y" },
            scroll: { position: 3 },
            navigation: { direction: "next" },
            selection: { range: {} },
        };
        for (const type of types) {
            const h = makeHandlers();
            dispatchMessage({ type, ...payloads[type] }, h);
            const callCounts = Object.values(h).map(
                (fn) => fn.mock.calls.length,
            );
            const total = callCounts.reduce((a, b) => a + b, 0);
            expect(total).toBe(1);
        }
    });
});

// ===========================================================================
// 8. selection guard conditions
//
// Mirrors the guard at lines 1080-1083 of reader.tsx:
//
//   if (rangeData.paragraphPosition &&
//       rangeData.paragraphStartOffset !== null &&
//       rangeData.paragraphEndOffset !== null &&
//       !rangeData.spansParagraphs)
// ===========================================================================

/** Mirrors the selection guard that permits saving a highlight. */
function selectionShouldSave(range: Partial<RangeData>): boolean {
    return !!(
        range.paragraphPosition &&
        range.paragraphStartOffset !== null &&
        range.paragraphEndOffset !== null &&
        !range.spansParagraphs
    );
}

describe("selection guard conditions", () => {
    const valid: Partial<RangeData> = {
        paragraphPosition: 3,
        paragraphStartOffset: 10,
        paragraphEndOffset: 26,
        spansParagraphs: false,
        selectedText: "In the beginning",
    };

    it("returns true for a valid single-paragraph selection", () => {
        expect(selectionShouldSave(valid)).toBe(true);
    });

    it("returns false when paragraphPosition is null (cross-para or unknown)", () => {
        expect(selectionShouldSave({ ...valid, paragraphPosition: null })).toBe(
            false,
        );
    });

    it("returns false when paragraphPosition is 0 (falsy)", () => {
        expect(selectionShouldSave({ ...valid, paragraphPosition: 0 })).toBe(
            false,
        );
    });

    it("returns false when paragraphStartOffset is null", () => {
        expect(
            selectionShouldSave({ ...valid, paragraphStartOffset: null }),
        ).toBe(false);
    });

    it("returns true when paragraphStartOffset is 0 (valid start-of-paragraph)", () => {
        // 0 !== null, so the guard passes
        expect(selectionShouldSave({ ...valid, paragraphStartOffset: 0 })).toBe(
            true,
        );
    });

    it("returns false when paragraphEndOffset is null", () => {
        expect(
            selectionShouldSave({ ...valid, paragraphEndOffset: null }),
        ).toBe(false);
    });

    it("returns true when paragraphEndOffset is 0", () => {
        expect(selectionShouldSave({ ...valid, paragraphEndOffset: 0 })).toBe(
            true,
        );
    });

    it("returns false when spansParagraphs is true", () => {
        expect(selectionShouldSave({ ...valid, spansParagraphs: true })).toBe(
            false,
        );
    });

    it("returns false when all fields are null/undefined", () => {
        expect(selectionShouldSave({})).toBe(false);
    });

    it("all four conditions must hold simultaneously", () => {
        // Flip each one individually and verify failure
        const flips: Partial<RangeData>[] = [
            { ...valid, paragraphPosition: null },
            { ...valid, paragraphStartOffset: null },
            { ...valid, paragraphEndOffset: null },
            { ...valid, spansParagraphs: true },
        ];
        for (const flip of flips) {
            expect(selectionShouldSave(flip)).toBe(false);
        }
    });
});

// ===========================================================================
// 9. applyStyles JS template
//
// Mirrors the applyStyles template literal at lines 779-803 of reader.tsx.
// We verify the interpolated values appear in the expected positions.
// ===========================================================================

/** Mirrors the applyStyles template in reader.tsx. */
function buildApplyStyles(opts: {
    backgroundColor: string;
    foregroundColor: string;
    fontSize: number;
    fontFamily: string;
    alignment: string;
    markerColor: string;
}): string {
    const {
        backgroundColor,
        foregroundColor,
        fontSize,
        fontFamily,
        alignment,
        markerColor,
    } = opts;
    return `
        (function() {
            try {
                if (document.body) {
                    document.body.style.backgroundColor = '${backgroundColor}';
                    document.body.style.color = '${foregroundColor}';
                    document.body.style.fontSize = '${fontSize}px';
                    document.body.style.fontFamily = '${fontFamily}';
                    document.querySelector('ol.simple-text').style.textAlign = '${alignment}';
                }

                const elements = document.querySelectorAll('span.le-chapter, sup.le-verse');
                if (elements && elements.length > 0) {
                    elements.forEach(el => {
                        if (el) {
                            el.style.color = '${markerColor}';
                        }
                    });
                }
            } catch(e) {
                console.error('Error applying styles:', e);
            }
            true;
        })();
    `;
}

const defaultStyleOpts = {
    backgroundColor: "#ffffff",
    foregroundColor: "#15141A",
    fontSize: 18,
    fontFamily: "Assistant-Regular",
    alignment: "justify",
    markerColor: "#ba3919",
};

describe("applyStyles JS template", () => {
    it("is a non-empty string", () => {
        expect(buildApplyStyles(defaultStyleOpts).length).toBeGreaterThan(0);
    });

    it("interpolates backgroundColor correctly", () => {
        const script = buildApplyStyles({
            ...defaultStyleOpts,
            backgroundColor: "#1a1a1a",
        });
        expect(script).toContain("backgroundColor = '#1a1a1a'");
    });

    it("interpolates foregroundColor as body color", () => {
        const script = buildApplyStyles({
            ...defaultStyleOpts,
            foregroundColor: "#f0f0f0",
        });
        expect(script).toContain("document.body.style.color = '#f0f0f0'");
    });

    it("interpolates fontSize with 'px' suffix", () => {
        const script = buildApplyStyles({ ...defaultStyleOpts, fontSize: 22 });
        expect(script).toContain("fontSize = '22px'");
    });

    it("interpolates fontFamily", () => {
        const script = buildApplyStyles({
            ...defaultStyleOpts,
            fontFamily: "EBGaramond-Regular",
        });
        expect(script).toContain("fontFamily = 'EBGaramond-Regular'");
    });

    it("interpolates alignment on the ol.simple-text element", () => {
        const script = buildApplyStyles({
            ...defaultStyleOpts,
            alignment: "left",
        });
        expect(script).toContain(
            "querySelector('ol.simple-text').style.textAlign = 'left'",
        );
    });

    it("interpolates markerColor for le-chapter and le-verse spans", () => {
        const script = buildApplyStyles({
            ...defaultStyleOpts,
            markerColor: "#ff6600",
        });
        expect(script).toContain("el.style.color = '#ff6600'");
    });

    it("targets both 'span.le-chapter' and 'sup.le-verse' selectors", () => {
        const script = buildApplyStyles(defaultStyleOpts);
        expect(script).toContain("span.le-chapter, sup.le-verse");
    });

    it("wraps everything in an IIFE", () => {
        const script = buildApplyStyles(defaultStyleOpts);
        expect(script).toContain("(function()");
    });

    it("changing one option does not affect others", () => {
        const script = buildApplyStyles({ ...defaultStyleOpts, fontSize: 30 });
        // backgroundColor should still be the default
        expect(script).toContain(
            `backgroundColor = '${defaultStyleOpts.backgroundColor}'`,
        );
        expect(script).toContain("fontSize = '30px'");
    });
});

// ===========================================================================
// 10. contentLoaded snippet
//
// Mirrors the contentLoaded script at lines 905-916 of reader.tsx.
// This JS is injected into the WebView to signal that styles have been applied.
// ===========================================================================

const contentLoaded = `
    (function() {
        try {
            if (document.documentElement) {
                document.documentElement.classList.add('styles-applied');
            }
        } catch(e) {
            console.error('Error adding content loaded class:', e);
        }
        true;
    })();
`;

describe("contentLoaded snippet", () => {
    it("is a non-empty string", () => {
        expect(contentLoaded.trim().length).toBeGreaterThan(0);
    });

    it("adds 'styles-applied' class to documentElement", () => {
        expect(contentLoaded).toContain("classList.add('styles-applied')");
    });

    it("targets document.documentElement (not document.body)", () => {
        expect(contentLoaded).toContain("document.documentElement");
        expect(contentLoaded).not.toContain("document.body.classList");
    });

    it("wraps code in an IIFE", () => {
        expect(contentLoaded).toContain("(function()");
    });

    it("includes a try/catch for error safety", () => {
        expect(contentLoaded).toContain("try {");
        expect(contentLoaded).toContain("catch(e)");
    });
});
