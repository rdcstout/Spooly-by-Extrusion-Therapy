# Linux installation

Spooly provides x86-64 Linux packages. Tested on Ubuntu 26.04.1 with XWayland; other distributions and native Wayland operation have not been verified. Launch at login is currently available on macOS and Windows only.

## Ubuntu: recommended .deb

Download the `.deb` from the release and install it using your package installer, or:

```sh
sudo apt install ./Spooly-Linux-amd64.deb
```

Enter your administrator password when requested. Launch **Spooly** from the applications menu. Installing a newer package preserves your printer settings. Remove the application with `sudo apt remove spooly`; your user settings remain.

## AppImage

On systems permitting unprivileged user namespaces, make the AppImage executable and run it normally. Do not launch Spooly with sudo or disable its sandbox.

On Ubuntu systems restricting user namespaces, download and extract the **AppImage setup bundle**. Keep its files together and run:

```sh
bash install-linux-appimage.sh ./Spooly-Linux-x86_64.AppImage
```

This asks for administrator permission once. It installs a root-owned copy at `/opt/spooly-appimage/Spooly.AppImage`, adds an application-menu entry, and permits user namespaces only for that installed path when Ubuntu requires it. It does not change global namespace or firewall settings.

After setup, launch **Spooly (AppImage)** from the applications menu, not the original download. To update, quit Spooly and rerun the installer with the new AppImage. Configuration is preserved. Run `bash uninstall-linux-appimage.sh` from the setup bundle to remove the integrated app and its rule; user settings remain.

## Building

Build on x86-64 Ubuntu with Node.js, pnpm, Python 3/GObject GdkPixbuf, `dpkg-deb`, `desktop-file-validate`, and AppImage's `appimagetool` installed. The .deb dependency names target modern Ubuntu (t64 libraries).

```sh
pnpm install --frozen-lockfile
pnpm test
APPIMAGETOOL=/absolute/path/to/appimagetool-x86_64.AppImage pnpm run dist:linux
```

The build starts with the checked-out source, not an installed Spooly or private test application. No printer configuration is included. See the release checksums to verify downloaded packages.
