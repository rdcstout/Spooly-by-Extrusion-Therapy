#!/bin/bash
set -euo pipefail
if [[ $EUID != 0 ]]; then exec sudo -- bash "$(realpath -- "$0")"; fi
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
destination=/opt/spooly-appimage
profile=/etc/apparmor.d/spooly-appimage
[[ ! -L "$destination" && ! -L "$profile" ]] || { echo 'Refusing symbolic-link targets.' >&2; exit 1; }
[[ -f "$destination/.spooly-managed" && $(stat -c %u "$destination") == 0 ]] || { echo 'No managed Spooly AppImage installation found.' >&2; exit 1; }
if [[ -e "$profile" ]]; then
  grep -Fq 'profile spooly-appimage /opt/spooly-appimage/Spooly.AppImage' "$profile" || { echo 'Unrecognized profile; nothing removed.' >&2; exit 1; }
  apparmor_parser -R "$profile"
  rm -- "$profile"
fi
rm -f -- "$destination/Spooly.AppImage" "$destination/.spooly-managed"
rmdir -- "$destination"
rm -f -- /usr/share/applications/spooly-appimage.desktop /usr/share/icons/hicolor/256x256/apps/spooly-appimage.png
if command -v update-desktop-database >/dev/null; then update-desktop-database /usr/share/applications; fi
if command -v gtk-update-icon-cache >/dev/null; then gtk-update-icon-cache -f /usr/share/icons/hicolor; fi
echo 'Spooly AppImage removed. Your printer settings were preserved.'
