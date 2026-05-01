<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- © 2026 NexaStack, NexaSign contributors -->

# Contributing to NexaFile

Danke für Ihr Interesse an NexaFile. Beiträge (Bugfixes, Features, Docs,
Übersetzungen) sind willkommen.

## Quick links

- **Bug melden / Feature vorschlagen:**
  [GitHub-Issues](https://github.com/NexaStack-Software/NexaSign/issues)
- **Security-sensitive Befunde:** vertraulich per Mail an `security@nexastack.co`
  (siehe [SECURITY.md](SECURITY.md) und
  [apps/remix/public/.well-known/security.txt](apps/remix/public/.well-known/security.txt))

## Entwicklungs-Setup

```bash
npm install
npm run dx            # Startet App + DB lokal via Docker
npm run test:dev      # Playwright-E2E-Suite
npm run lint          # ESLint
npm run format        # Prettier
```

Erforderlich: Node.js ≥ 22, Docker, npm 10+.

## Pull-Requests

- Eine Änderung pro PR, verständlicher Titel, kurze Beschreibung.
- Conventional-Commit-Stil für Commit-Messages (`feat:`, `fix:`, `chore:`,
  `docs:`, `refactor:`, `test:`).
- Vor Push: `npm run lint` und `npm run test:dev` grün.
- Neue Features brauchen Tests. Bugfixes idealerweise einen Regressions-Test.

## Lizenz der Beiträge

Mit Ihrem Beitrag zu NexaFile erklären Sie sich einverstanden, dass Ihr Code
unter **AGPL-3.0-or-later** lizenziert wird — derselben Lizenz wie der Rest
des Projekts. Kein separates CLA erforderlich. Siehe [LICENSE](LICENSE).
