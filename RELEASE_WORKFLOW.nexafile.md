<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- © 2026 NexaStack, NexaSign contributors. Based on NexaSign (AGPL-3.0). -->

# NexaFile — Release Workflow

Dieses Runbook beschreibt den reproduzierbaren Release-Ablauf fuer NexaFile.
Es gilt fuer Prereleases wie `v1.0.0-rc.3` und stabile Releases wie `v1.0.0`.

> Finale Veroeffentlichungen brauchen immer ein explizites menschliches Go.
> Vorbereitung, Checks, Tagging und GitHub Release koennen danach per `gh`
> ausgefuehrt werden.

---

## Voraussetzungen

```bash
cd /opt/NexaSign
git status -sb
gh auth status
```

Erwartet:

- Arbeitsbaum ist clean.
- `main` ist synchron mit `origin/main`.
- `gh auth status` zeigt einen GitHub-Login mit `repo` Scope.
- Keine lokale Demo-Datei ist tracked.

Wenn `gh` fehlt:

```bash
sudo apt-get update
sudo apt-get install gh
gh auth login
```

Auf Debian-Systemen kann `apt-listbugs` das Debian-Paket `gh` blockieren. In
diesem Fall das offizielle GitHub-CLI-Apt-Repository verwenden oder die
aktuelle `.deb` aus den GitHub-CLI-Releases installieren.

---

## Release vorbereiten

1. Zielversion festlegen, z. B. `1.0.1` oder `1.1.0-rc.1`.
2. `package.json`, `apps/remix/package.json` und `package-lock.json`
   aktualisieren.
3. `CHANGELOG.nexafile.md` aktualisieren.
4. Release-/Upgrade-Hinweise aktualisieren, wenn sich Betrieb, Migrationen,
   Env-Variablen oder Breaking Changes aendern.
5. Diffs pruefen:

```bash
git diff --stat
git diff -- package.json apps/remix/package.json package-lock.json CHANGELOG.nexafile.md
```

---

## Pflichtchecks

Vor jedem Tag:

```bash
npm run release:gate
scripts/nexasign/smoke-fresh-install.sh
scripts/nexasign/check-demo-drift.sh --strict
curl -fsSL https://nexasign.nexastack.co/api/health
curl -fsSL https://nexasign-demo.nexastack.co/api/health
```

Hinweise:

- `release:gate` muss Typecheck, Lint, Build, Migrationen und Release-E2E
  erfolgreich ausfuehren.
- Bekannte Lint-Warnungen blockieren nicht, solange es keine Errors gibt.
- `check-demo-drift.sh --strict` darf keine Failures melden. Eine Docker-
  Inspect-Warnung ist nur dann akzeptabel, wenn `docker ps` den Container
  direkt als healthy bestaetigt.
- Fresh-install-Smoke muss isolierte Volumes/Container nutzen und darf den
  Produktionsstack nicht beruehren.

Wenn `release:gate` vor dem Commit nur wegen eines uncommitted Worktrees im
Demo-Drift-Check scheitert:

1. Alle fachlichen Gate-Abschnitte muessen vorher gruen gewesen sein.
2. Commit erstellen.
3. `scripts/nexasign/check-demo-drift.sh --strict` erneut gegen den cleanen
   Arbeitsbaum laufen lassen.

---

## Commit und Push

```bash
git add <release-files>
git commit -m "chore(release): prepare vX.Y.Z"
git push origin main
git status -sb
```

Erwartet:

- Hooks laufen durch.
- `main` ist danach synchron mit `origin/main`.
- Der Commit ist der geplante Release-Commit.

---

## Tag erstellen

Prerelease:

```bash
git tag -a vX.Y.Z-rc.N -m "NexaFile vX.Y.Z-rc.N"
git push origin vX.Y.Z-rc.N
```

Stabiles Release:

```bash
git tag -a vX.Y.Z -m "NexaFile vX.Y.Z"
git push origin vX.Y.Z
```

Tag-Ziel pruefen:

```bash
git show --no-patch --format='%h %s' vX.Y.Z^{}
git ls-remote --tags origin vX.Y.Z
```

---

## GitHub Release erstellen

Prerelease:

```bash
gh release create vX.Y.Z-rc.N \
  --repo NexaStack-Software/NexaFile \
  --title "NexaFile vX.Y.Z-rc.N" \
  --notes-file /tmp/nexafile-release-notes.md \
  --prerelease
```

Stabiles Release:

```bash
gh release create vX.Y.Z \
  --repo NexaStack-Software/NexaFile \
  --title "NexaFile vX.Y.Z" \
  --notes-file /tmp/nexafile-release-notes.md
```

Release verifizieren:

```bash
gh release view vX.Y.Z \
  --repo NexaStack-Software/NexaFile \
  --json tagName,name,isPrerelease,isDraft,url
```

Erwartet fuer stabile Releases:

- `isDraft: false`
- `isPrerelease: false`
- `tagName` ist die geplante Version

---

## Post-Release-Check

Direkt nach dem GitHub Release:

```bash
git status -sb
curl -fsSL https://nexasign.nexastack.co/api/health
curl -fsSL https://nexasign-demo.nexastack.co/api/health
docker ps --filter name=nexasign-app --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
scripts/nexasign/check-demo-drift.sh --strict
```

Ergebnis in `RELEASE-V1.md` oder dem jeweiligen Release-Runbook dokumentieren.

---

## Rollback-Hinweis

Vor produktiven Upgrades gilt:

1. Backup nach [`BACKUP_RESTORE.nexafile.md`](BACKUP_RESTORE.nexafile.md)
   erstellen und verifizieren.
2. Upgrade-/Rollback-Pfad nach [`UPGRADE.nexafile.md`](UPGRADE.nexafile.md)
   vorbereiten.
3. Bei Migrationen oder Betriebsaenderungen ein Wartungsfenster nutzen.
