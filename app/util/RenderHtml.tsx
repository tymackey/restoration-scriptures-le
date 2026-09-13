import React from "react";
import { Text, View, StyleSheet } from "react-native";
import { parseDocument, ElementType } from "htmlparser2";
import { colors } from "../constants/colors";

// Styles are referenced dynamically via styles[elName], which the
// no-unused-styles rule cannot statically detect.
/* eslint-disable react-native/no-unused-styles */
const styles = StyleSheet.create({
    chapter: {
        flex: 1,
        width: "100%",
        height: "100%",
        flexWrap: "wrap",
        marginVertical: 2,
        textAlign: "center",
    },
    h1: {
        textAlign: "center",
        color: colors.text,
    },
    h3: {
        width: "100%",
        textAlign: "center",
        display: "flex",
        justifyContent: "center",
        color: colors.text,
        fontSize: 12,
    },
    li: {
        textAlign: "left",
        color: colors.text,
    },
    p: {
        textAlign: "left",
        color: colors.text,
    },
    i: {
        fontStyle: "italic",
        textAlign: "left",
        color: colors.text,
    },
});

export default function RenderHtml({ html }: { html: string }) {
    const ignoredTags = ["chapter"];
    const textTags = ["h3", "h1", "li", "p", "i"];

    const renderTextNode = (textNode: any, index: number, elName: string) => {
        return (
            <Text key={index} style={styles[elName]}>
                {textNode.data}
            </Text>
        );
    };

    const renderElement = (element: any, index: number) => {
        const isText = textTags.indexOf(element.name) > -1;
        const Wrapper: React.ElementType = isText ? Text : View;
        return (
            <Wrapper key={index}>
                {element.children.map((c, i) => renderNode(c, i, element.name))}
            </Wrapper>
        );
    };

    const renderNode = (node: any, index: number, elName: string) => {
        switch (node.type) {
            case ElementType.Text:
                return renderTextNode(node, index, elName);
            case ElementType.Tag:
                return renderElement(node, index);
            default:
                return null;
        }
    };

    html = html.replace(/(LEChapter\d+|Verse\d+|VerseEnd)/g, "").trim();
    html = html.replace(/<h3 class="chap">.*<\/h3>/g, "").trim();
    const document = parseDocument(html);
    return (
        <>
            {document.children.map((c: any, i: number) =>
                renderNode(c, i, "p"),
            )}
        </>
    );
}
