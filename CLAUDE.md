# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Restoration Scriptures is a React Native (Expo 55) mobile app for reading, searching, and listening to the Restoration Edition Scriptures offline. It targets iOS and Android with TypeScript, React 19, and the Expo New Architecture with React Compiler enabled.

## Common Commands

```bash
npm start              # Start Expo dev server
npm run android        # Run on Android
npm run ios            # Run on iOS
npm run lint           # ESLint (includes react-compiler and react-native rules)
npx expo prebuild      # Regenerate native projects
eas build --profile development   # Dev build with Sentry
eas build --profile apkpreview    # Android APK for testing
eas build --profile production    # Production release build
```

## Architecture

### Entry Flow
`index.ts` → `App.tsx` (wraps providers: Sentry, SafeArea, DatabaseProvider, PaperProvider, AutocompleteDropdown) → `Nav` (DrawerNav → StackNav)

### Navigation (`app/nav/Nav.tsx`)
Drawer navigation wrapping a stack navigator. Volume screens (cc, oc, nc, tc) lead to Chapter then Reader. Search and Converter are standalone stack routes. The drawer uses custom content with active route tracking.

### State Management — Zustand (`app/data/`)
- **useSettingsStore** — Persisted to AsyncStorage (`REScripturesStorage`). Holds display settings (fontSize, fontFamily, colors, alignment), audio settings (voice, rate), layout mode, orientation, and current reference.
- **useMenuStore** — Ephemeral global context menu state.
- **useTCStore** — Teachings & Commandments specific state.

### Database (`app/data/useDatabase.ts`)
SQLite via `expo-sqlite` with a bundled `scriptures_v2.db` asset. Key configuration:
- FTS5 enabled with Porter stemming for full-text search
- WAL journal mode, 256MB mmap, 32KB page size
- Custom tokenizer (`app/util/CustomTokenizer.ts`) handles apostrophes in search queries
- `DatabaseCleanupManager` manages FTS5 resource cleanup on app backgrounding

Key methods: `getVolumes`, `getBooks`, `getChapterText`, `getNextChapter`/`getPreviousChapter`, `searchFullText`, `searchFullTextExactPhrase`, `getChapterByReference`.

### Reader Screen (`app/screens/reader.tsx`)
The core screen. Renders scripture HTML in a WebView with:
- Cheerio-based HTML processing (`app/util/HtmlProcessor.ts`) for verse styling and paragraph breaks
- Scroll position persistence via `ScrollTracker`
- Audio playback via `@weights-ai/react-native-track-player` with multiple voices/speeds
- FAB controls for audio and display options
- Gesture-based chapter navigation

### Audio System (`app/util/TrackPlayer.ts`)
Fetches tracklists from `scriptures.info`, streams audio files per chapter. Supports 4 voices and variable playback speeds. Background audio enabled on iOS.

### Scripture Volumes
| Code | Volume |
|------|--------|
| cc   | Covenant of Christ |
| oc   | Old Covenants |
| nt   | New Covenants (New Testament) |
| bofm | New Covenants (Book of Mormon) |
| tc   | Teachings & Commandments |

## Code Style

**Prettier** (enforced via ESLint):
- 4-space indentation, single quotes, trailing commas, no bracket spacing, arrow parens: avoid

**ESLint rules** (errors, not warnings):
- `react-compiler/react-compiler` — React Compiler compliance required
- `react-native/no-unused-styles`, `no-inline-styles`, `no-color-literals`, `no-raw-text`, `no-single-element-style-arrays`

### Key Constraints
- All colors must come from `app/constants/colors.ts` (no color literals)
- No inline styles — use StyleSheet
- No raw text outside `<Text>` components
- Components must be React Compiler compatible (no violations of Rules of React)

## Data Types (`app/data/types.ts`)

Core types: `Book`, `Chapter`, `Volume`, `Reference`, `SectionGroup`, `HistoryItem`. The `Reference` type handles cross-volume reference conversion with fields for target book, chapter, paragraph range, and verse range.

## External Services

- **Sentry** — Error tracking (org: `restoration-scriptures-foundat`, project: `restoration-scriptures`)
- **scriptures.info** — Audio file hosting and tracklist API
- **EAS (Expo Application Services)** — Build and deployment pipeline

## Patches

`patches/` contains modifications to `@weights-ai/react-native-track-player` applied via `patch-package` on `postinstall`.
