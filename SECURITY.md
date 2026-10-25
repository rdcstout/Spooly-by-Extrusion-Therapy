# Security policy for Spooly

## Supported versions

Security fixes target the latest published stable release. Older releases should be upgraded; backports are not promised. Reports about unreleased source should identify the affected commit.

## Report a suspected vulnerability privately

Use [GitHub private vulnerability reporting](https://github.com/rdcstout/Spooly-by-Extrusion-Therapy/security/advisories/new). This repository has that reporting feature enabled; the policy file itself does not enable it.

Do not put vulnerability details, exploit instructions, credentials or private user data in a public issue, pull request, discussion or attachment. Ordinary feature requests and non-security bugs can use the normal project issue process.

Include the affected version or commit, operating system and relevant hardware, the affected component, steps to reproduce with a minimal sanitized example, and the potential impact. State any access or setup required. You do not need a complete exploit to report a credible concern. Never include real credentials or other people's data.

Relevant concerns depend on the product and may include unauthorized access, unintended file or data changes, exposure of credentials or private data, unsafe handling of untrusted inputs, and vulnerabilities in update or device-control paths. Describe the actual impact rather than assuming that every crash is a security vulnerability. If uncertain, use the private channel for an initial assessment.

Test only systems, files and devices you own or are authorized to assess. Avoid destructive tests, disruption of services, or access to other users' information; use a minimal reproduction and disposable data where possible.

## Project-specific precautions

Never post printer access codes, serial numbers, private addresses, complete configuration backups, or unredacted printer logs. Printer compatibility problems without a security impact belong in the normal issue tracker.

## Handling and disclosure

Reports are assessed on a best-effort basis. We may request clarification and coordinate verification, a fix, and disclosure with the reporter. Please keep details private while we coordinate a response and discuss disclosure timing through the private channel.

There are no guaranteed acknowledgement or resolution dates, no guaranteed fix for every report, and no standing paid bug-bounty program. Any reporter credit should be agreed with the reporter before publication. This policy is not a warranty that the software or a device integration is free of vulnerabilities.
