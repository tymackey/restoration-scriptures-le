import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface SettingsState {
    isFirstLaunch: boolean;
    // Marketing version (app.json `version`) the user last saw a "What's New"
    // summary for. null means never seen — treated as an update for existing
    // users upgrading from a build that predates this field.
    lastSeenVersion: string | null;
    isHydrated: boolean;
    isBottomMenuOpen: boolean;
    layout: string;
    isPlayerRegistered: boolean;
    fontSize: number;
    fontFamily: string;
    backgroundColor: string;
    foregroundColor: string;
    markerColor: string;
    voice: string;
    rate: number;
    isDarkColorScheme: boolean;
    orientation: string;
    isAudioModalOpen: boolean;
    displayLEVerses: boolean;
    isAutoPlaying: boolean;
    isLandscape: boolean;
    alignment: string;
    currentReference: string;
    setIsFirstLaunch: (isFirstLaunch: boolean) => void;
    setLastSeenVersion: (version: string | null) => void;
    setHydrated: (state: boolean) => void;
    setLayout: (layout: string) => void;
    increaseFontSize: () => void;
    decreaseFontSize: () => void;
    setFontFamily: (fontFamily: string) => void;
    changeColorScheme: (
        backgroundColor: string,
        foregroundColor: string,
        markerColor: string,
    ) => void;
    setOrientation: (orientation: string) => void;
    resetOptions: () => void;
    toggleBottomMenu: (isBottomMenuOpen: boolean) => void;
    toggleAudioModal: (isAudioModalOpen: boolean) => void;
    toggleLEVerses: (displayLEVerses: boolean) => void;
    registerPlayer: () => void;
    setVoice: (voice: string) => void;
    setRate: (rate: number) => void;
    toggleAutoPlay: (isAutoPlaying: boolean) => void;
    setIsLandscape: (isLandscape: boolean) => void;
    alignLeft: () => void;
    alignJustify: () => void;
    setCurrentReference: (
        book: string,
        chapter: number,
        position: number,
    ) => void;
    setFontSize: (fontSize: number) => void; // Used by pinch gesture
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            isFirstLaunch: true,
            lastSeenVersion: null,
            isHydrated: false,
            isBottomMenuOpen: false,
            layout: "list",
            isPlayerRegistered: false,
            fontSize: 18,
            fontFamily: "Assistant-Regular",
            backgroundColor: "#ffffff",
            foregroundColor: "#15141A",
            markerColor: "#ba3919",
            voice: "male1",
            rate: 1.0,
            isDarkColorScheme: false,
            orientation: "PORTRAIT",
            isAudioModalOpen: false,
            displayLEVerses: true,
            isAutoPlaying: false,
            currentTitles: [],
            isLandscape: false,
            alignment: "justify",
            currentReference: null,
            setIsFirstLaunch: (isFirstLaunch: boolean) =>
                set(() => ({ isFirstLaunch: isFirstLaunch })),
            setLastSeenVersion: (version: string | null) =>
                set(() => ({ lastSeenVersion: version })),
            setHydrated: (state: boolean) => set({ isHydrated: state }),
            setLayout: (layout: string) => set(() => ({ layout: layout })),
            increaseFontSize: () =>
                set((state: SettingsState) => ({
                    fontSize: Math.min(state.fontSize + 1, 40),
                })),
            decreaseFontSize: () =>
                set((state: SettingsState) => ({
                    fontSize: Math.max(state.fontSize - 1, 16),
                })),
            setFontFamily: (fontFamily: string) =>
                set((state: SettingsState) => ({
                    // Account for larger font with OpenDyslexic-Regular
                    fontSize:
                        fontFamily === "OpenDyslexic-Regular"
                            ? state.fontSize - 5
                            : state.fontFamily === "OpenDyslexic-Regular"
                              ? state.fontSize + 5
                              : state.fontSize,
                    fontFamily: fontFamily,
                })),
            changeColorScheme: (
                backgroundColor: string,
                foregroundColor: string,
                markerColor: string,
            ) =>
                set((state: SettingsState) => ({
                    ...state,
                    backgroundColor: backgroundColor,
                    foregroundColor: foregroundColor,
                    markerColor: markerColor,
                })),
            setOrientation: (orientation: string) =>
                set(() => ({ orientation: orientation })),
            resetOptions: () =>
                set(() => ({
                    fontSize: 18,
                    fontFamily: "Assistant-Regular",
                    backgroundColor: "#ffffff",
                    foregroundColor: "#15141A",
                    markerColor: "#ba3919",
                    isDarkColorScheme: false,
                })),
            toggleBottomMenu: (isBottomMenuOpen: boolean) =>
                set(() => ({ isBottomMenuOpen: isBottomMenuOpen })),
            toggleAudioModal: (isAudioModalOpen: boolean) => {
                set(() => ({ isAudioModalOpen: isAudioModalOpen }));
            },
            toggleLEVerses: (displayLEVerses: boolean) =>
                set(() => ({ displayLEVerses: displayLEVerses })),
            registerPlayer: () => set(() => ({ isPlayerRegistered: true })),
            setVoice: (voice: string) => set(() => ({ voice: voice })),
            setRate: (rate: number) => set(() => ({ rate: rate })),
            toggleAutoPlay: (isAutoPlaying: boolean) =>
                set(() => ({ isAutoPlaying: isAutoPlaying })),
            setIsLandscape: (isLandscape: boolean) =>
                set(() => ({ isLandscape: isLandscape })),
            alignLeft: () => set(() => ({ alignment: "left" })),
            alignJustify: () => set(() => ({ alignment: "justify" })),
            setCurrentReference: (
                book: string,
                chapter: number,
                position: number,
            ) =>
                set(() => ({
                    currentReference: `${book} ${chapter}:${position}`,
                })),
            setFontSize: (fontSize: number) =>
                set(() => ({ fontSize: Math.min(Math.max(fontSize, 16), 40) })),
        }),
        {
            name: "REScripturesStorage",
            storage: createJSONStorage(() => AsyncStorage),
            onRehydrateStorage: () => (state) => {
                if (state) {
                    state.setHydrated(true);
                }
            },
        },
    ),
);
