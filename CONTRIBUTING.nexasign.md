<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- © 2026 NexaStack, NexaSign contributors. Based on Documenso (AGPL-3.0). -->

# Contributing to NexaSign

Thanks for your interest in NexaSign. A few housekeeping notes about how this fork
differs from upstream Documenso:

## Which file applies?

NexaSign keeps the upstream files unchanged to minimise merge conflicts when we pull
in new releases from Documenso:

  - [`CONTRIBUTING.md`](./CONTRIBUTING.md) — upstream Documenso contribution guide,
    including their dev workflow, commit style (Conventional Commits), PR process.
    Most of this applies to NexaSign 1:1.

  - [`CLA.md`](./CLA.md) — upstream Documenso Contributor License Agreement.
    **Does NOT apply to NexaSign PRs.** Contributions to NexaSign do not require
    a CLA — they are accepted under AGPL-3.0-or-later, same license as the rest
    of the repository. The `CLA.md` file is kept because we may want to
    sync upstream Documenso PRs back and need to know what they required.

  - [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md) — upstream, applies to NexaSign
    discussions too.

## Reporting issues

  - **NexaSign-specific bugs** (Vorlagen, X-Rechnung, GoBD, AV-Vertrag, German
    translations, branding) → open an issue in the NexaSign repository.

  - **Core Documenso bugs** (sign flow, document upload, team management,
    webhooks, core tRPC/Prisma issues) → ideally file them upstream at
    `documenso/documenso`. We pull in upstream fixes regularly.

## Pull requests

Contributions that touch NexaSign-specific code (`templates/*`, `tools/*`,
`docker/nexasign/`, `packages/ee/*` stubs, all `*.nexasign.md` docs, the
Vorlagen hub PHP) are welcome and accepted under AGPL-3.0-or-later.

Contributions that touch core Documenso code will be reviewed here but you may
be asked to first file the change upstream. This keeps our fork lean.

## License

By contributing to NexaSign, you agree that your contribution is licensed
under **AGPL-3.0-or-later**. No separate CLA is required.
