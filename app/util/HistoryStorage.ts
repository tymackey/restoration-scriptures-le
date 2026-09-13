import AsyncStorage from "@react-native-async-storage/async-storage";

async function addToHistory(
    volume: string,
    book: string,
    chapter: string,
    paragraph: string,
    name: string,
    chapter_id: string,
) {
    try {
        await AsyncStorage.getItem("@history").then((historyJson) => {
            let datetime = new Date().toJSON();
            let history = [];
            if (historyJson) {
                history = JSON.parse(historyJson);
            }

            let existingIndex = history.findIndex(
                (h) => h.chapter_id === chapter_id,
            );
            if (existingIndex !== -1) {
                history = history.toSpliced(existingIndex, 1);
            }
            history.unshift({
                volume,
                book,
                chapter,
                paragraph,
                name,
                datetime,
                chapter_id,
            });
            AsyncStorage.setItem(
                "@history",
                JSON.stringify(history.slice(0, 30)),
            );
        });
    } catch (e) {
        console.error("Error adding to history: ", e);
    }
}

async function getHistory() {
    let history = undefined;
    try {
        await AsyncStorage.getItem("@history").then((historyJson) => {
            if (historyJson) {
                history = JSON.parse(historyJson);
            }
        });
    } catch (e) {
        console.error("Error retrieving history: ", e);
    }
    return history;
}

async function clearHistory() {
    try {
        await AsyncStorage.removeItem("@history");
    } catch (e) {
        console.error("Error clearing history: ", e);
    }
}

export { addToHistory, getHistory, clearHistory };
