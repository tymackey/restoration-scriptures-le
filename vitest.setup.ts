import { vi } from "vitest";

// Required so react-test-renderer's act() doesn't warn about unsupported environment.
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// expo-modules-core (pulled in by @expo/vector-icons and others) references
// the React Native global __DEV__ which is not defined in a plain Node env.
(globalThis as any).__DEV__ = false;

// ── Shared state accessible across tests ─────────────────────────────────────
// The WebView mock populates this object so tests can read captured props.
(globalThis as any).__rntl = {
    webViewProps: null as Record<string, any> | null,
};

// Note: react-native itself is handled via resolve.alias in vitest.config.ts,
// pointing to test-mocks/react-native.ts. That avoids Flow-typed source parsing.

// ── react-native LEGACY (kept for submodule imports like react-native/Libraries) ──
vi.mock("react-native", () => ({
    View: "View",
    Text: "Text",
    ScrollView: "ScrollView",
    TouchableOpacity: "TouchableOpacity",
    TouchableHighlight: "TouchableHighlight",
    Pressable: "Pressable",
    ActivityIndicator: "ActivityIndicator",
    Image: "Image",
    Modal: "Modal",
    FlatList: "FlatList",
    SectionList: "SectionList",
    TextInput: "TextInput",
    SafeAreaView: "SafeAreaView",
    KeyboardAvoidingView: "KeyboardAvoidingView",
    StyleSheet: {
        create: (s: any) => s,
        flatten: (s: any) => (Array.isArray(s) ? Object.assign({}, ...s) : s),
        compose: (a: any, b: any) => [a, b],
        hairlineWidth: 1,
        absoluteFill: {},
        absoluteFillObject: { top: 0, left: 0, bottom: 0, right: 0 },
    },
    Alert: {
        alert: vi.fn(),
    },
    Platform: {
        OS: "ios",
        select: (obj: any) => (obj.ios !== undefined ? obj.ios : obj.default),
        Version: 17,
    },
    Dimensions: {
        get: () => ({ width: 375, height: 812, scale: 2, fontScale: 1 }),
        addEventListener: vi.fn(() => ({ remove: vi.fn() })),
        removeEventListener: vi.fn(),
    },
    useWindowDimensions: () => ({
        width: 375,
        height: 812,
        scale: 2,
        fontScale: 1,
    }),
    NativeModules: {},
    NativeEventEmitter: class {
        addListener() {
            return { remove: vi.fn() };
        }
        removeAllListeners() {}
    },
    Animated: {
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
    },
    PixelRatio: {
        get: () => 2,
        getFontScale: () => 1,
        roundToNearestPixel: (n: number) => n,
    },
    I18nManager: { isRTL: false },
    StatusBar: { setBarStyle: vi.fn(), setBackgroundColor: vi.fn() },
    BackHandler: {
        addEventListener: vi.fn(() => ({ remove: vi.fn() })),
        removeEventListener: vi.fn(),
    },
    AppState: {
        addEventListener: vi.fn(() => ({ remove: vi.fn() })),
        currentState: "active",
    },
    Keyboard: {
        dismiss: vi.fn(),
        addListener: vi.fn(() => ({ remove: vi.fn() })),
    },
    Linking: {
        openURL: vi.fn(),
        canOpenURL: vi.fn(() => Promise.resolve(true)),
    },
    Share: { share: vi.fn(() => Promise.resolve({ action: "sharedAction" })) },
    Clipboard: {
        setString: vi.fn(),
        getString: vi.fn(() => Promise.resolve("")),
    },
    Vibration: { vibrate: vi.fn() },
    AccessibilityInfo: {
        isScreenReaderEnabled: vi.fn(() => Promise.resolve(false)),
    },
    InteractionManager: {
        runAfterInteractions: (cb: any) => {
            cb();
            return { cancel: vi.fn() };
        },
    },
}));

// ── AsyncStorage (needed by zustand persist) ──────────────────────────────────
vi.mock("@react-native-async-storage/async-storage", () => ({
    default: {
        getItem: vi.fn(() => Promise.resolve(null)),
        setItem: vi.fn(() => Promise.resolve()),
        removeItem: vi.fn(() => Promise.resolve()),
        mergeItem: vi.fn(() => Promise.resolve()),
        clear: vi.fn(() => Promise.resolve()),
        getAllKeys: vi.fn(() => Promise.resolve([])),
        multiGet: vi.fn(() => Promise.resolve([])),
        multiSet: vi.fn(() => Promise.resolve()),
        multiRemove: vi.fn(() => Promise.resolve()),
        flushGetRequests: vi.fn(),
    },
}));

// ── react-native-gesture-handler ──────────────────────────────────────────────
vi.mock("react-native-gesture-handler", () => {
    // Fluent builder returned by all gesture constructors
    function makeGestureBuilder() {
        const builder: any = {};
        const methods = [
            "maxDuration",
            "numberOfTaps",
            "runOnJS",
            "onBegin",
            "onStart",
            "onEnd",
            "onFinalize",
            "onUpdate",
            "minDistance",
            "minPointers",
            "maxPointers",
            "enabled",
            "hitSlop",
            "withRef",
            "withTestId",
            "simultaneousWithExternalGesture",
            "exclusiveWithExternalGesture",
            "requireExternalGestureToFail",
            "onTouchesDown",
            "onTouchesMove",
            "onTouchesUp",
            "onTouchesCancelled",
            "minVelocity",
            "maxPointers",
            "activeCursor",
            "mouseButton",
        ];
        methods.forEach((m) => {
            builder[m] = () => builder;
        });
        return builder;
    }
    return {
        Gesture: {
            Tap: () => makeGestureBuilder(),
            LongPress: () => makeGestureBuilder(),
            Pan: () => makeGestureBuilder(),
            Fling: () => makeGestureBuilder(),
            Pinch: () => makeGestureBuilder(),
            Rotation: () => makeGestureBuilder(),
            Native: () => makeGestureBuilder(),
            Manual: () => makeGestureBuilder(),
            Hover: () => makeGestureBuilder(),
            Simultaneous: (..._gs: any[]) => makeGestureBuilder(),
            Race: (..._gs: any[]) => makeGestureBuilder(),
            Exclusive: (..._gs: any[]) => makeGestureBuilder(),
        },
        GestureDetector: "GestureDetector",
        GestureHandlerRootView: "GestureHandlerRootView",
        LongPressGestureHandler: "LongPressGestureHandler",
        TapGestureHandler: "TapGestureHandler",
        PanGestureHandler: "PanGestureHandler",
        State: {
            ACTIVE: 4,
            END: 5,
            BEGAN: 2,
            CANCELLED: 3,
            FAILED: 1,
            UNDETERMINED: 0,
        },
        RectButton: "RectButton",
        BorderlessButton: "BorderlessButton",
        ScrollView: "GHScrollView",
    };
});

// ── react-native-reanimated ───────────────────────────────────────────────────
vi.mock("react-native-reanimated", () => ({
    default: {
        createAnimatedComponent: (c: any) => c,
        Value: class {
            constructor(_v: any) {}
        },
    },
    runOnJS: (fn: any) => fn,
    runOnUI: (fn: any) => fn,
    useSharedValue: (v: any) => ({ value: v }),
    useAnimatedStyle: (fn: any) => fn(),
    useAnimatedGestureHandler: (handlers: any) => handlers,
    withTiming: (v: any) => v,
    withSpring: (v: any) => v,
    withDecay: (v: any) => v,
    interpolate: (v: any) => v,
    Extrapolation: { CLAMP: "CLAMP", EXTEND: "EXTEND", IDENTITY: "IDENTITY" },
    Easing: { linear: (n: number) => n, bezier: () => (n: number) => n },
    useAnimatedRef: () => ({ current: null }),
    useAnimatedScrollHandler: () => vi.fn(),
    Animated: { View: "Reanimated.View", ScrollView: "Reanimated.ScrollView" },
}));

// ── react-native-webview ──────────────────────────────────────────────────────
// Captures the last rendered WebView's props in globalThis.__rntl.webViewProps
vi.mock("react-native-webview", () => ({
    default: (props: any) => {
        (globalThis as any).__rntl.webViewProps = props;
        return null;
    },
    WebView: (props: any) => {
        (globalThis as any).__rntl.webViewProps = props;
        return null;
    },
}));

// ── @gorhom/bottom-sheet ─────────────────────────────────────────────────────
vi.mock("@gorhom/bottom-sheet", () => {
    const React = require("react");
    // BottomSheetModal needs to be a React class component so ref forwarding works
    class BottomSheetModal extends React.Component {
        present() {}
        dismiss() {}
        expand() {}
        close() {}
        snapToIndex() {}
        forceClose() {}
        render() {
            return null;
        }
    }
    return {
        default: BottomSheetModal,
        BottomSheetModal,
        BottomSheetBackdrop: () => null,
        BottomSheetModalProvider: ({ children }: any) => children,
        BottomSheetView: "BottomSheetView",
        BottomSheetScrollView: "BottomSheetScrollView",
        BottomSheetFlatList: "BottomSheetFlatList",
        useBottomSheetModal: () => ({ dismiss: vi.fn() }),
    };
});

// ── react-native-paper ────────────────────────────────────────────────────────
vi.mock("react-native-paper", () => {
    const FABGroup = () => null;
    const FAB = () => null;
    (FAB as any).Group = FABGroup;
    return {
        Portal: ({ children }: any) => children,
        FAB,
        PaperProvider: ({ children }: any) => children,
        Appbar: {
            Header: "Appbar.Header",
            Content: "Appbar.Content",
            Action: "Appbar.Action",
        },
        Button: "Button",
        Text: "PaperText",
        Snackbar: ({ children, visible, onDismiss, action }: any) => null,
        useTheme: () => ({ colors: { primary: "#000" } }),
        Provider: ({ children }: any) => children,
        MD3LightTheme: {},
        MD3DarkTheme: {},
    };
});

// ── @weights-ai/react-native-track-player ─────────────────────────────────────
vi.mock("@weights-ai/react-native-track-player", () => ({
    default: {
        setupPlayer: vi.fn(() => Promise.resolve()),
        add: vi.fn(() => Promise.resolve()),
        play: vi.fn(() => Promise.resolve()),
        pause: vi.fn(() => Promise.resolve()),
        stop: vi.fn(() => Promise.resolve()),
        reset: vi.fn(() => Promise.resolve()),
        skip: vi.fn(() => Promise.resolve()),
        skipToNext: vi.fn(() => Promise.resolve()),
        skipToPrevious: vi.fn(() => Promise.resolve()),
        getQueue: vi.fn(() => Promise.resolve([])),
        getActiveTrackIndex: vi.fn(() => Promise.resolve(0)),
        getProgress: vi.fn(() =>
            Promise.resolve({ position: 0, duration: 0, buffered: 0 }),
        ),
        setRate: vi.fn(() => Promise.resolve()),
        addEventListener: vi.fn(() => ({ remove: vi.fn() })),
        updateMetadataForTrack: vi.fn(() => Promise.resolve()),
        setVolume: vi.fn(() => Promise.resolve()),
        removeUpcomingTracks: vi.fn(() => Promise.resolve()),
    },
    Event: {
        PlaybackQueueEnded: "playback-queue-ended",
        PlaybackActiveTrackChanged: "playback-active-track-changed",
        PlaybackState: "playback-state",
        PlaybackError: "playback-error",
        RemotePlay: "remote-play",
        RemotePause: "remote-pause",
        RemoteStop: "remote-stop",
        RemoteNext: "remote-next",
        RemotePrevious: "remote-previous",
    },
    State: {
        Playing: "playing",
        Paused: "paused",
        Stopped: "stopped",
        Buffering: "buffering",
    },
    Capability: {
        Play: 1,
        Pause: 2,
        Stop: 4,
        SkipToNext: 32,
        SkipToPrevious: 16,
        JumpForward: 64,
        JumpBackward: 128,
    },
    RepeatMode: { Off: 0, Track: 1, Queue: 2 },
    AppKilledPlaybackBehavior: {
        ContinuePlayback: 0,
        StopPlaybackAndRemoveNotification: 1,
        PausePlayback: 2,
    },
    useTrackPlayerEvents: vi.fn(() => {}),
    useProgress: vi.fn(() => ({ position: 0, duration: 0, buffered: 0 })),
    usePlaybackState: vi.fn(() => ({ state: "stopped" })),
    useActiveTrack: vi.fn(() => null),
}));

// ── @react-navigation/native ──────────────────────────────────────────────────
vi.mock("@react-navigation/native", () => {
    const React = require("react");
    return {
        useFocusEffect: (callback: any) => {
            // Execute the callback like a useEffect on mount
            React.useEffect(callback, []);
        },
        useNavigation: () => ({
            navigate: vi.fn(),
            push: vi.fn(),
            pop: vi.fn(),
            goBack: vi.fn(),
            setOptions: vi.fn(),
            addListener: vi.fn(() => ({ remove: vi.fn() })),
        }),
        useRoute: () => ({ params: {}, name: "Reader" }),
        NavigationContainer: "NavigationContainer",
        createNavigatorFactory: vi.fn(),
        useIsFocused: () => true,
    };
});

// ── zustand/react/shallow ─────────────────────────────────────────────────────
vi.mock("zustand/react/shallow", () => ({
    useShallow: (fn: any) => fn,
}));

// ── @expo/vector-icons ────────────────────────────────────────────────────────
// Prevents expo-modules-core (which uses __DEV__) from being loaded in the
// test environment. Any icon component is rendered as a plain string.
vi.mock("@expo/vector-icons", () => ({
    MaterialCommunityIcons: "MaterialCommunityIcons",
    Ionicons: "Ionicons",
    FontAwesome: "FontAwesome",
    FontAwesome5: "FontAwesome5",
    AntDesign: "AntDesign",
    Feather: "Feather",
    Entypo: "Entypo",
    MaterialIcons: "MaterialIcons",
}));

// ── expo-intent-launcher ──────────────────────────────────────────────────────
// expo-intent-launcher imports expo-modules-core which requires native globals
// (globalThis.expo.NativeModule). Mock it to avoid loading native code.
vi.mock("expo-intent-launcher", () => ({
    default: { startActivity: vi.fn(), startActivityAsync: vi.fn() },
    startActivity: vi.fn(),
    startActivityAsync: vi.fn(),
}));
