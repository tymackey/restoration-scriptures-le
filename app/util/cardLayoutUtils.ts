import { useWindowDimensions, Platform } from "react-native";
import { useMemo } from "react";
import { useSafeAreaFrame } from "react-native-safe-area-context";

export interface CardLayoutConfig {
    containerPadding?: number;
    cardGap?: number;
    cardBorderWidth?: number;
    minCardWidth?: number;
    maxCardWidth?: number;
    isLandscape?: boolean;
}

export const defaultCardLayoutConfig: CardLayoutConfig = {
    containerPadding: 8, // paddingHorizontal from cardStyles.cardContentContainer
    cardGap: 8, // Conservative gap value to prevent overflow
    cardBorderWidth: 4, // borderWidth: 2 on each side = 4px total
    minCardWidth: 120, // Minimum card width to ensure readability
    maxCardWidth: 200, // Maximum card width for good proportions
    isLandscape: false,
};

export function useCardLayout(
    config: CardLayoutConfig = defaultCardLayoutConfig,
) {
    const { width } = useSafeAreaFrame();

    // Memoize the merged config to prevent infinite re-renders
    const mergedConfig = useMemo(
        () => ({
            ...defaultCardLayoutConfig,
            ...config,
        }),
        [
            config.containerPadding,
            config.cardGap,
            config.cardBorderWidth,
            config.minCardWidth,
            config.maxCardWidth,
            config.isLandscape,
        ],
    );

    // Calculate available width for cards
    const totalPadding = mergedConfig.containerPadding * 2;

    // Improved safe area calculation that accounts for device differences
    const calculateSafeAreaAdjustment = () => {
        if (!mergedConfig.isLandscape) {
            // Portrait mode - minimal adjustment
            return Math.log2(width) * -2.0;
        }

        // Landscape mode - device-specific adjustments
        if (Platform.OS === "ios") {
            // Check if it's likely an iPad (wider screen)
            const isLikelyTablet = width > 1024;

            if (isLikelyTablet) {
                // iPad - minimal safe area adjustment in landscape
                return Math.log2(width) * -3.6;
            } else {
                // iPhone - account for notch/Dynamic Island in landscape
                return Math.log2(width) * 10;
            }
        } else {
            // Android - moderate adjustment
            return Math.log2(width) * 5;
        }
    };

    const safeAreaAdjustment = calculateSafeAreaAdjustment();
    const availableWidth = width - totalPadding - safeAreaAdjustment;

    // Calculate how many columns can fit
    const calculateNumColumns = () => {
        // Start with a reasonable number and work backwards
        for (let cols = 8; cols >= 1; cols--) {
            const totalGaps = mergedConfig.cardGap * (cols - 1);
            const totalBorders = mergedConfig.cardBorderWidth * cols;
            const remainingWidth = availableWidth - totalGaps - totalBorders;
            const cardWidth = remainingWidth / cols;

            if (
                cardWidth >= mergedConfig.minCardWidth &&
                cardWidth <= mergedConfig.maxCardWidth
            ) {
                return cols;
            }
        }
        return 1; // Fallback to single column
    };

    const numColumns = calculateNumColumns();

    // Recalculate card width with the determined number of columns
    const totalGaps = mergedConfig.cardGap * (numColumns - 1);
    const totalBorders = mergedConfig.cardBorderWidth * numColumns;
    const cardAvailableWidth = availableWidth - totalGaps - totalBorders;
    const cardWidth = Math.floor(cardAvailableWidth / numColumns);

    return {
        numColumns,
        cardWidth,
        availableWidth,
        width,
    };
}

// Legacy function for backward compatibility
export function calculateCardLayout(
    width: number,
    config: CardLayoutConfig = defaultCardLayoutConfig,
) {
    const totalPadding = config.containerPadding * 2;
    const availableWidth = width - totalPadding;

    const calculateNumColumns = () => {
        for (let cols = 8; cols >= 1; cols--) {
            const totalGaps = config.cardGap * (cols - 1);
            const totalBorders = config.cardBorderWidth * cols;
            const remainingWidth = availableWidth - totalGaps - totalBorders;
            const cardWidth = remainingWidth / cols;

            if (
                cardWidth >= config.minCardWidth &&
                cardWidth <= config.maxCardWidth
            ) {
                return cols;
            }
        }
        return 1;
    };

    const numColumns = calculateNumColumns();
    const totalGaps = config.cardGap * (numColumns - 1);
    const totalBorders = config.cardBorderWidth * numColumns;
    const cardAvailableWidth = availableWidth - totalGaps - totalBorders;
    const cardWidth = Math.floor(cardAvailableWidth / numColumns);

    return {
        numColumns,
        cardWidth,
        availableWidth,
    };
}
