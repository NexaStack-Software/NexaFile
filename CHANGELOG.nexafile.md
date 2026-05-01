# NexaSign Changelog

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
