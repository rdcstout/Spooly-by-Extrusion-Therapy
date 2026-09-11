# Changelog

## 0.1.18

- Added Linux x86-64 `.deb` and AppImage packages, tested on Ubuntu with XWayland.
- Fixed Bambu discovery on computers with multiple network adapters, including VPN adapters, by sending discovery requests independently on each interface.
- Added Linux desktop integration and appropriately sized application and tray icons.

## 0.1.17

- Limited setup connection messages and error codes to printers added during the current save.
- Preserved existing printer connections when saving unchanged settings.

## 0.1.16

- Added persistent Bambu connection-status messages in Setup for discovery, network, secure-connection, access-code, subscription, and printer-data failures.
- Changed Bambu setup success so it appears only after Spooly receives live printer data.

## 0.1.15

- Added printer-reported time remaining beside print progress when that data is available.
- Added an optional quiet weekly update check while keeping the manual update button.
- Improved add-printer scanning so an already-added printer no longer pulls the setup view away from the new printer entry.

## 0.1.14

- Fixed a white background appearing around Spooly at the smallest size on some standard-DPI displays.

## 0.1.13

- Added proportional resizing for the printer-status popup, including remembered size and multi-monitor placement.
- Changed fleet layout to fill up to four printer rows before adding another column.
- Reduced the popup's mouse-away close delay to 1.5 seconds.
- Added a manual Check for updates button in Setup.
- Adjusted the macOS installer layout so the Applications shortcut remains fully visible.

## 0.1.12

- Replaced ad-hoc macOS signing with an Apple Developer ID signature.
- Enabled the hardened runtime required by Apple's notarization service.
- Added notarization, ticket stapling, and Gatekeeper verification to the macOS release pipeline.
- Removed the obsolete macOS Security Settings workaround from the signed installer.

## 0.1.11

- Fixed mascot size drift while dragging Spooly between Windows displays using different scaling levels.
- Kept drag movement and window sizing atomic across mixed-DPI monitor transitions.
- Added regression coverage for repeated 100% to 125% display transitions and display-edge clamping.

## 0.1.10

- Fixed fleet-state priority so a completed printer takes precedence when another printer is still printing.
- Preserved higher-priority error, filament-out, and paused states above completion.
- Added regression coverage for mixed-printer completion scenarios regardless of printer order.
- Updated patched transitive dependencies used by configuration and network libraries.

## 0.1.8

- Added status-colored telemetry, progress bars, multi-nozzle handling, fan reporting, configuration backup/restore, and the current animated Spooly states.
- Improved duplicate-printer detection, local discovery, window placement, live resizing, launch-at-login behavior, and status-bubble layout.
