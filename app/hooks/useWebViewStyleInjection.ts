import { useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import WebView from "react-native-webview";
import { colorSchemeOf } from "../util/readerScripts";

interface StyleInjectionParams {
    webviewRef: React.RefObject<WebView>;
    backgroundColor: string;
    foregroundColor: string;
    markerColor: string;
    fontSize: number;
    alignment: string;
    fontFamily: string;
}

export function useWebViewStyleInjection({
    webviewRef,
    backgroundColor,
    foregroundColor,
    markerColor,
    fontSize,
    alignment,
    fontFamily,
}: StyleInjectionParams): void {
    useFocusEffect(
        useCallback(() => {
            if (backgroundColor && foregroundColor && markerColor) {
                webviewRef.current?.injectJavaScript(`
                (function() {
                    try {
                        if (document.body) {
                            document.body.style.backgroundColor = '${backgroundColor}';
                            document.body.style.color = '${foregroundColor}';
                            document.body.dataset.scheme = '${colorSchemeOf(backgroundColor)}';
                        }

                        const elements = document.querySelectorAll('span.le-chapter, sup.le-verse');
                        if (elements && elements.length > 0) {
                            elements.forEach(el => {
                                if (el) {
                                    el.style.color = '${markerColor}';
                                }
                            });
                        }
                    } catch(e) {
                        console.error('Error applying colors:', e);
                    }
                    true;
                })();
            `);
            }
        }, [backgroundColor, foregroundColor, markerColor]),
    );

    useFocusEffect(
        useCallback(() => {
            if (fontSize) {
                webviewRef.current?.injectJavaScript(`
                (function() {
                    try {
                        if (document.body) {
                            document.body.style.fontSize = '${fontSize}px';
                        }
                    } catch(e) {
                        console.error('Error applying font size:', e);
                    }
                    true;
                })();
            `);
            }
        }, [fontSize]),
    );

    useFocusEffect(
        useCallback(() => {
            if (alignment) {
                webviewRef.current?.injectJavaScript(`
                (function() {
                    try {
                        var chEl = document.querySelector('ol.simple-text');
                        if (chEl) chEl.style.textAlign = '${alignment}';
                    } catch(e) {
                        console.error('Error applying alignment:', e);
                    }
                    true;
                })();
            `);
            }
        }, [alignment]),
    );

    useFocusEffect(
        useCallback(() => {
            if (fontFamily) {
                webviewRef.current?.injectJavaScript(`
                (function() {
                    try {
                        if (document.body) {
                            document.body.style.fontFamily = '${fontFamily}';
                        }
                    } catch(e) {
                        console.error('Error applying font family:', e);
                    }
                    true;
                })();
            `);
            }
        }, [fontFamily]),
    );
}
