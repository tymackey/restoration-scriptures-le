/**
 * react-native alias mock for Vitest.
 * Used via resolve.alias so this file is served instead of the real
 * react-native source (which contains Flow types esbuild cannot parse).
 */
import { vi } from "vitest";

export const View = "View";
export const Text = "Text";
export const ScrollView = "ScrollView";
export const TouchableOpacity = "TouchableOpacity";
export const TouchableHighlight = "TouchableHighlight";
export const Pressable = "Pressable";
export const ActivityIndicator = "ActivityIndicator";
export const Image = "Image";
export const Modal = "Modal";
export const FlatList = "FlatList";
export const SectionList = "SectionList";
export const TextInput = "TextInput";
export const SafeAreaView = "SafeAreaView";
export const KeyboardAvoidingView = "KeyboardAvoidingView";

export const StyleSheet = {
    create: (s: any) => s,
    flatten: (s: any) => (Array.isArray(s) ? Object.assign({}, ...s) : s),
    compose: (a: any, b: any) => [a, b],
    hairlineWidth: 1,
    absoluteFill: {},
    absoluteFillObject: { top: 0, left: 0, bottom: 0, right: 0 },
};

export const Alert = { alert: vi.fn() };

export const Platform = {
    OS: "ios" as const,
    select: (obj: any) => (obj.ios !== undefined ? obj.ios : obj.default),
    Version: 17,
};

export const Dimensions = {
    get: () => ({ width: 375, height: 812, scale: 2, fontScale: 1 }),
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
    removeEventListener: vi.fn(),
};

export const useWindowDimensions = () => ({
    width: 375,
    height: 812,
    scale: 2,
    fontScale: 1,
});

export const NativeModules = {};

export class NativeEventEmitter {
    addListener() {
        return { remove: vi.fn() };
    }
    removeAllListeners() {}
}

export const Animated = {
    View: "Animated.View",
    Text: "Animated.Text",
    Image: "Animated.Image",
    ScrollView: "Animated.ScrollView",
    FlatList: "Animated.FlatList",
    Value: class {
        constructor(_v: any) {}
        setValue() {}
        interpolate() {
            return this;
        }
        addListener() {
            return { remove: vi.fn() };
        }
    },
    timing: () => ({ start: vi.fn() }),
    spring: () => ({ start: vi.fn() }),
    sequence: () => ({ start: vi.fn() }),
    parallel: () => ({ start: vi.fn() }),
    decay: () => ({ start: vi.fn() }),
    event: vi.fn(() => vi.fn()),
    createAnimatedComponent: (c: any) => c,
};

export const PixelRatio = {
    get: () => 2,
    getFontScale: () => 1,
    roundToNearestPixel: (n: number) => n,
};

export const I18nManager = { isRTL: false };
export const StatusBar = { setBarStyle: vi.fn(), setBackgroundColor: vi.fn() };
export const BackHandler = {
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
    removeEventListener: vi.fn(),
};
export const AppState = {
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
    currentState: "active",
};
export const Keyboard = {
    dismiss: vi.fn(),
    addListener: vi.fn(() => ({ remove: vi.fn() })),
};
export const Linking = {
    openURL: vi.fn(),
    canOpenURL: vi.fn(() => Promise.resolve(true)),
};
export const Share = {
    share: vi.fn(() => Promise.resolve({ action: "sharedAction" })),
};
export const Vibration = { vibrate: vi.fn() };
export const AccessibilityInfo = {
    isScreenReaderEnabled: vi.fn(() => Promise.resolve(false)),
};
export const InteractionManager = {
    runAfterInteractions: (cb: any) => {
        cb();
        return { cancel: vi.fn() };
    },
};

export class EmitterSubscription {
    remove() {}
}

export default {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    TouchableHighlight,
    Pressable,
    ActivityIndicator,
    Image,
    Modal,
    FlatList,
    SectionList,
    TextInput,
    SafeAreaView,
    KeyboardAvoidingView,
    StyleSheet,
    Alert,
    Platform,
    Dimensions,
    useWindowDimensions,
    NativeModules,
    NativeEventEmitter,
    Animated,
    PixelRatio,
    I18nManager,
    StatusBar,
    BackHandler,
    AppState,
    Keyboard,
    Linking,
    Share,
    Vibration,
    AccessibilityInfo,
    InteractionManager,
    EmitterSubscription,
};
