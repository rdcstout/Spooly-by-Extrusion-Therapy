# Contributing to Spooly

Thanks for helping improve Spooly. Contributions that make printer monitoring more reliable, accessible, or broadly compatible are welcome.

## Before opening an issue

- Search existing issues first.
- Use the printer compatibility template for a new or partially supported printer.
- Remove access codes, serial numbers, public IP addresses, private IP addresses, Wi-Fi details, and other personal information from screenshots and logs.
- Do not upload a Spooly configuration backup. It can contain a Bambu access code.

## Development

Use Node.js 20 or newer and pnpm.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm test
pnpm start
```

Keep changes focused. Add or update tests for behavior changes. Before opening a pull request, run:

```sh
pnpm test
pnpm audit --prod --audit-level high
```

## Packaging

On macOS, use `pnpm run dist:mac` with Xcode command-line tools and the configured signing credentials.

Before Windows packaging, run `scripts\build-fallback-windows.cmd` on Windows with Node.js and MSVC x64 Build Tools installed. It builds the native helper into `build/fallback/win32-x64`; copy that output into the same source checkout if cross-packaging with Electron Builder. Then run `pnpm run dist:win`.

See the [Linux guide](docs/LINUX_INSTALL.md) for Linux builds. Vendor networking libraries are not bundled.

## Pull requests

Describe the problem, the change, and how you tested it. For user-interface changes, include screenshots or a short recording. For printer support, identify the protocol and model without exposing credentials or unique device identifiers.

By submitting a contribution, you agree that it may be distributed under the repository's GPL-3.0 license.
