<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- © 2026 NexaStack, NexaSign contributors. Based on NexaSign (AGPL-3.0). -->

# `@nexasign/remix` — NexaSign Web-App

Die zentrale React-Router-/Hono-Anwendung des NexaSign-Monorepos.
Liefert die UI für Signatur-Workflows, die REST-/tRPC-APIs unter
`/api/v1`, `/api/v2`, `/api/trpc` und den Job-Endpoint unter `/api/jobs`.

Dieses Verzeichnis ist eines von mehreren Workspaces — siehe das Repo-Root-
[README.nexafile.md](../../README.nexafile.md) für den Gesamtüberblick und
[ARCHITECTURE.md](../../ARCHITECTURE.md) für die High-Level-Topologie.

## Lokale Entwicklung

Voraussetzungen siehe Repo-Root. In Kürze: Node 22+, npm 11+, Docker für
Postgres und MinIO.

```bash
# Vom Repo-Root aus, einmalig:
npm run dx                # Installiert Deps, startet docker-compose, migriert, seedet
npm run dev               # Startet die Remix-App auf http://localhost:3000
npm run prisma:studio     # Datenbank-GUI
```

Spezifisch für dieses Workspace:

```bash
npm run dev -w @nexasign/remix          # nur diese App
npm run typecheck -w @nexasign/remix    # tsc --noEmit + react-router typegen
npm run build -w @nexasign/remix        # Production-Build
```

## Verzeichnislayout

```
apps/remix/
├── app/
│   ├── routes/                         # React-Router-Routen
│   │   ├── _authenticated+/            # eingeloggte Nutzer
│   │   ├── _unauthenticated+/          # öffentlich
│   │   ├── _recipient+/                # Signier-Routen für Empfänger
│   │   └── api+/                       # API-Routen (health, certificate-status, ...)
│   ├── components/                     # UI-Komponenten der App
│   └── hooks/                          # React-Hooks
├── server/
│   ├── router.ts                       # Hono-Mounts (/api/v1, /api/v2, /api/trpc, /api/jobs)
│   ├── main.js                         # Entry Point
│   ├── api/                            # API-Handler-Module
│   ├── trpc/                           # tRPC-Bindings
│   └── middleware.ts                   # Authentifizierung, Logging
└── public/                             # statische Assets
```

## Deployment

Das Production-Image für diese App wird über `docker/nexasign/compose.yml`
gebaut und betrieben. Operator-Anleitungen:

- [README.nexafile.md](../../README.nexafile.md) — Übersicht und Quickstart
- [SIGNING.nexafile.md](../../SIGNING.nexafile.md) — Signatur-Zertifikat einrichten
- [BACKUP_RESTORE.nexafile.md](../../BACKUP_RESTORE.nexafile.md) — Postgres und Cert-Volume sichern
- [UPGRADE.nexafile.md](../../UPGRADE.nexafile.md) — Versionswechsel und Rollback
- [DEPLOY-PHP.nexafile.md](../../DEPLOY-PHP.nexafile.md) — optionale PHP-Tools für Vorlagen, AV-Vertrag, X-Rechnung

## Lizenz

AGPL-3.0-or-later. Details: [LICENSE](../../LICENSE), [NOTICE](../../NOTICE).
