/**
 * Unit tests for readerScripts — functions that build JavaScript strings
 * injected into the WebView.
 *
 * These tests verify the generated strings contain the expected code
 * fragments without executing them in a browser context.
 *
 * Covered:
 *   buildLinkInjectedJavaScript — page zone scroll (top/bottom), double-tap
 *     debounce, left/right edge navigation, duplicate-listener guard,
 *     highlight/link click priority.
 */

import { buildLinkInjectedJavaScript } from "../readerScripts";

// ── helpers ───────────────────────────────────────────────────────────────────

function script(isIOS = false) {
    return buildLinkInjectedJavaScript(isIOS);
}

// ── duplicate-listener guard ──────────────────────────────────────────────────

describe("duplicate-listener guard", () => {
    it("checks __clickHandlerInitialized before adding listeners", () => {
        expect(script()).toContain("__clickHandlerInitialized");
    });

    it("sets __clickHandlerInitialized = true after first run", () => {
        expect(script()).toMatch(/__clickHandlerInitialized\s*=\s*true/);
    });
});

// ── page zone constants ───────────────────────────────────────────────────────

describe("page zone constants", () => {
    it("defines PAGE_ZONE as 0.28", () => {
        expect(script()).toMatch(/PAGE_ZONE\s*=\s*0\.28/);
    });

    it("defines DOUBLE_TAP_MS as 300", () => {
        expect(script()).toMatch(/DOUBLE_TAP_MS\s*=\s*300/);
    });

    it("initialises lastZoneClickTime to 0", () => {
        expect(script()).toMatch(/lastZoneClickTime\s*=\s*0/);
    });

    it("initialises pendingPageScroll to null", () => {
        expect(script()).toMatch(/pendingPageScroll\s*=\s*null/);
    });
});

// ── zone detection ────────────────────────────────────────────────────────────

describe("zone detection", () => {
    it("detects top zone as clickY < screenHeight * PAGE_ZONE", () => {
        expect(script()).toContain("clickY < screenHeight * PAGE_ZONE");
    });

    it("detects bottom zone as clickY > screenHeight * (1 - PAGE_ZONE)", () => {
        expect(script()).toContain("clickY > screenHeight * (1 - PAGE_ZONE)");
    });

    it("only enters zone logic when isTopZone or isBottomZone", () => {
        expect(script()).toContain("if (isTopZone || isBottomZone)");
    });
});

// ── double-tap debounce ───────────────────────────────────────────────────────

describe("double-tap debounce", () => {
    it("cancels pending scroll when second tap arrives within DOUBLE_TAP_MS", () => {
        const s = script();
        expect(s).toContain("pendingPageScroll !== null");
        expect(s).toContain("now - lastZoneClickTime");
        expect(s).toContain("< DOUBLE_TAP_MS");
    });

    it("clears the pending timeout on double-tap", () => {
        expect(script()).toContain("clearTimeout(pendingPageScroll)");
    });

    it("delays the scroll by DOUBLE_TAP_MS via setTimeout", () => {
        expect(script()).toMatch(/setTimeout\(function\(\)/);
        expect(script()).toContain("DOUBLE_TAP_MS");
    });

    it("resets pendingPageScroll to null before calling smoothPageScroll", () => {
        expect(script()).toMatch(
            /pendingPageScroll\s*=\s*null;\s*smoothPageScroll/,
        );
    });
});

// ── scroll direction and animation ───────────────────────────────────────────

describe("scroll direction and animation", () => {
    it("scrolls up (negative window.innerHeight) for top zone", () => {
        expect(script()).toContain("-window.innerHeight");
    });

    it("scrolls down (positive window.innerHeight) for bottom zone", () => {
        expect(script()).toMatch(
            /scrollAmount\s*=\s*isTopZone\s*\?\s*-window\.innerHeight\s*\+\s*ROW_HEIGHT\s*:\s*window\.innerHeight\s*-\s*ROW_HEIGHT/,
        );
    });

    it("uses a custom smoothPageScroll function instead of behavior:smooth", () => {
        const s = script();
        expect(s).toContain("smoothPageScroll");
        expect(s).not.toContain("behavior: 'smooth'");
    });

    it("smoothPageScroll uses requestAnimationFrame", () => {
        expect(script()).toContain("requestAnimationFrame");
    });

    it("smoothPageScroll completes in 180ms", () => {
        expect(script()).toContain("duration = 180");
    });

    it("smoothPageScroll uses a cubic ease-out curve", () => {
        expect(script()).toContain("Math.pow(1 - t, 3)");
    });
});

// ── left/right edge navigation ────────────────────────────────────────────────

describe("left/right edge navigation", () => {
    it("defines EDGE_WIDTH of 50px", () => {
        expect(script()).toMatch(/EDGE_WIDTH\s*=\s*50/);
    });

    it('posts "previous" message on left-edge tap', () => {
        const s = script();
        expect(s).toContain("direction: 'previous'");
        expect(s).toContain("clickX < EDGE_WIDTH");
    });

    it('posts "next" message on right-edge tap', () => {
        const s = script();
        expect(s).toContain("direction: 'next'");
        expect(s).toContain("clickX > screenWidth - EDGE_WIDTH");
    });

    it("restricts edge navigation to the middle 80% of screen height", () => {
        expect(script()).toContain("screenHeight * 0.1");
    });
});

// ── highlight and link click priority ────────────────────────────────────────

describe("highlight and link click priority", () => {
    it("checks for user-highlight before zone scroll logic", () => {
        const s = script();
        // isTopZone is the point where zone logic executes inside the click handler
        const hlIdx = s.indexOf("user-highlight");
        const zoneIdx = s.indexOf("isTopZone");
        expect(hlIdx).toBeGreaterThan(-1);
        expect(hlIdx).toBeLessThan(zoneIdx);
    });

    it("checks for link before zone scroll logic", () => {
        const s = script();
        const linkIdx = s.indexOf("type: 'link'");
        const zoneIdx = s.indexOf("isTopZone");
        expect(linkIdx).toBeGreaterThan(-1);
        expect(linkIdx).toBeLessThan(zoneIdx);
    });
});
