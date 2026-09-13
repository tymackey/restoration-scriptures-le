import { useEffect } from "react";
import {
    Modal,
    View,
    StyleSheet,
    useWindowDimensions,
    ViewStyle,
} from "react-native";
import resolveAssetSource from "react-native/Libraries/Image/resolveAssetSource";
import { Image } from "expo-image";
import {
    Gesture,
    GestureDetector,
    GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { getImageSource } from "../util/ImageUtils";
import { colors } from "../constants/colors";

interface ImageZoomModalProps {
    visible: boolean;
    imageName: string | null;
    onClose: () => void;
}

/**
 * Full-screen pinch-to-zoom viewer for scripture illustrations (maps,
 * facsimiles, the Timeline of the Fathers chart). Opened by tapping a
 * ".zoomable" image in the reader's WebView — see the click handler injected
 * by generateImageReplacementScript in ImageUtils.ts.
 *
 * Runs as its own native modal rather than an in-place zoom inside the
 * WebView: the reader's font-size pinch gesture already claims the WebView's
 * whole touch surface at the React Native layer (see reader.tsx), so a
 * second pinch recognizer inside the page would be fighting the same touch
 * stream instead of layering cleanly.
 */
export function ImageZoomModal({
    visible,
    imageName,
    onClose,
}: ImageZoomModalProps) {
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();

    const scale = useSharedValue(1);
    const savedScale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const savedTranslateX = useSharedValue(0);
    const savedTranslateY = useSharedValue(0);
    // Tracks the double-tap toggle target explicitly rather than inferring it
    // from scale.value, which reads as its pre-animation value for the rest
    // of the worklet that set it via withTiming() — comparing against it on
    // the very next tap sees a stale "not zoomed in yet" result.
    const isZoomedIn = useSharedValue(false);

    // Reset to the fitted (1x) view whenever the modal opens or closes, so
    // stale zoom/pan state from a previous viewing never carries over.
    useEffect(() => {
        scale.value = 1;
        savedScale.value = 1;
        translateX.value = 0;
        translateY.value = 0;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        isZoomedIn.value = false;
    }, [
        visible,
        imageName,
        scale,
        savedScale,
        translateX,
        translateY,
        savedTranslateX,
        savedTranslateY,
        isZoomedIn,
    ]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: scale.value },
        ] as unknown as ViewStyle["transform"],
    }));

    if (!imageName) return null;

    const source = getImageSource(imageName);
    if (!source) return null;

    const resolved = resolveAssetSource(source);
    const naturalWidth = resolved?.width || screenWidth;
    const naturalHeight = resolved?.height || screenHeight;

    // Fit the image within the screen without ever upscaling it past its
    // actual pixel size on first display.
    const fitScale = Math.min(
        screenWidth / naturalWidth,
        screenHeight / naturalHeight,
        1,
    );
    const displayWidth = naturalWidth * fitScale;
    const displayHeight = naturalHeight * fitScale;
    // How far the pinch can grow the fitted image before it reaches its
    // actual (1:1 pixel) size. Already-small images that display at full
    // size have nothing further to zoom into.
    const maxScale = fitScale > 0 ? Math.max(1 / fitScale, 1) : 1;

    const clampTranslation = () => {
        "worklet";
        const maxX = (displayWidth * (scale.value - 1)) / 2;
        const maxY = (displayHeight * (scale.value - 1)) / 2;
        translateX.value = Math.min(Math.max(translateX.value, -maxX), maxX);
        translateY.value = Math.min(Math.max(translateY.value, -maxY), maxY);
    };

    const pinchGesture = Gesture.Pinch()
        .onUpdate((e) => {
            scale.value = Math.min(
                Math.max(savedScale.value * e.scale, 1),
                maxScale,
            );
        })
        .onEnd(() => {
            savedScale.value = scale.value;
            isZoomedIn.value = scale.value > 1;
            if (scale.value === 1) {
                translateX.value = withTiming(0);
                translateY.value = withTiming(0);
                savedTranslateX.value = 0;
                savedTranslateY.value = 0;
            } else {
                clampTranslation();
                savedTranslateX.value = translateX.value;
                savedTranslateY.value = translateY.value;
            }
        });

    // A small activation threshold keeps an in-place double-tap from being
    // swallowed as a tiny pan before the tap gesture gets a chance to win
    // the Race below.
    const panGesture = Gesture.Pan()
        .minDistance(10)
        .onUpdate((e) => {
            if (scale.value <= 1) return;
            translateX.value = savedTranslateX.value + e.translationX;
            translateY.value = savedTranslateY.value + e.translationY;
        });

    const doubleTapGesture = Gesture.Tap()
        .numberOfTaps(2)
        .onEnd(() => {
            const next = isZoomedIn.value ? 1 : maxScale;
            isZoomedIn.value = !isZoomedIn.value;
            scale.value = withTiming(next);
            savedScale.value = next;
            translateX.value = withTiming(0);
            translateY.value = withTiming(0);
            savedTranslateX.value = 0;
            savedTranslateY.value = 0;
        });

    const composedGesture = Gesture.Simultaneous(
        Gesture.Race(doubleTapGesture, panGesture),
        pinchGesture,
    );

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            {/* RN's Modal renders into a separate native window outside the
                app's root GestureHandlerRootView (App.tsx), so gesture-handler
                gestures silently fail here without their own root view. */}
            <GestureHandlerRootView style={styles.backdrop}>
                <View style={styles.closeButton}>
                    <MaterialCommunityIcons.Button
                        name="close"
                        size={28}
                        color={colors.white}
                        backgroundColor={colors.transparent}
                        underlayColor={colors.transparent}
                        onPress={onClose}
                    />
                </View>
                <GestureDetector gesture={composedGesture}>
                    <Animated.View
                        style={[
                            styles.imageWrapper,
                            { width: displayWidth, height: displayHeight },
                            animatedStyle,
                        ]}
                    >
                        <Image
                            source={source}
                            style={styles.image}
                            contentFit="contain"
                        />
                    </Animated.View>
                </GestureDetector>
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: colors.overlayDark,
        alignItems: "center",
        justifyContent: "center",
    },
    closeButton: {
        position: "absolute",
        top: 44,
        right: 12,
        zIndex: 1,
    },
    imageWrapper: {
        alignItems: "center",
        justifyContent: "center",
    },
    image: {
        width: "100%",
        height: "100%",
    },
});

export default ImageZoomModal;
