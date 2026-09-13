import { StyleSheet } from "react-native";

// Shared single-purpose style primitives used across screens, extracted to
// satisfy the no-inline-styles rule. (This file has no JSX, so it is not
// subject to no-unused-styles.)
export const commonStyles = StyleSheet.create({
    fill: { flex: 1 },
    noFlex: { flex: 0 },
    noGrow: { flexGrow: 0 },
    noHorizontalPadding: { paddingHorizontal: 0 },
    noPaddingMargin: { padding: 0, margin: 0 },
    alignEnd: { alignItems: "flex-end" },
    displayFlex: { display: "flex" },
    displayNone: { display: "none" },
    centerSelf: { alignSelf: "center", marginHorizontal: "auto" },
    italic: { fontStyle: "italic" },
});
