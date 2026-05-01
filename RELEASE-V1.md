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

1. Finish and review current Discovery/GoBD local changes.
2. Apply and test the Discovery retention backfill migration.
3. Complete user-facing NexaFile copy pass.
4. Add focused Discovery/GoBD checks to the release gate.
5. Run the release gate and fresh-install smoke test.
6. Deploy demo, manually verify the four-step navigation and core workflows.
7. Tag `v1.0.0-rc.1`.
8. Fix release-candidate findings.
9. Tag `v1.0.0`.

