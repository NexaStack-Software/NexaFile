<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- © 2026 NexaStack, NexaSign contributors. Based on NexaSign (AGPL-3.0). -->

# Security Policy

## Supported Versions

NexaFile is currently published as a public beta. Only the latest released tag
and the `main` branch receive security fixes.

| Version          | Supported |
| ---------------- | --------- |
| `main`           | ✅        |
| latest `v0.x`    | ✅        |
| older `v0.x`     | ❌        |

## Reporting a Vulnerability

**Please do not open public GitHub issues for security-sensitive reports.**

- E-Mail: `security@nexastack.co`
- Additional contact channels: [.well-known/security.txt](.well-known/security.txt)
- Preferred languages: German, English

We aim to acknowledge reports within 5 working days and will coordinate a
disclosure timeline with you before any public announcement. Once a fix is
available, we credit the reporter in the release notes unless anonymity is
requested.

## Scope

In scope:

- The NexaFile Remix application (`apps/remix/`)
- The PHP template tools under `templates/` (vorlagen-index, av-vertrag-web,
  x-rechnung-web)
- The GoBD tooling under `tools/` and deployment configs under `deploy/`
- The Docker stack in `docker/nexasign/`

Out of scope:

- Issues in NexaFile that affect this fork — please report those
  to the [NexaFile project](https://github.com/NexaStack-Software/NexaFile/security)
  directly; we will sync fixes as part of our upstream-merge cadence.
- Vulnerabilities in third-party dependencies that are not reachable from any
  code path in this repository.
- Self-inflicted misconfiguration of a self-hosted deployment (missing TLS,
  default passwords from `.env.example` left unchanged, etc.).

## Known Limitations

See the [Bekannte offene Punkte](CHANGELOG.nexafile.md#bekannte-offene-punkte-vor-produktivem-einsatz)
section in the changelog for issues we are aware of and actively tracking,
including the pending KoSIT-validator check for the X-Rechnung generator and
the PHP-tool hardening roadmap.
