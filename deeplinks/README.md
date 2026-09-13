# Deep links — opening a scripture reference from a URL

A link like

```
https://scriptures.info/scriptures/cc/ether/1.2#2
```

opens the app directly to that reference (Covenant of Christ → Ether 1, scrolled to
paragraph 2). If the app is not installed the URL just loads the website as normal,
so these links are safe to put in emails, messages, and web pages.

## URL format

```
https://scriptures.info/scriptures/<volume>/<book>/<chapter>[.<paragraph>][#<paragraph>]
```

| Part          | Meaning                                                              |
| ------------- | ------------------------------------------------------------------- |
| `<volume>`    | `cc`, `oc`, `nc`, `nt`, `bofm`, `tc` — disambiguates books that exist in more than one volume (e.g. `ether`). |
| `<book>`      | Any book name/abbreviation the app recognises (`ether`, `1nephi`, `t&c`, `genesis`, …). |
| `<chapter>`   | Chapter number (section id for T&C).                                |
| `<paragraph>` | Optional. Paragraph to scroll to. May be given as `.N`, `#N`, or both. |

The custom scheme `rescriptures://scriptures/cc/ether/1.2#2` works too (app-installed only).

## What lives where

- **App side** (this repo, already done):
  - `app.json` — `ios.associatedDomains` + `android.intentFilters` (`autoVerify`).
  - `app/util/scriptureLink.ts` — URL parser (unit-tested).
  - `app/hooks/useScriptureDeepLink.ts` — resolves the URL and navigates the reader.
  - Rebuild native apps for these to take effect: `npx expo prebuild --clean` then
    `eas build`. OTA updates **cannot** add link handling — it needs a store build.

- **Website side** (deploy to the `scriptures.info` web server):
  - `deeplinks/well-known/apple-app-site-association`
  - `deeplinks/well-known/assetlinks.json`

  Both must be served from `https://scriptures.info/.well-known/<file>`:
  - over HTTPS, HTTP 200, **no redirects**
  - `Content-Type: application/json`
  - `apple-app-site-association` has **no file extension**

## Filling in `assetlinks.json`

Replace the two placeholder fingerprints:

- **Play app-signing key** (needed once the app is on Google Play):
  Play Console → your app → *Test and release* → *Setup* → *App integrity* →
  *App signing key certificate* → copy the **SHA-256 certificate fingerprint**.
- **Upload / EAS build key** (needed for internal `.apk` / pre-Play testing):
  ```
  eas credentials -p android
  ```
  choose the production profile → *Keystore* → read the **SHA-256 Fingerprint**.

Keep both entries so links verify on Play builds and on sideloaded test builds.
Remove the second one if you only care about Play.

## Verifying after deploy

- Apple: `https://app-site-association.cdn-apple.com/a/v1/scriptures.info`
  (Apple's CDN — may lag ~24–48h) or the Branch AASA validator.
- Android: `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://scriptures.info&relation=delegate_permission/common.handle_all_urls`
- On device (Android 12+): `adb shell pm verify-app-links --re-verify info.scriptures.rescriptures`
  then `adb shell pm get-app-links info.scriptures.rescriptures`.
- Quick manual test: `npx uri-scheme open "https://scriptures.info/scriptures/cc/ether/1.2#2" --ios`
  (or `--android`).
