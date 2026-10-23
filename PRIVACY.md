# Privacy and local data

Spooly stores printer configuration locally. The optional experimental Bambu Fallback connection contacts Bambu's service for printer status.

## Network traffic

Spooly contacts only:

- Bambu printers configured or discovered on the local network, using local MQTT over TLS on port 8883.
- Bambu's service when Bambu Fallback is selected.
- Moonraker-compatible printers configured or discovered on the local network, using the Moonraker HTTP API (normally port 7125).
- GitHub's public Releases API when the user checks manually or when the optional weekly update check is due. The request checks only the published Spooly version and does not include printer configuration.
- `extrusiontherapy.com` only when the user clicks the Extrusion Therapy link in Setup; this opens the system browser.

Discovery uses local multicast/Bonjour traffic and bounded scanning of private IPv4 networks. Spooly does not send discovered printer information to Extrusion Therapy. Bambu Fallback subscribes to the configured printer's status through Bambu's service.

## Stored data

Spooly stores the printer connection details and application preferences needed to reconnect and restore its layout under the current operating-system user account:

- macOS: `~/Library/Application Support/spooly/config.json`
- Windows: `%APPDATA%\spooly\config.json`

The containing folder and configuration file are created with user-only permissions where the operating system supports Unix file modes. Spooly does not send this configuration to a Spooly server or third-party analytics service.

## Configuration backups

Bambu Fallback's temporary authentication data is excluded from configuration backups and installers and removed when its helper closes normally.

An exported Spooly configuration backup includes the information needed to reconnect to configured printers. Keep backups private and do not attach them to public GitHub issues.

## Removing data

Removing the application does not automatically remove its configuration. Delete the `spooly` folder at the path above if you also want to remove its saved settings.
