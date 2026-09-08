<div align="center">

# Spooly by Extrusion Therapy

### A free desktop companion for your 3D printers

[![Spooly watching multiple 3D printers](docs/assets/spooly-hero.jpg)](https://extrusiontherapy.com)

[![Download for macOS](https://img.shields.io/badge/Download-macOS-111111?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/rdcstout/Spooly-by-Extrusion-Therapy/releases/latest/download/Spooly-macOS-arm64.dmg)
[![Download for Windows](https://img.shields.io/badge/Download-Windows-0078D4?style=for-the-badge&logo=windows11&logoColor=white)](https://github.com/rdcstout/Spooly-by-Extrusion-Therapy/releases/latest/download/Spooly-Setup-Windows-x64.exe)

[![Latest release](https://img.shields.io/github/v/release/rdcstout/Spooly-by-Extrusion-Therapy?style=flat-square&label=latest%20release)](../../releases/latest)
[![License: GPL v3](https://img.shields.io/badge/license-GPLv3-blue?style=flat-square)](LICENSE)
[![Extrusion Therapy](https://img.shields.io/badge/Extrusion%20Therapy-website-d52b1e?style=flat-square)](https://extrusiontherapy.com)

</div>

## Download

| Platform | System | Installer |
| --- | --- | --- |
| **macOS** | Apple silicon | **[Download `.dmg`](https://github.com/rdcstout/Spooly-by-Extrusion-Therapy/releases/latest/download/Spooly-macOS-arm64.dmg)** |
| **Windows** | 64-bit | **[Download installer `.exe`](https://github.com/rdcstout/Spooly-by-Extrusion-Therapy/releases/latest/download/Spooly-Setup-Windows-x64.exe)** |

Spooly is free. Downloads are never gated behind payment. You can also browse the [latest GitHub release](../../releases/latest).

> **Installation note:** Starting with version 0.1.12, the macOS build is signed with an Apple Developer ID and notarized by Apple. macOS may still show its standard first-open confirmation for an app downloaded from the internet. The Windows build is not yet signed with a Microsoft code-signing certificate, so Windows SmartScreen may ask you to confirm that you want to run it. See the [macOS installation guide](docs/MAC_BETA_INSTALL.md).

## See your printers without keeping every slicer open

Spooly is a small, always-on-top desktop pet that watches supported printers on your local network. Click Spooly for a compact fleet view with each printer's state, progress, temperatures, and reported fans.

### At a glance

- Idle, printing, paused, filament-out, error, complete, and offline states
- A priority system that makes attention states and completed jobs outrank ordinary printing
- Print percentage, printer-reported time remaining, and a status-colored progress bar when available
- Actual and target nozzle/bed temperatures while printing or paused; actual temperatures otherwise
- Part, auxiliary, and chamber fan states when the printer reports them
- Animated mascot reactions and automatic attention bubbles
- Local-network discovery for Bambu Lab and Moonraker-compatible printers, and printer lookup for Repetier-Server hosts
- Multiple-printer monitoring, duplicate detection, configuration backup/restore, adjustable mascot size, launch at login, and optional weekly update checks
- Read-only monitoring: Spooly does not start, pause, stop, or modify prints

## Compatibility

| Connection | Verified hardware | What to expect |
| --- | --- | --- |
| **Bambu local MQTT** | X1 Carbon, H2S | Local discovery, status, progress, temperatures, and reported fans. An access code and serial number are required. |
| **Klipper / Moonraker** | Snapmaker U1 | Local discovery and monitoring through Moonraker's HTTP API. |
| **Repetier-Server** | Reported working | Monitoring through Repetier-Server's local HTTP API. A server API key and the printer's slug are required; press **Fetch printers** in Setup to list the slugs the server exposes. |

> **Snapmaker U1 with Paxx12 firmware:** If Spooly reports `Moonraker returned 401`, Moonraker's **Require Login** option is enabled. The current Spooly release does not yet support authenticated Moonraker connections. Open `http://<printer-ip>/firmware-config/` and disable **Require Login** to connect. Optional Moonraker API-key support is planned for a future update.

Other Bambu Lab and Moonraker-compatible machines may work because they use the same protocols, but they have not all been physically verified. If Spooly discovers your printer but cannot monitor it correctly, please open a [printer compatibility report](../../issues/new?template=printer_compatibility.yml).

- [Bambu Lab setup guide](docs/BAMBU_SETUP.md)
- [Klipper / Moonraker setup guide](docs/KLIPPER_SETUP.md)

## How it works

Spooly runs on your Mac or Windows PC and connects directly to configured printers on the same local network. Bambu connections use the printer's local MQTT-over-TLS service. Klipper connections use Moonraker's local HTTP API. There is no Spooly account, cloud relay, analytics service, or telemetry collection.

Printer configuration stays on the computer under the current operating-system user account. Spooly has no account system, cloud service, advertising, or analytics. Read the full [privacy and local-data note](PRIVACY.md).

## Support future tools

Spooly is free and open source. If it helps in your shop, you can optionally **[support future Extrusion Therapy tools](https://buy.stripe.com/fZu3cw2Mnfr0d7N3ws1kA00)**. The installers and source remain available without payment.

## Build from source

Requirements: Node.js 20 or newer and pnpm.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm test
pnpm start
```

Packaging commands:

```sh
pnpm run dist:mac
pnpm run dist:win
```

The macOS command requires macOS. Cross-building the Windows packages uses Electron Builder.

## Contributing

Bug reports, compatibility reports, documentation improvements, and pull requests are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md). Never include printer access codes, serial numbers, private IP addresses, or unredacted configuration backups in a public issue.

## License and identity

The source code is available under the [GNU General Public License v3.0](LICENSE). The Spooly name, character, logo, and official release identity are covered by the separate [trademark and artwork notice](TRADEMARKS.md).

## Independent utility

Created by [Extrusion Therapy](https://extrusiontherapy.com) as an independent workshop utility. Spooly is not affiliated with or endorsed by Bambu Lab, Klipper, Moonraker, or Snapmaker.
