#!/usr/bin/env python3
"""Generates catalog.json (the remote update catalog read by Theme Loader) from plugin zips.

Usage:
  scripts/make_catalog.py [--url TEMPLATE] ZIP[=URL] ... > catalog.json

Each ZIP is listed with its version, size and sha256. "ZIP=URL" sets that plugin's download
URL (e.g. its own GitHub release); otherwise --url is used, with {id}, {version}, {tag} and
{file} replaced for each zip. Upload every zip to its URL, then publish catalog.json where
DEFAULT_CATALOG_URL in main.py points (the latest release of decky-theme-loader).
"""
import argparse
import hashlib
import json
import os
import sys
import zipfile


def zip_version(path: str) -> str:
    """version from the top-level package.json (falls back to plugin.json), like main.read_zip_meta."""
    with zipfile.ZipFile(path) as zf:
        for filename in ("package.json", "plugin.json"):
            matches = [n for n in zf.namelist() if n.endswith(filename) and n.count("/") <= 1]
            if matches:
                version = json.loads(zf.read(min(matches, key=len))).get("version", "")
                if version:
                    return version
    return ""


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "--url",
        default="https://github.com/kromossomom-debug/decky-theme-loader/releases/download/{tag}/{file}",
        help="download URL template with {id}, {version}, {tag} (Theme Loader release tag) and {file}",
    )
    parser.add_argument("--tag", default="", help="Theme Loader release tag for {tag} (default: v<theme-loader version>)")
    parser.add_argument("zips", nargs="+")
    args = parser.parse_args()

    items = [(z.split("=", 1) + [""])[:2] for z in args.zips]
    tag = args.tag
    if not tag:
        self_zip = next((p for p, _ in items if os.path.basename(p) == "theme-loader.zip"), None)
        here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        tag = "v" + (zip_version(self_zip) if self_zip else json.load(open(os.path.join(here, "package.json")))["version"])

    plugins = []
    for path, explicit_url in items:
        plugin_id = os.path.splitext(os.path.basename(path))[0]
        version = zip_version(path)
        if not version:
            sys.exit(f"{path}: no version in package.json/plugin.json")
        with open(path, "rb") as f:
            data = f.read()
        plugins.append({
            "id": plugin_id,
            "version": version,
            "url": explicit_url or args.url.format(id=plugin_id, version=version, tag=tag, file=os.path.basename(path)),
            "size": len(data),
            "sha256": hashlib.sha256(data).hexdigest(),
        })
    json.dump({"schema": 1, "plugins": plugins}, sys.stdout, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
