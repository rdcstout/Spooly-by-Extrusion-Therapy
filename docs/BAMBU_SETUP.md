# Connecting a Bambu Lab printer to Spooly

Spooly monitors Bambu printers directly over your local network. Your printer can remain on stock firmware and in its normal cloud-connected mode. **Do not enable LAN Only mode unless the normal setup fails.**

## What you need

- The printer and the computer running Spooly on the same local network
- The printer's IP address
- The printer's serial number (SN)
- The printer's access code

Spooly stores the access code locally with the rest of its configuration under your operating-system user account. It does not send the code to a cloud service. A configuration backup contains the code, so keep exported backups private.

## Recommended setup: Scan

1. Turn on the printer and confirm it is connected to your normal Wi-Fi network.
2. Open **Spooly Setup** and select **Bambu Lab** as the printer type.
3. Click **Scan local network**.
4. Select your printer from the discovered list. Spooly fills in its name, IP address, and serial number automatically.
5. On a newer Bambu printer, open **Settings → LAN Only**. The access code is displayed on that page. **Do not turn LAN Only on**; opening the page does not change the printer's mode.
6. On an older interface, open **Settings → Network/WLAN → LAN Only Mode** to find the access code. You do not need to enable the mode.
7. Copy the **access code** into Spooly exactly as displayed.
8. Click **Save & connect**. Wait for the green “connected successfully” message.

This scan flow has been verified against an X1 Carbon and H2S operating in their normal cloud-connected modes.

## X1 Carbon: manual fallback

If Scan cannot cross your network:

1. Open the X1C **Settings → Network/WLAN → LAN Only Mode** page and copy its IP address and access code without enabling LAN Only mode.
2. Open **Settings → General → Device Info**. On newer interface versions this may be named **Device & Serial Number**.
3. Enter the IP address, complete serial number, and access code in Spooly.

BIGTREETECH's Panda products use the same local binding information—IP address, serial number, and access code—and their official setup guide confirms that these values can be discovered while the printer remains on its normal network connection. See the [Panda Status binding guide](https://global.bttwiki.com/Panda_Status.html) and [Panda Touch connection-details guide](https://neo.bttwiki.com/en/docs/panda-series/panda-touch/panda-touch-firmware).

## H2S

Spooly's scan successfully discovers the H2S and fills its IP address and serial number while it remains in normal cloud mode. To read its access code manually, open **Settings → LAN Only**. Do not enable LAN Only mode; Spooly has been verified while the H2S remains in its normal cloud-connected mode.

Bambu states that H2S Developer Mode exposes MQTT access for third-party integrations, but that mode should be treated as a fallback—not the normal first step. Bambu also notes that Developer Mode cannot be enabled while laser or cutting functions are in use. See the [official H2S product information](https://au.store.bambulab.com/en/products/h2s).

## If Spooly cannot connect

Work through these in order:

1. Confirm the printer and computer are on the same network. Guest Wi-Fi and “device isolation” commonly prevent local devices from seeing one another.
2. Temporarily disable a VPN on the computer.
3. Recheck every character in the serial number and access code. A connection can reach the printer but receive no status if the serial number is wrong.
4. Confirm the printer's IP address has not changed. Reserving the printer's address in your router prevents this later.
5. If the access-code field is missing, make sure the printer has completed its normal Bambu account binding. BIGTREETECH documents this as an alternative to LAN Only mode for cloud-connected printers.
6. Only if current firmware blocks third-party local access, consider enabling **Developer Mode** or **LAN Only Mode**. Be aware that LAN Only mode can change cloud and Bambu Handy behavior.
7. Make sure local MQTT-over-TLS traffic on port **8883** is not blocked by a firewall or segmented network.

Bambu's security documentation explains that Developer Mode allows third-party MQTT software to function without the newer authorization-control layer. See the [Bambu Lab Security White Paper](https://cdn1.bambulab.com/trust-center/file/bambulab-security-whitepaper-en.pdf).

## Experimental Bambu Fallback

If the regular Bambu connection does not work, try **Bambu (Fallback)** in the printer-type menu, then **Find printers**, select your printer, and **Save & connect**.

This experimental option may provide another way to connect if you're having difficulty with the regular Bambu connection. If it is unavailable, the option will be disabled.

## Information to collect when asking for help

- Printer model
- Printer firmware version
- Computer operating system
- Whether the printer is in normal, LAN Only, or Developer Mode
- Whether your slicer can connect to the printer
- The exact Spooly error message

Never post your access code publicly.
