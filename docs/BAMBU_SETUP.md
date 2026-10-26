# Connecting a Bambu Lab printer

Choose a connection in **Spooly Setup**:

- **Bambu Local** connects over your local network. Your printer can stay in its normal cloud-connected mode; LAN Only mode is not required.
- **Bambu Cloud** attempts to connect through the cloud. This experimental option was previously called Bambu Fallback.

## Bambu Local

1. Connect your computer and printer to the same local network.
2. In Setup, add a printer and choose **Bambu Local**.
3. Click **Scan local network**, then select your printer. Spooly fills in its name, IP address, and serial number.
4. Copy the printer's access code into Spooly. Depending on the printer, look under **Settings → LAN Only** or **Settings → Network/WLAN → LAN Only Mode**. Opening that page does not enable LAN Only mode.
5. Click **Save & connect**. Spooly confirms success after receiving printer status.

If the scan finds nothing, enter the printer's IP address, serial number, and access code manually. Keep exported configuration backups private because they contain connection details.

## Bambu Cloud

1. In Setup, add a printer and choose **Bambu Cloud**.
2. Click **Find printers** and select your printer.
3. Click **Save & connect**.

Bambu Cloud requires internet access and an online, cloud-connected printer. If the connection option is unavailable on your computer, it is disabled.

## Connection help

For **Bambu Local**, check the printer's current IP address, serial number, and access code. Guest Wi-Fi, network isolation, VPN routing, and firewall rules can prevent a local connection. Reserving the printer's IP address in your router helps keep its address consistent.

On macOS, use the [Local Network permission checks](MAC_BETA_INSTALL.md#printers-offline-or-scans-find-nothing) if local scans or connections fail.

For **Bambu Cloud**, check your internet connection and that the printer is online. You can try Bambu Local when both devices are on the same network.

When asking for help, include the printer model, firmware version, computer operating system, selected connection method, and exact Spooly error message. Never post your access code or configuration backup publicly.
