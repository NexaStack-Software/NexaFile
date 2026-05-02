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
9. Done: Tag `v1.0.0-rc.3` published on GitHub.
10. Done: Final `v1.0.0` release prep committed and pushed.
11. Done: Tag `v1.0.0` published on GitHub as a stable release.

## Post-Release Status

Checked on 2026-05-02 after publishing `v1.0.0`:

- GitHub repository is public at `NexaStack-Software/NexaFile`.
- Latest GitHub release is `NexaFile v1.0.0`, not draft and not prerelease.
- `main` is clean and matches `origin/main`.
- Production `/api/health` returns `ok`.
- Demo `/api/health` returns `ok`.
- Runtime container `nexasign-app` is healthy.
- Demo drift check passes with no failures; the remaining Docker inspect warning
  is non-blocking when direct `docker ps` confirms the container is healthy.

Checked on 2026-05-02 after publishing `v1.0.1`:

- Latest GitHub release is `NexaFile v1.0.1`, not draft and not prerelease.
- Tag `v1.0.1` points to `438ed2d chore(release): prepare v1.0.1`.
- `main` is clean and matches `origin/main`.
- `npx npm@11.11.0 run release:gate` passed through typecheck, lint, build,
  migration deploy, and 18/18 release E2E tests; the only pre-push failure was
  the expected strict demo-drift `origin-main` mismatch.
- `scripts/nexasign/smoke-fresh-install.sh` passed with isolated fresh install,
  certificate gate, healthcheck, migrations, and cleanup.
- Production `/api/health` returns `ok`.
- Demo `/api/health` returns `ok`.
- Runtime container `nexasign-app` is healthy.
- Strict demo drift check passes with 14 PASS, 0 WARN, 0 FAIL.

## Post-V1 Maintenance Queue

Track these as GitHub issues for `v1.0.1`/early `v1.1.0`:

1. Done: Migrate Prisma seed configuration from `package.json#prisma` to
   `prisma.config.ts` without breaking generator output.
2. Done: Refresh Browserslist/caniuse-lite data and verify the production build.
3. Done: Reduce existing lint warnings without changing runtime behavior.
4. Done: Document the GitHub CLI based release workflow for future releases.
5. Done: Add a light post-release monitoring checklist for production and demo.
