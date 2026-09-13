export interface ReaderState {
    webViewLoading: boolean;
    html: string;
    isLoading: boolean;
    position: number;
    fabVisible: boolean;
    searchTerm: string | null;
}

export const ACTIONS = {
    SET_WEBVIEW_LOADING: "SET_WEBVIEW_LOADING",
    SET_HTML: "SET_HTML",
    SET_LOADING: "SET_LOADING",
    SET_POSITION: "SET_POSITION",
    TOGGLE_FAB: "TOGGLE_FAB",
    SET_SEARCH_TERM: "SET_SEARCH_TERM",
} as const;

export type ReaderAction = { type: string; payload?: any };

export function readerReducer(
    state: ReaderState,
    action: ReaderAction,
): ReaderState {
    switch (action.type) {
        case ACTIONS.SET_WEBVIEW_LOADING:
            return { ...state, webViewLoading: action.payload };
        case ACTIONS.SET_HTML:
            return { ...state, html: action.payload };
        case ACTIONS.SET_LOADING:
            return { ...state, isLoading: action.payload };
        case ACTIONS.SET_POSITION:
            return { ...state, position: action.payload };
        case ACTIONS.TOGGLE_FAB:
            return { ...state, fabVisible: action.payload };
        case ACTIONS.SET_SEARCH_TERM:
            return { ...state, searchTerm: action.payload };
        default:
            return state;
    }
}

export function makeInitialReaderState(
    searchTerm?: string | null,
): ReaderState {
    return {
        webViewLoading: false,
        html: "",
        isLoading: true,
        position: 0,
        fabVisible: true,
        searchTerm: searchTerm || null,
    };
}
