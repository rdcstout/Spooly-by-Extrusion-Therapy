# Privacy and local data

Spooly is a local-network desktop application. It has no Spooly account, cloud backend, analytics, advertising SDK, crash-report upload, or usage telemetry.

## Network traffic

Spooly contacts only:

- Bambu printers configured or discovered on the local network, using local MQTT over TLS on port 8883.
- Moonraker-compatible printers configured or discovered on the local network, using the Moonraker HTTP API (normally port 7125).
- Repetier-Server hosts configured on the local network, using the Repetier-Server HTTP API (normally port 3344). The server API key is sent to that host in an `X-Api-Key` request header and is not sent anywhere else.
- Duet / RepRapFirmware boards configured on the local network, using the RepRapFirmware object-model HTTP API (normally port 80). No credentials are sent.
- GitHub's public Releases API when the user checks manually or when the optional weekly update check is due. The request checks only the published Spooly version and does not include printer configuration.
- `extrusiontherapy.com` only when the user clicks the Extrusion Therapy link in Setup; this opens the system browser.

Discovery uses local multicast/Bonjour traffic and bounded scanning of private IPv4 networks. Spooly does not send discovered printer information to Extrusion Therapy or another cloud service.

## Stored data

Spooly stores the printer connection details and application preferences needed to reconnect and restore its layout under the current operating-system user account. For Repetier-Server printers this includes the server API key, which is kept in the same local configuration file as the other connection details:

- macOS: `~/Library/Application Support/spooly/config.json`
- Windows: `%APPDATA%\spooly\config.json`

The containing folder and configuration file are created with user-only permissions where the operating system supports Unix file modes. Spooly does not send this configuration to a Spooly server or third-party analytics service.

## Configuration backups

An exported Spooly configuration backup includes the information needed to reconnect to configured printers. Keep backups private and do not attach them to public GitHub issues.

## Removing data

Removing the application does not automatically remove its configuration. Delete the `spooly` folder at the path above if you also want to remove its saved settings.
