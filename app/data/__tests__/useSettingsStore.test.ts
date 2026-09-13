import { useSettingsStore } from "../useSettingsStore";

// Reset font size to default before each test so tests don't bleed into each other
beforeEach(() => {
    useSettingsStore.setState({ fontSize: 18 });
});

// ── setFontSize ───────────────────────────────────────────────────────────────

describe("setFontSize", () => {
    it("sets font size to a value within range", () => {
        useSettingsStore.getState().setFontSize(22);
        expect(useSettingsStore.getState().fontSize).toBe(22);
    });

    it("accepts exactly the minimum (16)", () => {
        useSettingsStore.getState().setFontSize(16);
        expect(useSettingsStore.getState().fontSize).toBe(16);
    });

    it("accepts exactly the maximum (40)", () => {
        useSettingsStore.getState().setFontSize(40);
        expect(useSettingsStore.getState().fontSize).toBe(40);
    });

    it("clamps to 16 when given a value below the minimum", () => {
        useSettingsStore.getState().setFontSize(10);
        expect(useSettingsStore.getState().fontSize).toBe(16);
    });

    it("clamps to 40 when given a value above the maximum", () => {
        useSettingsStore.getState().setFontSize(50);
        expect(useSettingsStore.getState().fontSize).toBe(40);
    });

    it("clamps 0 to 16", () => {
        useSettingsStore.getState().setFontSize(0);
        expect(useSettingsStore.getState().fontSize).toBe(16);
    });

    it("clamps negative values to 16", () => {
        useSettingsStore.getState().setFontSize(-5);
        expect(useSettingsStore.getState().fontSize).toBe(16);
    });
});

// ── increaseFontSize ──────────────────────────────────────────────────────────

describe("increaseFontSize", () => {
    it("increments by 1", () => {
        useSettingsStore.setState({ fontSize: 20 });
        useSettingsStore.getState().increaseFontSize();
        expect(useSettingsStore.getState().fontSize).toBe(21);
    });

    it("does not exceed maximum (40)", () => {
        useSettingsStore.setState({ fontSize: 40 });
        useSettingsStore.getState().increaseFontSize();
        expect(useSettingsStore.getState().fontSize).toBe(40);
    });

    it("steps up from 39 to 40", () => {
        useSettingsStore.setState({ fontSize: 39 });
        useSettingsStore.getState().increaseFontSize();
        expect(useSettingsStore.getState().fontSize).toBe(40);
    });
});

// ── decreaseFontSize ──────────────────────────────────────────────────────────

describe("decreaseFontSize", () => {
    it("decrements by 1", () => {
        useSettingsStore.setState({ fontSize: 20 });
        useSettingsStore.getState().decreaseFontSize();
        expect(useSettingsStore.getState().fontSize).toBe(19);
    });

    it("does not go below minimum (16)", () => {
        useSettingsStore.setState({ fontSize: 16 });
        useSettingsStore.getState().decreaseFontSize();
        expect(useSettingsStore.getState().fontSize).toBe(16);
    });

    it("steps down from 17 to 16", () => {
        useSettingsStore.setState({ fontSize: 17 });
        useSettingsStore.getState().decreaseFontSize();
        expect(useSettingsStore.getState().fontSize).toBe(16);
    });
});

// ── pinch gesture font size computation ───────────────────────────────────────
//
// The pinch handler in reader.tsx does:
//   const next = Math.round(pinchStartFontSize.value * e.scale);
//   runOnJS(setFontSize)(next);
//
// These tests verify the full pipeline: scale factor → round → clamp.

describe("pinch gesture — font size computation", () => {
    it.each([
        // [startFontSize, scale, expectedResult]
        [18, 1.0, 18], // no movement
        [18, 1.5, 27], // moderate zoom in
        [18, 2.0, 36], // strong zoom in
        [20, 2.0, 40], // reaches maximum exactly
        [20, 2.5, 40], // clamps to maximum
        [40, 1.5, 40], // already at max, stays there
        [18, 0.89, 16], // 18*0.89=16.02 → round=16, at minimum
        [18, 0.8, 16], // 18*0.8=14.4 → round=14 → clamps to 16
        [18, 0.5, 16], // clamps to minimum
        [16, 0.5, 16], // already at min, stays there
        [24, 1.25, 30], // intermediate value
        [30, 1.34, 40], // 30*1.34=40.2 → round=40, at maximum
    ])("start=%i × scale=%s → fontSize %i", (start, scale, expected) => {
        const raw = Math.round(start * scale);
        useSettingsStore.getState().setFontSize(raw);
        expect(useSettingsStore.getState().fontSize).toBe(expected);
    });
});
