import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { useState, useEffect } from "react";
import VolumeList from "../components/VolumeList";
import { useDatabase } from "../data/useDatabase";
import { Book } from "../data/types";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { colors } from "../constants/colors";

type TabParamList = {
    "New Testament": { books: Book[] };
    "Book of Mormon": { books: Book[] };
};

const Tab = createMaterialTopTabNavigator<TabParamList>();

export default function NewCovenantsScreen() {
    const { getBooks } = useDatabase();
    const [ntBooks, setNtBooks] = useState<Book[]>([]);
    const [bomBooks, setBomBooks] = useState<Book[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBooks = async () => {
            try {
                setLoading(true);
                const [ntData, bomData] = await Promise.all([
                    getBooks("nt"),
                    getBooks("bofm"),
                ]);
                setNtBooks(ntData);
                setBomBooks(bomData);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchBooks();
    }, [getBooks]);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="blue" />
            </View>
        );
    }

    return (
        <Tab.Navigator
            id={undefined}
            initialRouteName="New Testament"
            screenOptions={{
                tabBarStyle: {
                    backgroundColor: colors.background,
                },
                tabBarLabelStyle: {
                    color: colors.text,
                },
            }}
        >
            <Tab.Screen
                name="New Testament"
                component={NewTestamentScreen}
                initialParams={{ books: ntBooks }}
            />
            <Tab.Screen
                name="Book of Mormon"
                component={BookofMormonScreen}
                initialParams={{ books: bomBooks }}
            />
        </Tab.Navigator>
    );
}

function NewTestamentScreen({
    route,
}: {
    route: { params: { books: Book[] } };
}) {
    return <VolumeList items={route.params.books} />;
}

function BookofMormonScreen({
    route,
}: {
    route: { params: { books: Book[] } };
}) {
    const { books } = route.params;
    return <VolumeList items={books} />;
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
});
