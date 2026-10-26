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
| **Linux** | x86-64 Ubuntu | **[Download `.deb`](https://github.com/rdcstout/Spooly-by-Extrusion-Therapy/releases/latest/download/Spooly-Linux-amd64.deb)** |
| **Linux AppImage** | x86-64 | **[Download setup bundle](https://github.com/rdcstout/Spooly-by-Extrusion-Therapy/releases/latest/download/Spooly-Linux-AppImage-Setup.tar.gz)** |

Free downloads. [Release notes](../../releases/latest) · [macOS installation](docs/MAC_BETA_INSTALL.md) · [Windows installation](docs/WINDOWS_INSTALL.md) · [Linux installation](docs/LINUX_INSTALL.md).

## See your printers without keeping every slicer open

Spooly is a small, always-on-top desktop pet that watches your 3D printers. Click Spooly for a resizable fleet view with each printer's state, progress, time remaining, temperatures, and reported fans.

### At a glance

- Idle, printing, paused, filament-out, error, complete, and offline states
- A priority system that makes attention states and completed jobs outrank ordinary printing
- Print percentage, printer-reported time remaining, and a status-colored progress bar when available
- Actual and target nozzle/bed temperatures while printing or paused; actual temperatures otherwise
- Part, auxiliary, and chamber fan states when the printer reports them
- Animated mascot reactions and automatic attention bubbles
- Bambu Local and experimental Bambu Cloud connection options, plus Klipper / Moonraker support
- Multiple-printer monitoring, duplicate detection, configuration backup/restore, adjustable mascot and popup size, and launch at login on macOS/Windows
- Check for updates in Setup, with optional weekly update checks

## Compatibility

| Connection | What to expect |
| --- | --- |
| **Bambu Local** | Connects over your local network. Your printer can stay in its normal cloud-connected mode. |
| **Bambu Cloud** | Attempts to connect through the cloud. Experimental. |
| **Klipper / Moonraker** | Discovery and monitoring through Moonraker. |

For Snapmaker U1 with Paxx12 firmware, see the [Moonraker setup guide](docs/KLIPPER_SETUP.md#snapmaker-u1-with-paxx12-firmware).

For help connecting your printer, open a [printer compatibility report](../../issues/new?template=printer_compatibility.yml).

- [Bambu Lab setup guide](docs/BAMBU_SETUP.md)
- [Klipper / Moonraker setup guide](docs/KLIPPER_SETUP.md)

## How it works

Add your printers in Setup, then click Spooly to see their status. Drag the popup's resize corner to adjust its size. Spooly reacts when a printer needs attention or finishes a print. Choose **Bambu Local** for your local network or try experimental **Bambu Cloud** for a cloud connection. See the [setup guide](docs/BAMBU_SETUP.md).

## Support future tools

Spooly is free and open source. If it helps in your shop, you can optionally **[support future Extrusion Therapy tools](https://buy.stripe.com/fZu3cw2Mnfr0d7N3ws1kA00)**. The installers and source remain available without payment.

## Build from source

See [development and packaging instructions](CONTRIBUTING.md#development).

## Contributing

Bug reports, compatibility reports, documentation improvements, and pull requests are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md). Never include printer access codes, serial numbers, private IP addresses, or unredacted configuration backups in a public issue.

## License and identity

The source code is available under the [GNU General Public License v3.0](LICENSE). The Spooly name, character, logo, and official release identity are covered by the separate [trademark and artwork notice](TRADEMARKS.md).

## Independent utility

Created by [Extrusion Therapy](https://extrusiontherapy.com) as an independent workshop utility. Spooly is not affiliated with or endorsed by Bambu Lab, Klipper, Moonraker, or Snapmaker.

## Contribution and security policies

See [CONTRIBUTING.md](CONTRIBUTING.md) for changes and validation, and [SECURITY.md](SECURITY.md) for reporting suspected vulnerabilities.
