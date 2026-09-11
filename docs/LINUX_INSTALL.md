# Linux installation

Spooly provides x86-64 Linux packages. Tested on Ubuntu 26.04.1 with XWayland; other distributions and native Wayland operation have not been verified. Launch at login is currently available on macOS and Windows only.

## Ubuntu: recommended .deb

1. [Download the DEB](https://github.com/rdcstout/Spooly-by-Extrusion-Therapy/releases/latest/download/Spooly-Linux-amd64.deb).
2. Open it with your package installer and enter your administrator password if asked.
3. Launch **Spooly** from the applications menu.

Prefer Terminal? Open Terminal in the download folder and run:

```sh
sudo apt install ./Spooly-Linux-amd64.deb
```

## AppImage

For Ubuntu, use the setup bundle:

1. [Download the AppImage setup bundle](https://github.com/rdcstout/Spooly-by-Extrusion-Therapy/releases/latest/download/Spooly-Linux-AppImage-Setup.tar.gz) and extract it.
2. Open Terminal in the extracted folder. Keep the files together and run:

   ```sh
   bash install-linux-appimage.sh ./Spooly-Linux-x86_64.AppImage
   ```

3. Enter your administrator password when asked.
4. Launch **Spooly (AppImage)** from the applications menu.

On systems that permit sandbox user namespaces, you can instead [download the standalone AppImage](https://github.com/rdcstout/Spooly-by-Extrusion-Therapy/releases/latest/download/Spooly-Linux-x86_64.AppImage), make it executable, and open it. Do not run the app with sudo or disable its sandbox.

<details>
<summary>Updating or removing Spooly</summary>

- **Update:** Quit Spooly, then install the newer DEB or rerun the AppImage setup with the new AppImage. Printer settings are preserved.
- **Remove DEB:** Run `sudo apt remove spooly`.
- **Remove installed AppImage:** Run `bash uninstall-linux-appimage.sh` from the extracted setup bundle.
- **Remove standalone AppImage:** Delete the downloaded file.

Removal leaves your user settings in place.

</details>

<details>
<summary>What the AppImage setup does</summary>

Installs a root-owned copy at `/opt/spooly-appimage/Spooly.AppImage`, adds an applications-menu entry, and permits sandbox user namespaces for that path when Ubuntu requires it. It does not change global namespace or firewall settings. After setup, launch the menu entry, not the original download.

</details>

<details>
<summary>Building from source (developers only)</summary>

Build on x86-64 Ubuntu with Node.js, pnpm, Python 3/GObject GdkPixbuf, `dpkg-deb`, `desktop-file-validate`, and AppImage's `appimagetool` installed. The .deb dependency names target modern Ubuntu (t64 libraries).

```sh
pnpm install --frozen-lockfile
pnpm test
APPIMAGETOOL=/absolute/path/to/appimagetool-x86_64.AppImage pnpm run dist:linux
```

The build starts with the checked-out source, not an installed Spooly or private test application. No printer configuration is included. See the release checksums to verify downloaded packages.

</details>
