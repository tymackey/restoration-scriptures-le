import { colors } from "../constants/colors";
import {
    ScrollView,
    Text,
    StyleSheet,
    Linking,
    TouchableOpacity,
} from "react-native";

function LicenseScreen() {
    const openURL = (url: string) => {
        Linking.openURL(url).catch((err) =>
            console.error("Failed to open URL:", err),
        );
    };

    return (
        <ScrollView style={styles.container}>
            <Text style={styles.text}>
                © 2020 Restoration Scriptures Foundation. All rights reserved.
                Restoration Scriptures Foundation is a trademark of Restoration
                Archive LLC. First Edition, First Printing.
            </Text>
            <Text style={styles.text}>
                The titles of the three volumes are trademarked and may not be
                used in any way without the consent of the trademark owner,
                Restoration Scriptures Foundation.
            </Text>
            <Text style={styles.text}>
                The cover art is copyrighted and all rights are reserved, and
                may not be used in any way without the consent of the copyright
                holder. © 2019 Restoration Scriptures Foundation
            </Text>
            <Text style={styles.text}>
                The Timeline is copyrighted and all rights are reserved, and may
                not be used in any way without the consent of the copyright
                holder. © 2019 Restoration Scriptures Foundation
            </Text>
            <Text style={styles.text}>
                The maps are copyrighted and all rights are reserved, and may
                not be used in any way without the consent of the copyright
                holder. © 2019 Sara Lohmeier
            </Text>

            <Text style={styles.text}>
                Reprinted with permission from{" "}
                <TouchableOpacity
                    onPress={() =>
                        openURL("https://scriptures.info/Home/License")
                    }
                >
                    <Text style={styles.link}>
                        https://scriptures.info/Home/License
                    </Text>
                </TouchableOpacity>
            </Text>

            <TouchableOpacity
                onPress={() =>
                    openURL("https://scriptures.info/scriptures/changetracking")
                }
            >
                <Text style={styles.link}>
                    © 2026 Scriptures.info - Text V2.006 - 2026.05.11
                </Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

export default LicenseScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        padding: 20,
        paddingBottom: 100,
    },
    text: {
        color: colors.white,
        fontSize: 18,
        marginBottom: 16,
    },
    link: {
        color: colors.linkBlue, // Blue color for links
        fontSize: 18,
        textDecorationLine: "underline",
    },
});
