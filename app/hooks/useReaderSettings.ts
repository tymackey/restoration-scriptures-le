import { useSettingsStore } from "../data/useSettingsStore";
import { useShallow } from "zustand/react/shallow";

export interface ReaderSettings {
    backgroundColor: string;
    foregroundColor: string;
    markerColor: string;
    fontSize: number;
    alignment: string;
    fontFamily: string;
    isBottomMenuOpen: boolean;
    toggleBottomMenu: (open: boolean) => void;
    displayLEVerses: boolean;
    isAutoPlaying: boolean;
    toggleAutoPlay: (v: boolean) => void;
    isAudioModalOpen: boolean;
    toggleAudioModal: (v: boolean) => void;
    voice: string;
    rate: number;
    currentReference: string;
    setCurrentReference: (
        book: string,
        chapter: number,
        position: number,
    ) => void;
    setFontSize: (fontSize: number) => void;
}

export function useReaderSettings(): ReaderSettings {
    const backgroundColor = useSettingsStore(
        useShallow((s) => s.backgroundColor),
    );
    const foregroundColor = useSettingsStore(
        useShallow((s) => s.foregroundColor),
    );
    const markerColor = useSettingsStore(useShallow((s) => s.markerColor));
    const fontSize = useSettingsStore(useShallow((s) => s.fontSize));
    const alignment = useSettingsStore(useShallow((s) => s.alignment));
    const fontFamily = useSettingsStore(useShallow((s) => s.fontFamily));
    const isBottomMenuOpen = useSettingsStore(
        useShallow((s) => s.isBottomMenuOpen),
    );
    const toggleBottomMenu = useSettingsStore(
        useShallow((s) => s.toggleBottomMenu),
    );
    const displayLEVerses = useSettingsStore(
        useShallow((s) => s.displayLEVerses),
    );
    const isAutoPlaying = useSettingsStore(useShallow((s) => s.isAutoPlaying));
    const toggleAutoPlay = useSettingsStore(
        useShallow((s) => s.toggleAutoPlay),
    );
    const isAudioModalOpen = useSettingsStore(
        useShallow((s) => s.isAudioModalOpen),
    );
    const toggleAudioModal = useSettingsStore(
        useShallow((s) => s.toggleAudioModal),
    );
    const voice = useSettingsStore(useShallow((s) => s.voice));
    const rate = useSettingsStore(useShallow((s) => s.rate));
    const currentReference = useSettingsStore(
        useShallow((s) => s.currentReference),
    );
    const setCurrentReference = useSettingsStore(
        useShallow((s) => s.setCurrentReference),
    );
    const setFontSize = useSettingsStore(useShallow((s) => s.setFontSize));

    return {
        backgroundColor,
        foregroundColor,
        markerColor,
        fontSize,
        alignment,
        fontFamily,
        isBottomMenuOpen,
        toggleBottomMenu,
        displayLEVerses,
        isAutoPlaying,
        toggleAutoPlay,
        isAudioModalOpen,
        toggleAudioModal,
        voice,
        rate,
        currentReference,
        setCurrentReference,
        setFontSize,
    };
}
