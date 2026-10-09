#!/usr/bin/env bash
# Installs the pinned OrcaSlicer for the QR tag's slicer check (tools/test-slicer.ts) on an Ubuntu 24.04 CI runner: downloads the
# AppImage (or takes it from $ORCA_APPIMAGE_CACHE), checks its SHA-256, unpacks it without FUSE, installs the system libraries its
# command line still links against, and checks that it starts. Prints the path to set as ORCA_SLICER.
#
# OrcaSlicer is AGPL-3.0: CI only runs it as a separate program and never ships it in an image.
# Only the path goes to stdout; everything else to stderr.
set -euo pipefail
version=2.4.2
file="OrcaSlicer_Linux_AppImage_Ubuntu2404_V${version}.AppImage"
sha256=d12fb8c8eac1aecd2dfb6377acd48f994f8fa439ed5292fa532dd82880f029fd
destination="${1:-$HOME/.local/orca-slicer}"
cache="${ORCA_APPIMAGE_CACHE:-$HOME/.cache/orca-slicer}"

mkdir -p "$cache" "$destination"
if [ ! -f "$cache/$file" ] || ! echo "$sha256  $cache/$file" | sha256sum -c --status; then
  curl -fsSL -o "$cache/$file" "https://github.com/SoftFever/OrcaSlicer/releases/download/v${version}/${file}" >&2
fi
echo "$sha256  $cache/$file" | sha256sum -c - >&2

# the command line links GTK, WebKitGTK and GLU even without a display
if command -v sudo >/dev/null && command -v apt-get >/dev/null; then
  sudo apt-get update -qq >&2
  sudo apt-get install -y -qq --no-install-recommends libwebkit2gtk-4.1-0 libglu1-mesa libgtk-3-0t64 >&2
fi

rm -rf "$destination/squashfs-root"
chmod +x "$cache/$file"
(cd "$destination" && "$cache/$file" --appimage-extract >/dev/null)
app="$destination/squashfs-root"
missing=$(LD_LIBRARY_PATH="$app/lib/orca-runtime:$app/bin" ldd "$app/bin/orca-slicer" | grep 'not found' || true)
if [ -n "$missing" ]; then
  echo "OrcaSlicer ${version} is missing system libraries:" >&2
  echo "$missing" >&2
  exit 1
fi
"$app/AppRun" --help > "$destination/help.txt" 2>&1 || { cat "$destination/help.txt" >&2; exit 1; }
head -1 "$destination/help.txt" >&2
echo "$app/AppRun"
