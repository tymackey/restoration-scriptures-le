/**
 * Unit tests for SelectionHandler — the class that generates JavaScript strings
 * injected into the WebView for highlight/underline functionality.
 *
 * All three generators produce plain JavaScript strings; the tests verify the
 * strings contain the expected code fragments without executing them.
 *
 * Covered:
 *   1. generateApplyHighlightsScript — embeds highlights as JSON, sets CSS
 *      custom properties (--highlight-color, --underline-color,
 *      --light-highlight-color), sets data-mark-type attribute, defines color
 *      lightening helpers.
 *   2. generateModalScript — underline/highlight toggle (updateMarkType),
 *      color selection (colorSelect with markType), Copy (modalClosed),
 *      Search (searchText), Remove (deleteHighlight) button handlers.
 *   3. generateRemoveHighlightsScript — targets .user-highlight spans.
 */

import { SelectionHandler } from "../SelectionHandler";
import type { Highlight } from "../../data/UserDatabaseSchema";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function makeHighlight(overrides: Partial<Highlight> = {}): Highlight {
    return {
        id: "test-id-1",
        volume_id: "oc",
        book_id: "gen",
        book_chapter: "1",
        paragraph_position: 3,
        end_paragraph_position: null,
        start_offset: 10,
        end_offset: 25,
        selected_text: "In the beginning",
        color: "hsl(50,100%,26%)",
        mark_type: "highlight",
        created_at: "2024-01-01T00:00:00",
        modified_at: "2024-01-01T00:00:00",
        ...overrides,
    };
}

/** Extract the highlights JSON object embedded in the apply script. */
function extractHighlightsJson(script: string): Record<string, Highlight[]> {
    const match = script.match(/var highlights = ([^;]+);/);
    return match ? JSON.parse(match[1]) : {};
}

// ===========================================================================
// 1. generateApplyHighlightsScript
// ===========================================================================

describe("generateApplyHighlightsScript — script shape", () => {
    it("returns a non-empty string", () => {
        expect(
            SelectionHandler.generateApplyHighlightsScript([]).length,
        ).toBeGreaterThan(0);
    });

    it("wraps code in an IIFE", () => {
        expect(SelectionHandler.generateApplyHighlightsScript([])).toContain(
            "(function()",
        );
    });

    it("contains 'true;' (required by WebView injectJavaScript)", () => {
        const script = SelectionHandler.generateApplyHighlightsScript([]);
        expect(script).toContain("true;");
    });

    it("embeds an empty object when no highlights are given", () => {
        const parsed = extractHighlightsJson(
            SelectionHandler.generateApplyHighlightsScript([]),
        );
        expect(Object.keys(parsed)).toHaveLength(0);
    });
});

describe("generateApplyHighlightsScript — mark_type handling", () => {
    it("includes mark_type 'highlight' in the embedded JSON", () => {
        const script = SelectionHandler.generateApplyHighlightsScript([
            makeHighlight({ mark_type: "highlight" }),
        ]);
        expect(script).toContain('"mark_type":"highlight"');
    });

    it("includes mark_type 'underline' in the embedded JSON", () => {
        const script = SelectionHandler.generateApplyHighlightsScript([
            makeHighlight({ mark_type: "underline" }),
        ]);
        expect(script).toContain('"mark_type":"underline"');
    });

    it("sets the data-mark-type attribute on each span", () => {
        const script = SelectionHandler.generateApplyHighlightsScript([
            makeHighlight(),
        ]);
        expect(script).toContain("data-mark-type");
        expect(script).toContain("highlight.mark_type");
    });
});

describe("generateApplyHighlightsScript — CSS custom properties", () => {
    it("sets --highlight-color on each span", () => {
        const script = SelectionHandler.generateApplyHighlightsScript([
            makeHighlight(),
        ]);
        expect(script).toContain("--highlight-color");
    });

    it("sets --underline-color for visibility on dark backgrounds", () => {
        const script = SelectionHandler.generateApplyHighlightsScript([
            makeHighlight(),
        ]);
        expect(script).toContain("--underline-color");
    });

    it("sets --light-highlight-color for pastel highlights on light backgrounds", () => {
        const script = SelectionHandler.generateApplyHighlightsScript([
            makeHighlight(),
        ]);
        expect(script).toContain("--light-highlight-color");
    });

    it("defines lightenForUnderline to boost lightness for dark-bg underlines", () => {
        const script = SelectionHandler.generateApplyHighlightsScript([
            makeHighlight(),
        ]);
        expect(script).toContain("lightenForUnderline");
    });

    it("defines lightenForLightBg to create pastel highlights for light backgrounds", () => {
        const script = SelectionHandler.generateApplyHighlightsScript([
            makeHighlight(),
        ]);
        expect(script).toContain("lightenForLightBg");
    });
});

describe("generateApplyHighlightsScript — paragraph grouping", () => {
    it("groups two highlights in the same paragraph under one key", () => {
        const h1 = makeHighlight({
            id: "h1",
            paragraph_position: 3,
            start_offset: 0,
            end_offset: 5,
        });
        const h2 = makeHighlight({
            id: "h2",
            paragraph_position: 3,
            start_offset: 10,
            end_offset: 20,
        });
        const parsed = extractHighlightsJson(
            SelectionHandler.generateApplyHighlightsScript([h1, h2]),
        );
        expect(parsed["3"]).toHaveLength(2);
    });

    it("places highlights from different paragraphs in separate groups", () => {
        const h1 = makeHighlight({ id: "h1", paragraph_position: 3 });
        const h2 = makeHighlight({ id: "h2", paragraph_position: 7 });
        const parsed = extractHighlightsJson(
            SelectionHandler.generateApplyHighlightsScript([h1, h2]),
        );
        expect(Object.keys(parsed)).toHaveLength(2);
        expect(parsed["3"]).toHaveLength(1);
        expect(parsed["7"]).toHaveLength(1);
    });

    it("uses the paragraph_position as the JSON key", () => {
        const h = makeHighlight({ paragraph_position: 42 });
        const parsed = extractHighlightsJson(
            SelectionHandler.generateApplyHighlightsScript([h]),
        );
        expect(parsed["42"]).toBeDefined();
    });
});

describe("generateApplyHighlightsScript — orphan notification", () => {
    it("notifies React Native to delete orphan highlights that cannot be applied", () => {
        const script = SelectionHandler.generateApplyHighlightsScript([
            makeHighlight(),
        ]);
        expect(script).toContain("deleteOrphanHighlight");
    });
});

// ===========================================================================
// 2. generateModalScript
// ===========================================================================

describe("generateModalScript — script shape", () => {
    let script: string;

    beforeAll(() => {
        script = SelectionHandler.generateModalScript();
    });

    it("returns a non-empty string", () => {
        expect(script.length).toBeGreaterThan(0);
    });

    it("exposes __showHighlightModal for new text selections", () => {
        expect(script).toContain("__showHighlightModal");
    });

    it("exposes __showHighlightEditModal for tapping existing highlights", () => {
        expect(script).toContain("__showHighlightEditModal");
    });

    it("exposes __hideHighlightModal for programmatic dismissal", () => {
        expect(script).toContain("__hideHighlightModal");
    });
});

describe("generateModalScript — underline/highlight toggle", () => {
    let script: string;

    beforeAll(() => {
        script = SelectionHandler.generateModalScript();
    });

    it("defines updateStyleToggle to visually activate the correct mode button", () => {
        expect(script).toContain("updateStyleToggle");
    });

    it("sends updateMarkType message with markType 'underline' when underline button is tapped", () => {
        expect(script).toContain("type: 'updateMarkType'");
        expect(script).toContain("markType: 'underline'");
    });

    it("sends updateMarkType message with markType 'highlight' when highlight button is tapped", () => {
        expect(script).toContain("markType: 'highlight'");
    });

    it("updates data-mark-type attribute on the existing span for live DOM preview", () => {
        expect(script).toContain("data-mark-type");
    });

    it("resets markType to 'highlight' when the modal opens for a new selection", () => {
        // __showHighlightModal sets state.markType = 'highlight'
        expect(script).toContain("state.markType = 'highlight'");
    });

    it("reads data-mark-type from the highlight span when opening the edit modal", () => {
        // Touch handlers read getAttribute('data-mark-type') and pass it to __showHighlightEditModal
        expect(script).toContain("getAttribute('data-mark-type')");
    });
});

describe("generateModalScript — color selection", () => {
    let script: string;

    beforeAll(() => {
        script = SelectionHandler.generateModalScript();
    });

    it("sends a colorSelect message when a color circle is tapped", () => {
        expect(script).toContain("type: 'colorSelect'");
    });

    it("includes markType in the colorSelect payload so the reader knows the mode", () => {
        expect(script).toContain("markType: state.markType");
    });

    it("includes the selected color in the colorSelect payload", () => {
        expect(script).toContain("color: color");
    });

    it("includes isEditing and highlightId in the colorSelect payload", () => {
        expect(script).toContain("isEditing: state.isEditing");
        expect(script).toContain("highlightId: state.highlightId");
    });
});

describe("generateModalScript — Copy button", () => {
    let script: string;

    beforeAll(() => {
        script = SelectionHandler.generateModalScript();
    });

    it("sends modalClosed after copying (so reader can clean up any selection state)", () => {
        expect(script).toContain("type:'modalClosed'");
    });

    it("uses navigator.clipboard.writeText for the copy operation", () => {
        expect(script).toContain("navigator.clipboard");
        expect(script).toContain("writeText");
    });
});

describe("generateModalScript — Search button", () => {
    let script: string;

    beforeAll(() => {
        script = SelectionHandler.generateModalScript();
    });

    it("sends a searchText message with the selected text", () => {
        expect(script).toContain("type: 'searchText'");
    });

    it("passes state.selectedText as the search term", () => {
        expect(script).toContain("text: searchText");
    });
});

describe("generateModalScript — Remove button", () => {
    let script: string;

    beforeAll(() => {
        script = SelectionHandler.generateModalScript();
    });

    it("sends a deleteHighlight message with the highlight id", () => {
        expect(script).toContain("type: 'deleteHighlight'");
        expect(script).toContain("highlightId: state.highlightId");
    });

    it("only fires when isEditing and highlightId are both set", () => {
        // Guard: if (!state.isEditing || !state.highlightId) return
        expect(script).toContain("state.isEditing");
        expect(script).toContain("state.highlightId");
    });
});

// ===========================================================================
// 3. generateRemoveHighlightsScript
// ===========================================================================

describe("generateRemoveHighlightsScript", () => {
    let script: string;

    beforeAll(() => {
        script = SelectionHandler.generateRemoveHighlightsScript();
    });

    it("returns a non-empty string", () => {
        expect(script.length).toBeGreaterThan(0);
    });

    it("targets .user-highlight spans for removal", () => {
        expect(script).toContain(".user-highlight");
    });

    it("unwraps spans by moving child nodes to the parent", () => {
        expect(script).toContain("insertBefore");
        expect(script).toContain("removeChild");
    });

    it("normalizes adjacent text nodes after removal", () => {
        expect(script).toContain("normalize()");
    });

    it("wraps code in a try/catch", () => {
        expect(script).toContain("try {");
        expect(script).toContain("catch");
    });
});

// ===========================================================================
// 4. generatePruneHighlightsScript
// ===========================================================================

describe("generatePruneHighlightsScript", () => {
    it("returns a non-empty string", () => {
        expect(
            SelectionHandler.generatePruneHighlightsScript([]).length,
        ).toBeGreaterThan(0);
    });

    it("embeds the valid ids as JSON", () => {
        const script = SelectionHandler.generatePruneHighlightsScript([
            "abc",
            "def",
        ]);
        expect(script).toContain('["abc","def"]');
    });

    it("keeps spans whose id is in the valid set", () => {
        const script = SelectionHandler.generatePruneHighlightsScript(["abc"]);
        expect(script).toContain("data-highlight-id");
        expect(script).toContain("if (id && valid[id]) return;");
    });

    it("unwraps stale spans by moving child nodes to the parent", () => {
        const script = SelectionHandler.generatePruneHighlightsScript([]);
        expect(script).toContain(".user-highlight");
        expect(script).toContain("insertBefore");
        expect(script).toContain("removeChild");
    });

    it("normalizes text nodes only when something was removed", () => {
        const script = SelectionHandler.generatePruneHighlightsScript([]);
        expect(script).toContain("if (removedAny)");
        expect(script).toContain("normalize()");
    });

    it("wraps code in a try/catch", () => {
        const script = SelectionHandler.generatePruneHighlightsScript([]);
        expect(script).toContain("try {");
        expect(script).toContain("catch");
    });
});
