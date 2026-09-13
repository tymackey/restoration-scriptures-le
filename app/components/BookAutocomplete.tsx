import {
    useState,
    useEffect,
    useRef,
    forwardRef,
    useImperativeHandle,
} from "react";
import { View, StyleSheet, Platform, Text } from "react-native";
import { AutocompleteDropdown } from "react-native-autocomplete-dropdown";
import { useDatabase } from "../data/useDatabase";
import { colors } from "../constants/colors";
import { FontAwesome } from "@expo/vector-icons";

interface BookAutocompleteProps {
    value: string;
    bookList: { id: string; title: string }[];
    onChangeText: (text: string) => void;
    placeholder?: string;
    style?: any;
    inputStyle?: any;
    containerStyle?: any;
    onSubmitEditing?: () => void;
    onItemSelected?: () => void;
    onClear?: () => void;
    showSearchIcon?: boolean;
    placeholderTextColor?: string;
}

export const BookAutocomplete = forwardRef<any, BookAutocompleteProps>(
    (
        {
            value,
            bookList,
            onChangeText,
            placeholder = "Search...",
            style,
            inputStyle,
            containerStyle,
            onSubmitEditing,
            onItemSelected,
            onClear,
            showSearchIcon = false,
            placeholderTextColor,
        },
        ref,
    ) => {
        // const { getAllBookNames } = useDatabase();
        const [dataSet, setDataSet] = useState<
            { id: string; title: string }[] | null
        >(null);
        // const [allBooks, setAllBooks] = useState<{ id: string; title: string }[]>(
        // [],
        // );
        const [selectedItem, setSelectedItem] = useState(null);
        const dropdownController = useRef<any>(null);

        // Expose methods to parent component via ref
        useImperativeHandle(ref, () => ({
            clear: () => {
                setSelectedItem(null);
                setDataSet(null);
                dropdownController.current?.clear();
                dropdownController.current?.close();
            },
            focus: () => {
                dropdownController.current?.open();
            },
        }));

        // Load all book names on component mount
        // useEffect(() => {
        //     const loadBookNames = async () => {
        //         try {
        //             const books = await getAllBookNames();
        //             const excludedWords = [
        //                 "foreword",
        //                 "canonization",
        //                 "dedication",
        //                 "preface",
        //                 "introduction",
        //                 "glossary",
        //             ];
        //             const filteredBooks = books.filter((book) => {
        //                 const lowerName = book.name.toLowerCase();
        //                 return !excludedWords.some((word) =>
        //                     lowerName.includes(word),
        //                 );
        //             });
        //
        //             // Make book names unique
        //             const uniqueBooks = Array.from(
        //                 new Map(
        //                     filteredBooks.map((book) => [book.name, book]),
        //                 ).values(),
        //             );
        //
        //             // Convert to autocomplete format
        //             // Use the book name as the ID since it's now unique with suffixes like (KJV), (RE), (LDS)
        //             const autocompleteData = uniqueBooks.map((book) => ({
        //                 id: book.name,
        //                 title: book.name + " ",
        //             }));
        //
        //             setAllBooks(autocompleteData);
        //         } catch (error) {
        //             console.error("Error loading book names:", error);
        //         }
        //     };
        //     loadBookNames();
        // }, [getAllBookNames]);

        const handleSelectItem = (item: any) => {
            if (item) {
                setSelectedItem(item.title);
                onChangeText(item.title);
                setDataSet(null);
                dropdownController.current?.close();

                // Call the callback to focus the next field (if provided)
                if (onItemSelected) {
                    onItemSelected();
                } else {
                    dropdownController.current?.focus();
                }
            }
        };

        const handleChangeText = (text: string) => {
            onChangeText(text);

            // Clear selectedItem if user modifies the text
            if (selectedItem && !text.startsWith(selectedItem.trim())) {
                setSelectedItem(null);
            }

            // Only show suggestions if the field does NOT contain a space at the end
            // and no item has been selected
            const hasBook = /\s+$/.test(text);

            if (text.length === 0 || hasBook || selectedItem) {
                setDataSet(null);
                dropdownController.current?.close();
            } else {
                // Filter manually based on text input
                const bookMatch = text.match(/^([0-9a-zA-Z\s\.\&\-]+)/);
                if (bookMatch) {
                    const bookQuery = bookMatch[1].trim().toLowerCase();
                    let filtered = bookList?.filter((book) =>
                        book.title
                            .toLowerCase()
                            .split(" ")
                            .some((t) => t.startsWith(bookQuery)),
                    );
                    if (filtered.length) {
                        console.log(filtered);
                        filtered = filtered
                            // .filter(
                            //     (i: { id: string; title: string }) =>
                            //         i.title !== selectedItem.title
                            // )
                            .slice(0, 8);
                        setDataSet(filtered); // Limit to 8 suggestions
                    } else {
                        setDataSet(null);
                    }
                } else {
                    setDataSet(null);
                }
            }
        };

        const handleClearSelection = () => {
            setSelectedItem(null);
            if (onClear) {
                onClear();
            }
        };

        return (
            <View style={[styles.container, style]}>
                {showSearchIcon && (
                    <FontAwesome
                        name="search"
                        size={24}
                        color={colors.white}
                        style={styles.searchIcon}
                    />
                )}
                <AutocompleteDropdown
                    ref={dropdownController}
                    controller={(controller) => {
                        dropdownController.current = controller;
                    }}
                    dataSet={dataSet}
                    onChangeText={handleChangeText}
                    onSelectItem={handleSelectItem}
                    onClear={handleClearSelection}
                    textInputProps={{
                        placeholder: placeholder,
                        placeholderTextColor:
                            placeholderTextColor || colors.converterText,
                        autoCorrect: false,
                        autoComplete: "off",
                        spellCheck: false,
                        returnKeyType: "search",
                        onSubmitEditing: onSubmitEditing,
                        style: {
                            color: colors.white,
                            paddingLeft: showSearchIcon ? 48 : 16,
                            paddingRight: 48,
                            flex: 1,
                            width: "100%",
                        },
                    }}
                    inputContainerStyle={[
                        styles.inputContainer,
                        inputStyle,
                        styles.zeroPadding,
                    ]}
                    suggestionsListContainerStyle={
                        styles.suggestionsListContainer
                    }
                    suggestionsListTextStyle={styles.suggestionText}
                    suggestionsListMaxHeight={420}
                    containerStyle={[
                        styles.autocompleteContainer,
                        containerStyle,
                    ]}
                    rightButtonsContainerStyle={
                        styles.rightButtonsContainerStyle
                    }
                    clearOnFocus={false}
                    closeOnBlur={true}
                    closeOnSubmit={false}
                    showChevron={false}
                    useFilter={false}
                    debounce={100}
                    matchFrom="start"
                />
            </View>
        );
    },
);

const styles = StyleSheet.create({
    zeroPadding: {
        // Override any padding from inputStyle as padding is handled in textInputProps
        paddingHorizontal: 0,
        paddingVertical: 0,
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
    },
    container: {
        position: "relative",
        zIndex: 1001,
        ...Platform.select({
            android: {
                elevation: 10,
            },
        }),
    },
    searchIcon: {
        position: "absolute",
        left: 16,
        zIndex: 2,
        top: 10,
    },
    autocompleteContainer: {
        flex: 1,
    },
    inputContainer: {
        height: 44,
        borderRadius: 4,
        paddingLeft: 0,
        paddingRight: 0,
        backgroundColor: colors.transparent,
    },
    rightButtonsContainerStyle: {
        padding: 0,
        alignSelf: "center",
    },
    suggestionsListContainer: {
        backgroundColor: colors.converterSuggestionBg,
        borderColor: colors.converterBorder,
        borderWidth: 1,
        borderTopWidth: 0,
    },
    suggestionText: {
        color: colors.converterText,
        fontSize: 16,
        padding: 12,
    },
});
