#!/bin/bash
# Optional integration for Ubuntu systems that restrict user namespaces.
# Installs a root-owned AppImage and grants user namespaces to that exact path.
set -euo pipefail
if [[ $# != 1 ]]; then
  echo "Usage: $0 /absolute/path/to/Spooly.AppImage" >&2
  exit 2
fi
image=$(realpath -- "$1")
installer_dir=$(dirname "$(realpath -- "$0")")
icon="$installer_dir/spooly.png"
[[ -f "$image" && -r "$image" ]] || { echo 'AppImage is not readable.' >&2; exit 2; }
[[ -f "$icon" && -r "$icon" ]] || { echo 'Keep spooly.png beside this installer (extract the complete setup bundle).' >&2; exit 2; }
magic=$(od -An -tx1 -j8 -N3 "$image" | tr -d ' \n')
[[ "$magic" == 414902 ]] || { echo 'Expected a type-2 AppImage.' >&2; exit 2; }
if [[ $EUID != 0 ]]; then
  exec sudo -- bash "$(realpath -- "$0")" "$image"
fi
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
destination=/opt/spooly-appimage
profile=/etc/apparmor.d/spooly-appimage
[[ ! -L "$destination" && ! -L "$profile" ]] || { echo 'Refusing symbolic-link installation targets.' >&2; exit 1; }
if [[ -e "$destination" && ! -f "$destination/.spooly-managed" ]]; then
  echo 'Destination already exists and was not created by this installer.' >&2
  exit 1
fi
if [[ -e "$destination" && $(stat -c %u "$destination") != 0 ]]; then
  echo 'Refusing a destination not owned by root.' >&2; exit 1
fi
if [[ -e "$profile" ]] && ! grep -Fq 'profile spooly-appimage /opt/spooly-appimage/Spooly.AppImage' "$profile"; then
  echo 'Refusing to replace an unrelated AppArmor profile.' >&2; exit 1
fi
work=$(mktemp -d)
trap 'rm -f "$work/profile"; rmdir "$work"' EXIT
restricted=$(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns 2>/dev/null || echo 0)
if [[ "$restricted" == 1 ]]; then
  command -v apparmor_parser >/dev/null || { echo 'AppArmor tools unavailable. Use the .deb installer.' >&2; exit 1; }
  printf '%s\n' 'abi <abi/4.0>,' 'include <tunables/global>' \
    'profile spooly-appimage /opt/spooly-appimage/Spooly.AppImage flags=(unconfined) {' \
    '  userns,' '}' > "$work/profile"
  apparmor_parser --skip-kernel-load "$work/profile"
fi
install -d -o root -g root -m 755 "$destination"
install -o root -g root -m 755 "$image" "$destination/Spooly.AppImage.new"
cmp -- "$image" "$destination/Spooly.AppImage.new"
mv -f -- "$destination/Spooly.AppImage.new" "$destination/Spooly.AppImage"
touch "$destination/.spooly-managed"
chmod 644 "$destination/.spooly-managed"
if [[ "$restricted" == 1 ]]; then
  install -o root -g root -m 644 "$work/profile" "$profile"
  apparmor_parser -r "$profile"
fi
install -D -o root -g root -m 644 "$icon" /usr/share/icons/hicolor/256x256/apps/spooly-appimage.png
printf '%s\n' '[Desktop Entry]' 'Type=Application' 'Name=Spooly (AppImage)' \
  'Exec=/opt/spooly-appimage/Spooly.AppImage' 'Icon=spooly-appimage' \
  'StartupWMClass=spooly' 'Terminal=false' 'Categories=Utility;' > /usr/share/applications/spooly-appimage.desktop
chmod 644 /usr/share/applications/spooly-appimage.desktop
if command -v update-desktop-database >/dev/null; then update-desktop-database /usr/share/applications; fi
if command -v gtk-update-icon-cache >/dev/null; then gtk-update-icon-cache -f /usr/share/icons/hicolor; fi
echo 'Installed. Start Spooly with: /opt/spooly-appimage/Spooly.AppImage'
