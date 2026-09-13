import { useEffect, useRef } from "react";
import { Linking } from "react-native";
import { useDatabase } from "../data/useDatabase";
import { navigationRef } from "../nav/ReaderNav";
import { parseScriptureLink } from "../util/scriptureLink";

// Handles Universal Links / App Links (and the rescriptures:// scheme) that point
// at a scripture reference, e.g.
//   https://scriptures.info/scriptures/cc/ether/1.2#2
//
// Resolves the URL's book synonym + chapter to a real chapter row, then navigates
// the reader to it — reusing the active screen the same way the chapter list does.
export function useScriptureDeepLink() {
    const { getCanonicalBook, getChapterByReference } = useDatabase();

    // Keep the latest (non-memoized) db helpers without re-subscribing the
    // Linking listener on every render.
    const dbRef = useRef({ getCanonicalBook, getChapterByReference });
    useEffect(() => {
        dbRef.current = { getCanonicalBook, getChapterByReference };
    });

    useEffect(() => {
        let cancelled = false;

        const openReference = async (url: string | null) => {
            const link = parseScriptureLink(url);
            if (!link) return;

            let bookId: string;
            try {
                bookId = await dbRef.current.getCanonicalBook(link.book);
            } catch {
                console.warn("Deep link: unknown book", link.book);
                return;
            }

            // "cc" biases resolution toward the Covenant of Christ volume for
            // books that also exist in the Book of Mormon; anything else pushes
            // cc last. Matches handleLinkPress() in the reader.
            const edition = link.volume === "cc" ? "CE" : "RE";
            const chapterData = await dbRef.current.getChapterByReference(
                bookId,
                link.chapter,
                edition,
            );
            if (!chapterData) {
                console.warn("Deep link: no chapter for", JSON.stringify(link));
                return;
            }

            const params = {
                volume_id: chapterData.volume_id,
                book_id: bookId,
                book_chapter: link.chapter,
                chapter_id: chapterData.chapter_id,
                name: chapterData.name,
                position: link.paragraph,
            };

            // On a cold start the nested stack navigator mounts a moment after
            // the container is ready (it shows a spinner while stores rehydrate).
            // Retry until the Reader is actually the current route.
            for (let attempt = 0; attempt < 15 && !cancelled; attempt++) {
                if (navigationRef.isReady()) {
                    // navigationRef has no static param map, so navigate is
                    // untyped here.
                    (
                        navigationRef.navigate as (
                            name: string,
                            params?: object,
                        ) => void
                    )("StackNav", { screen: "Reader", params });
                    if (navigationRef.getCurrentRoute()?.name === "Reader") {
                        return;
                    }
                }
                await new Promise((resolve) => setTimeout(resolve, 400));
            }
        };

        Linking.getInitialURL()
            .then(openReference)
            .catch(() => {});
        const subscription = Linking.addEventListener("url", (event) =>
            openReference(event.url),
        );

        return () => {
            cancelled = true;
            subscription.remove();
        };
    }, []);
}
