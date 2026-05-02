# NexaFile Changelog

## [1.0.0-rc.3] - 2026-05-02 - V1 Release Candidate

Letzter V1-Release-Candidate mit Docker-Install-Cleanup.

### Fixes

- Docker-Runtime-Install nutzt jetzt `npm ci --omit=dev` statt der
  veralteten `--only=production`-Option.

## [1.0.0-rc.2] - 2026-05-02 - V1 Release Candidate

Zweiter V1-Release-Candidate mit Docker-Install-Hardening.

### Fixes

- Docker-Base-Image installiert jetzt `npm@11.11.0`, passend zur
  `packageManager`- und `engines.npm`-Angabe des Repos. Dadurch verschwinden
  die npm-Engine-Warnungen beim Fresh-Install-Build.

## [1.0.0-rc.1] - 2026-05-02 - V1 Release Candidate

Erster V1-Release-Candidate nach bestandenem Release-Gate.

### Features

**Dokumente erstellen**
- Vertragsvorlagen, AV-Vertrag, X-Rechnung/ZUGFeRD-Tools und PDF-Generatoren
  fuer den deutschen Geschaeftsalltag.

**Dokumente finden**
- IMAP-Quellen mit expliziten SyncRuns.
- Rechnungs- und Dokumenterkennung mit Mail- und Attachment-Archiv.
- Annahme, Ignorieren, Signatur-Dokument-Erstellung, Artifact-Download und
  ZIP-Export fuer gefundene Dokumente.

**Dokumente signieren**
- E-Signatur-Workflow mit Empfaengern, Feldern, Audit-Log, Zertifikatsseiten
  und versiegelten PDFs.

**Dokumente archivieren**
- GoBD-orientierter Retention-Start, WORM-Guards, SHA-256-Manifest,
  Exportpakete und Retention-Reports fuer abgeschlossene Signaturen und
  akzeptierte Discovery-Dokumente.

### Release Checks

- `npm run release:gate` bestanden am 2026-05-02.
- Fresh-install smoke stack isoliert, damit Produktionscontainer nicht mehr
  durch lokale Smoke-Cleanup-Schritte entfernt werden.
- Demo-Drift-Check im Gate bestanden; lokale Demo-Dateien bleiben untracked.

## [0.1.0-beta.1] — 2026-04-23 — Initial Release

Erste öffentliche Beta-Version.

### Features

**E-Signatur-Kern**
- Dokumente hochladen, Unterschrifts-Felder setzen, Empfänger einladen
- Sequenzielle und parallele Unterzeichner-Flows
- Kryptographisch signierte PDFs (EES/AES nach eIDAS)
- Vollständig deutsche Benutzeroberfläche
- Mehrbenutzer, Teams, Rollen, Audit-Logs
- API + Webhooks für Systemintegration

**Deutsche Compliance-Module**
- GoBD-Tooling: WORM-Strict-Mode, 10-Jahres-Retention, Export-CLI mit
  SHA-256-Manifest (Z2/Z3-Finanzamt-Prüfzugriff)
- X-Rechnung / ZUGFeRD-Generator (EN 16931, Comfort-Profile) — **Beta** — mit
  lokaler PDF-Extraktion, ohne Cloud-API
- AV-Vertrag-Generator (DSGVO Art. 28) mit TOM-Anhang
- 11 deutsche Vertragsvorlagen als Markdown

**Infrastruktur**
- Dockerisierter App-Stack (`docker/nexasign/`)
- PHP-basierte Vorlagen-Tools (`templates/`, `/vorlagen/*`)
- systemd-Units für tägliche Retention-Prüfung (`tools/`)

### Bekannte offene Punkte vor produktivem Einsatz

- X-Rechnung gegen den offiziellen KoSIT-Validator (BMF) prüfen —
  bisher nur Round-Trip via `ZugferdDocumentPdfReader` getestet.
- Security-Hardening der PHP-Tools: Rate-Limiting, PDF-Bomb-Schutz,
  SPDX-Header in neuen Dateien.
- Deployment-Konsistenz: Remix-App läuft in Docker, PHP-Tools als
  Host-PHP-FPM — ein `docker compose up` liefert aktuell nur die
  halbe Feature-Menge.

---

## Lizenz- und Attributions-Hinweis

NexaSign steht unter AGPL-3.0-or-later; Details siehe [LICENSE](LICENSE)
und [NOTICE](NOTICE). Diese Datei dient zusätzlich als „notice of
modification" gemäß AGPL-3.0 § 5(a).
