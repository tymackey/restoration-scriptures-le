import AsyncStorage from "@react-native-async-storage/async-storage";

const SEARCH_HISTORY_KEY = "@search_history";
const MAX_SEARCH_HISTORY = 10;

const DEFAULT_SEARCHES = [
    "Zebedee",
    "Ether 1:13",
    '"I will go and do"',
    "1 Nephi 1:12",
    "Matthew 2:34",
    "Genesis 6:1",
    "Psalms 100:5",
];

async function initializeSearchHistory() {
    try {
        const historyJson = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
        if (!historyJson) {
            // Only initialize if no history exists
            await AsyncStorage.setItem(
                SEARCH_HISTORY_KEY,
                JSON.stringify(DEFAULT_SEARCHES),
            );
        }
    } catch (e) {
        console.error("Error initializing search history: ", e);
    }
}

async function addToSearchHistory(searchTerm: string) {
    try {
        const historyJson = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
        let history: string[] = [];

        if (historyJson) {
            history = JSON.parse(historyJson);
        }

        // Remove the search term if it already exists
        history = history.filter((term) => term !== searchTerm);

        // Add the new search term to the beginning
        history.unshift(searchTerm);

        // Keep only the most recent searches
        history = history.slice(0, MAX_SEARCH_HISTORY);

        await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
        console.error("Error adding to search history: ", e);
    }
}

async function getSearchHistory(): Promise<string[]> {
    try {
        const historyJson = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
        if (historyJson) {
            return JSON.parse(historyJson);
        }
    } catch (e) {
        console.error("Error retrieving search history: ", e);
    }
    return [];
}

async function clearSearchHistory() {
    try {
        await AsyncStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch (e) {
        console.error("Error clearing search history: ", e);
    }
}

export {
    addToSearchHistory,
    getSearchHistory,
    clearSearchHistory,
    initializeSearchHistory,
};
