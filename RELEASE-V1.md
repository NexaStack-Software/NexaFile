# NexaFile V1 Release Plan

This file defines the practical V1 scope for NexaFile. Package names,
Docker service names, database names, and CLI filenames may stay `nexasign`
for V1 to avoid risky infrastructure churn. User-facing product copy should
move to `NexaFile`.

## V1 Product Scope

NexaFile V1 is a self-hosted document lifecycle for German small and midsize
businesses:

1. Create documents: contract templates, AV-Vertrag, X-Rechnung/ZUGFeRD tools.
2. Find documents: IMAP sources, explicit date-range sync, invoice/document
   detection, server-side mail and attachment archive.
3. Sign documents: the existing signing workflow, recipients, fields, audit log,
   signed PDF sealing.
4. Archive documents: GoBD-oriented retention start, WORM guards, SHA-256 based
   export package, retention reporting.

## Explicitly Not V1

- Qualified electronic signatures (QES).
- Background auto-sync every few minutes.
- Cloud sources beyond IMAP.
- Full-text document search across all archived bytes.
- Formal GoBD certification or legal/tax advice.
- Renaming all internal package names, DB containers, service names, and CLI
  filenames from `nexasign` to `nexafile`.

## Release-Critical Checks

- Fresh install from `docker/nexasign/compose.yml` on a clean host.
- Prisma migrations deploy cleanly, including Discovery retention backfill.
- Signing happy path completes and produces sealed PDFs.
- IMAP source can be created with allowed host, explicit SyncRun can import a
  PDF invoice, and duplicate SyncRuns do not duplicate `DiscoveryDocument`s.
- `Dokumente finden` can accept, archive, ignore, create a signing document,
  download artifacts, and export selected documents as ZIP.
- GoBD export includes completed Envelopes, accepted DiscoveryDocuments,
  Discovery audit logs, mail artifacts, document PDFs, and `manifest.sha256`.
- Retention check reports both completed Envelopes and accepted
  DiscoveryDocuments without deleting anything.
- Security checks cover IMAP host validation, path traversal prevention for
  artifacts and ZIP export, ZIP size limits, team/user isolation, and HTML mail
  display restrictions.

## Rebranding Policy

Use `NexaFile` in visible product UI, README/installation copy, metadata,
OpenGraph titles, email copy, and docs. Keep `NexaSign` where it is part of
compatibility-sensitive identifiers for V1:

- npm package names such as `@nexasign/*`
- Docker compose project/container/volume names
- database names and migration history
- existing CLI filenames and systemd unit filenames
- legacy attribution to the NexaSign fork history

## V1 Release Sequence

Status as of 2026-05-02:

1. Done: Discovery/GoBD changes reviewed and merged to `main`.
2. Done: Discovery retention backfill migration is present and covered by the
   V1 checks.
3. Done: User-facing product copy has moved to `NexaFile`; compatibility
   identifiers may remain `nexasign` for V1.
4. Done: Focused Discovery/GoBD checks are part of
   `scripts/nexasign/release-gate.sh`.
5. Done: `npm run release:gate` passed on `main` after the fresh-install smoke
   stack was isolated from production compose resources.
6. Done: Demo is deployed separately, has an hourly baseline reset, and passes
   strict demo-drift checks.
7. Done: Tag `v1.0.0-rc.1` published on GitHub.
8. Done: Tag `v1.0.0-rc.2` published on GitHub.
9. In progress: Fix final release-candidate findings.
10. Next: Tag `v1.0.0-rc.3` after Docker runtime install cleanup passes the
   release checks.
11. Next: Tag `v1.0.0`.
