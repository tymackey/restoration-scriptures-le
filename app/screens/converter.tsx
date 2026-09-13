import { useState, useEffect, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    TextInput,
    ScrollView,
} from "react-native";
import {
    Provider,
    Portal,
    SegmentedButtons,
    Snackbar,
} from "react-native-paper";
import { useDatabase } from "../data/useDatabase";
import { Reference } from "../data/types";
import { colors } from "../constants/colors";
import { BookAutocomplete } from "../components/BookAutocomplete";
import { commonStyles } from "../styles/commonStyles";

const DirectionButtons = ({
    direction,
    onPress,
}: {
    direction: string;
    onPress: (value: string) => void;
}) => {
    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const buttonStyles = StyleSheet.create({
        container: {
            alignItems: "center",
            paddingBottom: 12,
        },
    });

    return (
        <View style={commonStyles.noFlex}>
            <View style={buttonStyles.container}>
                <SegmentedButtons
                    value={direction}
                    onValueChange={(value) => {
                        setSnackbarVisible(true);
                        onPress(value);
                    }}
                    buttons={[
                        {
                            value: "LE2RE",
                            label: "KJV/LDS to RE",
                            checkedColor: colors.white,
                            uncheckedColor: colors.white,
                            style: {
                                backgroundColor:
                                    direction === "LE2RE"
                                        ? colors.converterButtonBlue
                                        : "transparent",
                            }, // Blue background when checked
                        },
                        {
                            value: "RE2LE",
                            label: "RE to KJV/LDS",
                            checkedColor: colors.white,
                            uncheckedColor: colors.white,
                            style: {
                                backgroundColor:
                                    direction === "RE2LE"
                                        ? colors.converterButtonBlue
                                        : "transparent",
                            }, // Blue background when checked
                        },
                    ]}
                />
            </View>
            <Portal>
                <Snackbar
                    visible={snackbarVisible}
                    onDismiss={() => setSnackbarVisible(false)}
                    duration={2000}
                >
                    {direction === "LE2RE"
                        ? "Converting from Trad. Bible/LDS to Restoration Edition"
                        : "Converting from Restoration Edition to KJV/LDS"}
                </Snackbar>
            </Portal>
        </View>
    );
};

function ConverterScreen({ navigation }: { navigation: any }) {
    const {
        getCanonicalBook,
        getLEReferences,
        getREReferences,
        getBookReferenceName,
        getLDSBookNames,
        getREBookNames,
    } = useDatabase();
    const [direction, setDirection] = useState("LE2RE");
    const [reference, setReference] = useState("");
    const [chapter, setChapter] = useState("");
    const [verse, setVerse] = useState("");
    const [translatedReferences, setTranslatedReferences] = useState<
        Reference[]
    >([]);
    const [convertPressed, setConvertPressed] = useState(false);
    const [bookNames, setBookNames] = useState([]);
    const bookAutocompleteRef = useRef<any>(null);
    const chapterInputRef = useRef<TextInput>(null);
    const verseInputRef = useRef<TextInput>(null);

    useEffect(() => {
        const loadBookNames = async () => {
            try {
                const books = await (direction === "LE2RE"
                    ? getLDSBookNames()
                    : getREBookNames());
                const excludedWords = [
                    "foreword",
                    "canonization",
                    "dedication",
                    "preface",
                    "introduction",
                    "glossary",
                    "tow",
                ];
                const filteredBooks = books.filter((book) => {
                    const lowerName = book.name.toLowerCase();
                    return !excludedWords.some((word) =>
                        lowerName.includes(word),
                    );
                });

                // In RE2LE mode, replace individual TC books with a single "T&C" entry
                let processedBooks = filteredBooks;
                if (direction === "RE2LE") {
                    const hasTc = filteredBooks.some(
                        (book) => book.volume_id === "tc",
                    );
                    if (hasTc) {
                        processedBooks = [
                            ...filteredBooks.filter(
                                (book) => book.volume_id !== "tc",
                            ),
                            {
                                volume_id: "tc",
                                book_id: "section",
                                name: "T&C",
                            },
                        ];
                    }
                }

                // Make book names unique
                const uniqueBooks = Array.from(
                    new Map(
                        processedBooks.map((book) => [book.name, book]),
                    ).values(),
                );

                // Convert to autocomplete format
                // Use the book name as the ID since it's now unique with suffixes like (KJV), (RE), (LDS)
                const autocompleteData = uniqueBooks.map((book) => ({
                    id: book.name,
                    title: book.name + " ",
                }));

                setBookNames(autocompleteData);
            } catch (error) {
                console.error("Error loading book names:", error);
            }
        };
        loadBookNames();
    }, [getLDSBookNames, getREBookNames, direction]);

    const translateReference = async () => {
        setTranslatedReferences([]);

        // Combine book, chapter, and verse into a complete reference
        let fullReference = reference.trim();
        if (chapter) {
            fullReference += ` ${chapter}`;
            if (verse) {
                fullReference += `:${verse}`;
            }
        }

        const bookChapterParagraphRegExPattern =
            /^(?<book>[\w\s\.\&\-]*)\s+(?<chapter>\d+)(?:\s*:\s*(?<paragraphExpression>(?:\d+(?:\s*-\s*\d+)?)(?:\s*,\s*(?:\d+(?:\s*-\s*\d+)?))*))?$/;
        const found = fullReference.match(bookChapterParagraphRegExPattern);

        let book, book_id, book_chapter, position;
        if (found?.groups) {
            book = found.groups.book.replace(/[.]/g, "").toLowerCase();

            // Handle D&C and T&C
            if (book === "d&c" || book === "t&c") book = "section";

            try {
                book_id = await getCanonicalBook(book);
            } catch (error) {
                console.log("error: ", error);
                setReference("");
                setChapter("");
                setVerse("");
                return;
            }

            book_chapter = found.groups.chapter;
            position = found.groups.paragraphExpression?.split("-");

            let references: Reference[] = [];
            if (direction === "RE2LE") {
                references = await getLEReferences(
                    book_id,
                    parseInt(book_chapter),
                    parseInt(position?.[0]),
                    parseInt(position?.[1]),
                );
            } else {
                references = await getREReferences(
                    book_id,
                    parseInt(book_chapter),
                    parseInt(position?.[0]),
                    parseInt(position?.[1]),
                );
            }

            let translated = [];
            for (let r of references) {
                const bookName = await getBookReferenceName(
                    r.book_id || r.target_book || "",
                );
                const translatedBook = bookName.name;
                let label: string | undefined;

                if (direction === "RE2LE") {
                    label = `${translatedBook} ${r.is_complete_chapter ? r.target_chapter : r.verse_range}`;
                } else {
                    label = `${translatedBook} ${r.chapter}`;
                    if (r.start_paragraph && r.end_paragraph) {
                        label +=
                            r.end_paragraph !== r.start_paragraph
                                ? `:${r.start_paragraph}-${r.end_paragraph}`
                                : `:${r.start_paragraph}`;
                    }
                    label += r.volume_id === "cc" ? " CE" : " RE";
                }

                r.label = label;
                translated.push(r);
            }
            setConvertPressed(true);
            setTranslatedReferences(translated);
        }
    };

    const navigateToReference = async (item) => {
        navigation.navigate("Reader", {
            book_chapter: item.chapter,
            book_id: item.book_id,
            chapter_id: item.chapter_id,
            name: item.name,
            volume_id: item.volume_id,
            position: item.start_paragraph ?? item.paragraph,
        });
    };

    return (
        <Provider>
            <ScrollView
                style={styles.converterContainer}
                contentContainerStyle={styles.contentContainer}
                keyboardShouldPersistTaps="handled"
            >
                <DirectionButtons
                    direction={direction}
                    onPress={(value) => {
                        setDirection(value);
                        setTranslatedReferences([]);
                        setReference("");
                        bookAutocompleteRef.current?.clear();
                        setChapter("");
                        setVerse("");
                        setConvertPressed(false);
                        chapterInputRef.current?.blur();
                        verseInputRef.current?.blur();
                        bookAutocompleteRef.current?.focus();
                    }}
                />

                <View style={styles.fieldContainer}>
                    <Text style={styles.label}>
                        {direction === "LE2RE"
                            ? "KJV/LDS reference"
                            : "Restoration Edition reference"}
                    </Text>
                    <View style={styles.inputRow}>
                        <View style={styles.autocompleteWrapper}>
                            <BookAutocomplete
                                ref={bookAutocompleteRef}
                                value={reference}
                                bookList={bookNames}
                                onChangeText={(text) => {
                                    setReference(text);
                                    setTranslatedReferences([]);
                                }}
                                onSubmitEditing={translateReference}
                                onItemSelected={() => {
                                    setChapter(null);
                                    chapterInputRef.current?.focus();
                                }}
                                onClear={() => {
                                    setChapter("");
                                    setVerse("");
                                }}
                                inputStyle={styles.converterField}
                                showSearchIcon={true}
                                placeholder="Book"
                            />
                        </View>
                        <View style={styles.inputWrapper}>
                            <TextInput
                                ref={chapterInputRef}
                                style={styles.numericInput}
                                value={chapter}
                                onChangeText={setChapter}
                                keyboardType="numeric"
                                placeholder="Ch"
                                placeholderTextColor={colors.converterText}
                                onSubmitEditing={() => {
                                    setVerse(null);
                                    verseInputRef.current?.focus();
                                }}
                            />
                            <Text style={styles.colon}>:</Text>
                            <TextInput
                                ref={verseInputRef}
                                style={[styles.numericInput, styles.verseInput]}
                                value={verse}
                                onChangeText={setVerse}
                                keyboardType="numeric"
                                placeholder="Verse"
                                placeholderTextColor={colors.converterText}
                                onSubmitEditing={translateReference}
                            />
                        </View>
                    </View>
                </View>
                <View style={styles.exampleContainer}>
                    <Text style={styles.smaller}>
                        {(() => {
                            if (direction === "RE2LE") {
                                return "(like Gen 3:13-19 or Matt. 11 or 3 Ne. 5:1-15 or Abraham 3:2 or T&C 26 or TSJ 3:2-4 or Ep. Jacob 1:2)";
                            } else {
                                return `(like Isa. 29:1-2 or Matt. 24 or John 10:16 or 1 Ne 3:7-11,14 or D&C 110 or Moses 6:2-4 or JSH 1:23-30 or JST Gen. 14)`;
                            }
                        })()}
                    </Text>
                </View>
                <View style={styles.buttonContainer}>
                    <Pressable
                        style={styles.button}
                        onPress={() => translateReference()}
                    >
                        <Text style={styles.buttonText}>
                            Translate Reference
                        </Text>
                    </Pressable>
                </View>
                {convertPressed && (
                    <View>
                        {translatedReferences?.length > 0 ? (
                            <>
                                <Text style={styles.label}>
                                    Corresponding{" "}
                                    {direction === "RE2LE"
                                        ? "KJV/LDS"
                                        : "Restoration Edition"}{" "}
                                    reference(s)
                                </Text>
                                {translatedReferences.map((ref) => (
                                    <View key={ref.label}>
                                        {direction === "RE2LE" ? (
                                            <Text style={styles.referenceText}>
                                                {ref.label}
                                            </Text>
                                        ) : (
                                            <Pressable
                                                style={
                                                    styles.referencePressable
                                                }
                                                onPress={() =>
                                                    navigateToReference(ref)
                                                }
                                            >
                                                <Text
                                                    style={styles.referenceLink}
                                                >
                                                    {ref.label}
                                                </Text>
                                            </Pressable>
                                        )}
                                    </View>
                                ))}
                            </>
                        ) : (
                            <Text style={styles.empty}>
                                No corresponding references found.
                            </Text>
                        )}
                    </View>
                )}
            </ScrollView>
        </Provider>
    );
}

const styles = StyleSheet.create({
    converterContainer: {
        backgroundColor: colors.background,
        flex: 1,
        margin: 0,
    },
    contentContainer: {
        padding: 8,
        flexGrow: 1,
    },
    fieldContainer: {
        paddingBottom: 8,
        paddingRight: 8,
        overflow: "visible",
    },
    exampleContainer: {
        paddingBottom: 8,
    },
    buttonContainer: {
        paddingBottom: 16,
    },
    inputRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 8,
        overflow: "visible",
    },
    autocompleteWrapper: {
        width: "50%",
        alignSelf: "center",
        marginTop: -1,
        zIndex: 1000,
    },
    inputWrapper: {
        width: "50%",
        flexDirection: "row",
        justifyContent: "space-evenly",
        alignItems: "center",
        gap: 8,
    },
    numericInput: {
        flex: 1,
        backgroundColor: colors.background,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.converterBorder,
        marginBottom: 4,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 16,
        color: colors.white,
        height: 44,
        minWidth: 60,
        textAlign: "center",
    },
    verseInput: {
        flex: 1,
        minWidth: 70,
    },
    colon: {
        color: colors.white,
        fontSize: 20,
        fontWeight: "bold",
        width: 6,
        marginTop: -4,
    },
    label: {
        color: colors.converterText,
        fontSize: 20,
        fontWeight: "bold",
        marginVertical: 4,
    },
    smaller: {
        color: colors.converterText,
        fontSize: 16,
    },
    converterField: {
        backgroundColor: colors.background,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.converterBorder,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 16,
        color: colors.white,
        height: 44,
        elevation: 3,
        shadowColor: colors.black,
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.23,
        shadowRadius: 2.62,
    },
    referencePressable: {
        paddingVertical: 8,
    },
    referenceText: {
        color: colors.converterText,
        fontSize: 18,
    },
    referenceLink: {
        color: colors.converterLinkBlue, // WCAG 2.1 Contrast Compliant from Background #383838
        fontSize: 18,
    },
    empty: {
        fontSize: 18,
        fontStyle: "italic",
        color: colors.converterText,
    },
    button: {
        backgroundColor: colors.converterButtonBlue,
        padding: 10,
        borderRadius: 5,
        marginTop: 4,
        marginBottom: 4,
        alignItems: "center",
    },
    buttonText: {
        color: colors.white,
        fontSize: 18,
        fontWeight: "bold",
    },
});

export default ConverterScreen;
