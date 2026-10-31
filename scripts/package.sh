#!/usr/bin/env bash
# Builds theme-loader.zip, bundling every plugin zip that sits next to this
# source folder (../*.zip) so the store works out of the box on any Deck.
set -euo pipefail

cd "$(dirname "$0")/.."
STORE_DIR="$(cd .. && pwd)"

npm run build

stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
dest="$stage/theme-loader"
mkdir -p "$dest/dist" "$dest/assets" "$dest/packages"
cp dist/index.js "$dest/dist/"
cp -r assets/screenshots assets/thumbs "$dest/assets/"
cp main.py plugin.json package.json LICENSE README.md "$dest/"

for zip in "$STORE_DIR"/*.zip; do
  [ "$(basename "$zip")" = "theme-loader.zip" ] && continue
  cp "$zip" "$dest/packages/"
  echo "Bundled $(basename "$zip")"
done

out="$STORE_DIR/theme-loader.zip"
rm -f "$out"
(cd "$stage" && python3 -I -m zipfile -c "$out" theme-loader)
echo "Created $out ($(du -h "$out" | cut -f1))"
