import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";

/**
 * The reader's custom fonts. Previously these were inlined into every chapter
 * document as ~350 KB of base64 `@font-face` data, which the WebView had to
 * re-parse and re-decode on every `source` swap — the dominant cost when
 * switching screens/chapters, even for cached HTML.
 *
 * Instead we copy the bundled font files into one dedicated directory and
 * reference them by `file://` URI. The per-chapter document shrinks ~60×, and
 * the WebView caches each font file across reloads (same URL), so it never
 * re-decodes them.
 */
const FONT_MODULES: { family: string; ext: string; module: number }[] = [
    {
        family: "Assistant-Regular",
        ext: "ttf",
        module: require("../../assets/fonts/Assistant-Regular.ttf"),
    },
    {
        family: "EBGaramond-Regular",
        ext: "ttf",
        module: require("../../assets/fonts/EBGaramond-Regular.ttf"),
    },
    {
        family: "OpenDyslexic-Regular",
        ext: "otf",
        module: require("../../assets/fonts/OpenDyslexic-Regular.otf"),
    },
];

// One dedicated directory so every font's file:// URI shares a parent. On iOS
// this directory is passed as the WebView `baseUrl`; that is what grants
// WKWebView read access to file:// subresources loaded from an HTML-string
// document (Android loads them directly without a baseUrl).
const FONTS_DIR = `${FileSystem.cacheDirectory}webview-fonts/`;

// The resolved @font-face CSS never changes for a given install, so build it
// once and reuse it for every chapter document.
let cachedCss: string | null = null;

/**
 * Directory (file:// URI) holding the copied font files. Used as the iOS
 * WebView `baseUrl` so WKWebView will load the referenced fonts.
 */
export function getFontsBaseUrl(): string {
    return FONTS_DIR;
}

/**
 * Copies the bundled font assets into {@link FONTS_DIR} (once) and returns the
 * `@font-face` CSS that references them by file:// URI. Falls back to an empty
 * string (system fonts) if the assets can't be prepared, so a font-loading
 * failure never blocks rendering.
 */
export async function getFontFaceCss(): Promise<string> {
    if (cachedCss !== null) return cachedCss;
    try {
        await FileSystem.makeDirectoryAsync(FONTS_DIR, {
            intermediates: true,
        }).catch(() => {});

        const blocks = await Promise.all(
            FONT_MODULES.map(async ({ family, ext, module }) => {
                const dest = `${FONTS_DIR}${family}.${ext}`;
                const info = await FileSystem.getInfoAsync(dest);
                if (!info.exists) {
                    const asset = Asset.fromModule(module);
                    if (!asset.localUri) await asset.downloadAsync();
                    await FileSystem.copyAsync({
                        from: asset.localUri as string,
                        to: dest,
                    });
                }
                return `@font-face{font-family:'${family}';src:url('${dest}');font-display:swap;}`;
            }),
        );
        cachedCss = blocks.join("\n");
    } catch (error) {
        console.error("FontLoader: failed to prepare fonts:", error);
        cachedCss = "";
    }
    return cachedCss;
}

/** Test-only: clears the memoized CSS so each test resolves fresh. */
export function _resetFontCache(): void {
    cachedCss = null;
}
