# Changelog

## 1.5.0

- **New in the store: Xbox 360 NXE Dashboard 1.0.0.** The 2008 Xbox 360 "New Xbox Experience" dashboard: a lime-green
  scene with a glossy floor, a hub list (video & music, game marketplace, my xbox, xbox live, system) and a deck of
  glass cards where the focused card is big and the rest recede in perspective. Bundled with Theme Loader.
- **Xbox 360 Dashboard 1.1.0.** The Metro dashboard no longer has 3D avatars or the Avatar Editor: it starts straight
  on the dashboard and shows your Steam profile picture as the gamerpic. The package is much smaller.
- The store pages of both dashboards have new screenshots.

## 1.4.1

- **Xbox 360 Dashboard 1.0.1.** The D-pad now follows the tiles on screen: up / down stays in a column and
  left / right moves to the next column at the same height, on the dashboard, in the Avatar Editor and on
  *Select an Avatar*.

## 1.4.0

- **New in the store: Xbox 360 Dashboard 1.0.0.** The 2011 Xbox 360 Metro dashboard: pivot tabs (home, social,
  games, tv & movies, music, apps, settings), big and small tiles, the Guide, and original 3D avatars with an
  Avatar Editor. On first launch it asks you to pick one of ten ready-made avatars. Bundled with Theme Loader and
  published in this release.

## 1.3.0

- **Clean full screen.** Steam's top bar (clock, battery and profile) is hidden while the store or a plugin page is
  open, and comes back as soon as you leave. The bar is found by the stable names of Steam's class module, not by
  hashed class names, so it survives most Steam updates.
- **English first.** The interface and the backend messages are in English, and English is the fallback when Steam's
  language isn't one of the supported ones (English, Portuguese, German, Polish).
- The full-screen gallery hides the page behind it completely.
- `scripts/make_catalog.py` accepts `plugin.zip=URL`, so each plugin can point to its own repository's release.
- Removed the old demo-video script, which rendered the 1.0 interface.

## 1.2.0

- **Online updates.** Theme Loader reads `catalog.json` from the latest GitHub release and shows
  **Update available** as soon as a new version is published. ZIPs are downloaded with a progress bar, checked
  against their size and SHA-256, and installed. Offline, the store keeps using its local packages.
- The self-update banner also works with a newer Theme Loader from the online catalog.
- `scripts/make_catalog.py` generates the catalog from a set of plugin ZIPs.

## 1.1.0

- **New store.** A full-screen store with a spotlight that follows the focused plugin, cards with real screenshots,
  L1 / R1 tabs (All, Dashboards, Extras, Installed, Updates) and a dynamic background in each plugin's colors.
- **Update detection.** Installed and store versions are compared (semver, including `-alpha` / `-beta`), with an
  **Update available** badge, **Update to vX**, **Update all** and a self-update banner for Theme Loader.
- **Plugin pages** with an *Installed → In store* panel, uninstall confirmation, highlights and details.
- **Screenshot gallery** with thumbnails, full-size images loaded on demand and D-pad / L1 / R1 navigation.
- **Screenshots** normalized to 1280×800; crops and collages get a frame in the plugin's colors. Ten screenshots
  that existed but never showed up are now listed.
- **Bundled packages.** The plugin ZIPs ship inside `theme-loader.zip`, so the store isn't empty on a fresh Deck.
- **Fixes:** Theme Loader no longer lists, rolls or uninstalls itself; a plugin installed under another folder name is
  replaced instead of duplicated; ZIP extraction rejects paths outside the plugin folder.
- Quick Access panel redesigned with thumbnails and a **Buy Me a Coffee** button.

## 1.0.0

- First version: a grid of plugins from `~/Documents/theme-loader`, screenshots, install / uninstall and a random
  theme installer.
