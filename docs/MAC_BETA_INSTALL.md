# Installing Spooly on macOS

Starting with Spooly 0.1.12, the macOS build is signed with an Apple Developer ID and notarized by Apple.

1. Open the Spooly DMG and drag Spooly into Applications.
2. Open Spooly from Applications.
3. If macOS displays its standard message that Spooly was downloaded from the internet, confirm that you want to open it.

You should not need to create an exception in Privacy & Security. If macOS reports that the developer cannot be verified, delete that copy and download the current DMG from the official [Spooly releases page](https://github.com/rdcstout/Spooly-by-Extrusion-Therapy/releases/latest).

Spooly runs locally and connects only to printers configured on the local network.
## Printers offline or scans find nothing

Check printer power, its current IP address, and that both devices are on the same network. In Spooly Setup, open **Can’t find or connect to your printer?**

Choose **Open Privacy Settings**, select **Local Network**, and allow Spooly. If it already says **On**, turn it off and back on; check each Spooly entry if there are duplicates. Then use **Check / Retry**, or scan again. This can recover stuck macOS permission state without changing your firewall or router.

The connection check only tests whether the saved printer’s network port is reachable, not its access code or telemetry. An unreachable result can also mean the printer is off, its IP changed, or the network is unavailable.
