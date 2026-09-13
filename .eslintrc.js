// https://docs.expo.dev/guides/using-eslint/
module.exports = {
    extends: ["expo", "prettier"],
    plugins: ["prettier", "react-native", "react-compiler"],
    ignorePatterns: ["/dist/*"],
    rules: {
        "prettier/prettier": "error",
        "react-native/no-unused-styles": "error",
        "react-native/no-inline-styles": "error",
        "react-native/no-color-literals": "error",
        "react-native/no-raw-text": "error",
        "react-native/no-single-element-style-arrays": "error",
        "react-compiler/react-compiler": "error",
    },
};
