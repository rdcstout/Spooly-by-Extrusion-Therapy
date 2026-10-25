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

## Review and updates

Coordinate substantial features, new dependencies, architectural changes, or changes to defaults with the maintainer before implementation. Keep each PR focused, explain compatibility and user-data effects, and report exactly which checks passed, failed, or remain unavailable. A build alone does not prove UI or hardware behavior.

Do not push merely to keep pace with the default branch. Update for conflicts, actionable review feedback, or a substantive improvement within the agreed scope. Preserve other contributors' work; do not force-push the default branch or rewrite shared history without coordination. Avoid duplicate CI runs and retry only bounded, verified infrastructure failures.

Passing checks does not guarantee acceptance or a release. Merging and publication remain maintainer decisions; contributors must not enable auto-merge, merge, or publish on the maintainer's behalf without explicit authorization. Review and support are best effort, with no guaranteed response schedule.

Use source and assets you have the right to contribute, preserve existing license and third-party terms, and discuss unclear contribution rights before submitting. Never commit secrets, personal settings, generated installers, build caches, or unrelated work.

## Development and CI references

Use [the existing development checks](CONTRIBUTING.md#development) and include results appropriate to the change. The current workflow definitions are [ci.yml](.github/workflows/ci.yml). Consult their actual triggers, path filters, jobs, and approval behavior before requesting CI; this policy does not enable or change workflows. CI build/test results do not replace packaged-app or hardware acceptance.

Report suspected vulnerabilities through [SECURITY.md](SECURITY.md), rather than public issues or PRs.
