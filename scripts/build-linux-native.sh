#!/bin/bash
# Build on Ubuntu from a reviewed Linux unpacked runtime and canonical ASAR.
set -euo pipefail
project=$(cd -- "$(dirname -- "$0")/.." && pwd)
source_dir=$(realpath "${1:-$project/dist-linux-release/linux-unpacked}")
archive=$(realpath "${2:-$source_dir/resources/app.asar}")
version=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["version"])' "$project/package.json")
tool=${APPIMAGETOOL:-$project/appimagetool-x86_64.AppImage}
[[ -x "$tool" ]] || { echo 'Set APPIMAGETOOL to the appimagetool executable.' >&2; exit 1; }
[[ -x "$source_dir/spooly" && -f "$archive" ]] || { echo 'Build the Linux unpacked application first.' >&2; exit 1; }
work=$(mktemp -d)
debroot="$work/deb"
appdir="$work/Spooly.AppDir"
mkdir -p "$debroot/DEBIAN" "$debroot/opt/spooly" "$debroot/usr/share/applications"
cp -a "$source_dir/." "$debroot/opt/spooly/"
cp "$archive" "$debroot/opt/spooly/resources/app.asar"
python3 "$project/scripts/linux-test-icons.py" "$project/assets/spooly-idle-full.png" "$work/icons"
for size in 32 48 64 128 256 512; do
  target="$debroot/usr/share/icons/hicolor/${size}x${size}/apps"
  mkdir -p "$target"
  cp "$work/icons/${size}x${size}/apps/spooly-linux-test.png" "$target/spooly.png"
done
printf '%s\n' 'Package: spooly' "Version: $version" 'Architecture: amd64' \
  'Maintainer: Extrusion Therapy' \
  'Depends: libgtk-3-0t64, libnss3, libgbm1, libasound2t64, libxss1, libxtst6, libsecret-1-0' \
  'Description: Spooly by Extrusion Therapy - local-network printer companion' > "$debroot/DEBIAN/control"
printf '%s\n' '#!/bin/sh' 'set -e' 'chown root:root /opt/spooly/chrome-sandbox' \
  'chmod 4755 /opt/spooly/chrome-sandbox' > "$debroot/DEBIAN/postinst"
chmod 755 "$debroot/DEBIAN/postinst"
printf '%s\n' '[Desktop Entry]' 'Type=Application' 'Name=Spooly' 'Icon=spooly' \
  'StartupWMClass=spooly' 'Exec=/opt/spooly/spooly --ozone-platform=x11 --disable-gpu' \
  'Terminal=false' 'Categories=Utility;' > "$debroot/usr/share/applications/spooly.desktop"
desktop-file-validate "$debroot/usr/share/applications/spooly.desktop"
dpkg-deb -Zgzip -z1 --root-owner-group --build "$debroot" "Spooly-${version}-Linux-amd64.deb"
mkdir -p "$appdir"
cp -a "$debroot/opt/spooly/." "$appdir/"
cp "$work/icons/256x256/apps/spooly-linux-test.png" "$appdir/spooly.png"
cp "$debroot/usr/share/applications/spooly.desktop" "$appdir/spooly.desktop"
sed -i 's|Exec=/opt/spooly/spooly.*|Exec=spooly|' "$appdir/spooly.desktop"
printf '%s\n' '#!/bin/sh' 'set -eu' 'HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)' \
  'exec "$HERE/spooly" --ozone-platform=x11 --disable-gpu "$@"' > "$appdir/AppRun"
chmod 755 "$appdir/AppRun"
ln -s spooly.png "$appdir/.DirIcon"
ARCH=x86_64 "$tool" --no-appstream "$appdir" "Spooly-${version}-Linux-x86_64.AppImage"
cp "$appdir/spooly.png" ./spooly.png
sha256sum "Spooly-${version}-Linux-amd64.deb" "Spooly-${version}-Linux-x86_64.AppImage"
echo "Build workspace retained for inspection: $work"
