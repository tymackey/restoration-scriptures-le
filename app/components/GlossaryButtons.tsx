import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Chapter } from "../data/types";
import { colors } from "../constants/colors";

export default function GlossaryButtons({
    glossaryTerms,
    scrollToLetter,
}: {
    glossaryTerms: Chapter[];
    scrollToLetter: (letter: string) => void;
}) {
    // Create a Set of letters that have corresponding terms
    const usedLetters = new Set(
        glossaryTerms
            .map((term) => term.name.charAt(0).toUpperCase())
            .filter((letter) => /[A-Z]/.test(letter)),
    );

    // Sort the letters alphabetically
    const alphabet = Array.from(usedLetters).sort();

    return (
        <View style={styles.alphabetContainer}>
            {alphabet.map((letter) => (
                <TouchableOpacity
                    key={letter}
                    style={styles.letterButton}
                    onPress={() => scrollToLetter(letter)}
                >
                    <Text style={styles.letterText}>{letter}</Text>
                </TouchableOpacity>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    alphabetContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "center",
        paddingHorizontal: 10,
        paddingVertical: 5,
        backgroundColor: colors.background,
    },
    letterButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        margin: 8,
        backgroundColor: colors.converterSuggestionBg,
        borderRadius: 4,
        minWidth: 35,
        alignItems: "center",
    },
    letterText: {
        color: colors.text,
        fontSize: 14,
        fontWeight: "500",
    },
});
