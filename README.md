<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- © 2026 NexaStack, NexaSign contributors -->

# NexaFile

**Die deutsche, selbstgehostete Dokumentenplattform für Finden, Signieren und Archivieren.**

NexaFile findet, signiert und archiviert elektronische Dokumente in Ihrer eigenen
Infrastruktur. Keine Daten in US-Clouds, kein Abo-Zwang, keine Drittanbieter-Server
im Signatur- oder Archiv-Pfad.

Gepflegt von [NexaStack](https://nexastack.co/) als Open-Source-Projekt unter
AGPL-3.0-or-later.

---

## 🔎 NexaFile live ausprobieren, bevor Sie selbst hosten

**→ [nexasign-demo.nexastack.co](https://nexasign-demo.nexastack.co)**

Öffentliche Vorschau-Instanz zum Durchklicken: Dokumente signieren, Vorlagen
anschauen, AV-Vertrag- und X-Rechnung-Generator testen. Ideal, um einen
ersten Eindruck zu bekommen, bevor Sie den eigenen Stack aufsetzen.

> Die Demo-Instanz wird von NexaStack privat betrieben und ist **nicht** Teil
> dieses Repositorys. Dieses Repo enthält den Quellcode für Ihre **eigene**
> Instanz.

---

## Was NexaFile kann

**Dokumente finden und übernehmen:**

- IMAP-Quellen gezielt für frei wählbare Datumsbereiche synchronisieren
- E-Mails, Anhänge, Body-Dateien und Metadaten lokal archivieren
- Gefundene Belege prüfen, akzeptieren und mit Retention-Start versehen
- Auditierbare Discovery-Logs und Exportfähigkeit für Betriebsprüfungen

**E-Signatur, rechtskonform und self-hosted:**

- Dokumente hochladen, Unterschrifts-Felder setzen, Unterzeichner per Link einladen
- Mehrere Unterzeichner, sequenzielle oder parallele Flows
- PDF mit eingebetteter, kryptographisch verifizierbarer Signatur als Ergebnis
- eIDAS-konform für einfache und fortgeschrittene elektronische Signaturen (EES/AES)
- Vollständige deutsche Benutzeroberfläche, Audit-Logs, Mehrbenutzer-/Team-Verwaltung
- API und Webhooks für Integration in eigene Systeme

**Speziell für den deutschen Geschäftsalltag:**

- **GoBD-Tooling** — WORM-Strict-Mode für abgeschlossene Dokumente,
  10-Jahres-Retention nach § 147 AO / § 257 HGB, Export-CLI mit SHA-256-Manifest
  für Z2/Z3-Finanzamt-Prüfzugriff.
- **X-Rechnung / ZUGFeRD-Generator** — EN 16931-konforme E-Rechnungen mit
  Auto-Extraction aus bestehenden Rechnungs-PDFs. Komplett lokal, keine Cloud-API.
- **AV-Vertrag-Generator** — Auftragsverarbeitungs-Vertrag nach DSGVO Art. 28
  als ausfüllbares Formular mit PDF-Export.
- **11 deutsche Vertragsvorlagen** — NDA (einseitig/gegenseitig), Arbeitsvertrag
  (befristet/unbefristet), Freelancer-Werkvertrag, Beratungsvertrag,
  Aufhebungsvertrag, Verfahrensdokumentation GoBD und weitere.

**Self-Hosted heißt:**

- Keine Daten verlassen Ihre Infrastruktur
- DSGVO-konform durch Betrieb in Deutschland
- Keine US-Surveillance-Gesetze (CLOUD Act), keine Drittlandübermittlung
- Volle Kontrolle über Zertifikate, Audit-Logs, Retention

## Hinweis zur Schriftform

NexaFile erzeugt **einfache und fortgeschrittene elektronische Signaturen (EES/AES)**.
Das reicht für die allermeisten Verträge im deutschen Geschäftsalltag
(AGB-Zustimmungen, NDAs, Freelance-Verträge, Dienstleistungen, Angebote), da
diese nach § 125 BGB formfrei sind.

Für Verträge mit gesetzlicher **Schriftform-Pflicht** (z. B. Mietverträge
> 1 Jahr, bestimmte Kündigungen, Arbeitszeugnisse) wird eine **qualifizierte
elektronische Signatur (QES)** nach eIDAS Art. 25 benötigt. Diese erfordert
einen akkreditierten Vertrauensdiensteanbieter (z. B. D-Trust / Bundesdruckerei)
und ist in NexaFile aktuell **nicht** integriert.

---

## Hinweis zu GoBD und Aufbewahrung

NexaFile liefert **GoBD-Tooling** (WORM-Strict-Mode, 10-Jahres-Retention nach
§ 147 AO / § 257 HGB, Z2/Z3-Export-CLI mit SHA-256-Manifest). Das ist die
technische Basis für eine GoBD-orientierte Aufbewahrung — **nicht** der
fertige GoBD-Nachweis.

**GoBD-Konformität** entsteht erst aus **Tooling, Verfahrensdokumentation und
gelebtem Prozess** zusammen. Die Verfahrensdokumentation, die formelle Prüfung
des Gesamtsystems und die Verantwortung gegenüber dem Finanzamt bleiben
Betreiberpflicht — typischerweise mit Steuerberater oder Wirtschaftsprüfer
abgestimmt. Eine Vorlage für die Verfahrensdokumentation liegt unter
[`Vorlagen/11-verfahrensdokumentation-gobd.md`](Vorlagen/11-verfahrensdokumentation-gobd.md).

---

## Installation (Self-Hosting)

NexaFile besteht aus zwei Teilen:

1. **E-Signatur-App** — Docker, Port 3060 (Pflicht)
2. **Vorlagen-Tools** (`/vorlagen/*`, AV-Vertrag, X-Rechnung, GoBD) — PHP auf Host, **optional**

### Schritt 1 — App-Stack (Pflicht)

```bash
cd docker/nexasign
cp .env.example .env
# .env editieren: DB-Passwort, NEXTAUTH_SECRET + ENCRYPTION_KEY + ENCRYPTION_SECONDARY_KEY
# (alle drei mit `openssl rand -base64 32`), NEXT_PUBLIC_WEBAPP_URL, SMTP-Zugangsdaten,
# NEXT_PRIVATE_SIGNING_PASSPHRASE (beliebiger starker String).

# Erster Start — baut das App-Image aus diesem Repo (~10 min):
docker compose up -d --build

# Spätere Restarts:
docker compose up -d

# Nach Code-Änderungen neu builden:
docker compose up -d --build --force-recreate app
```

App läuft jetzt auf `http://localhost:3060`.

### Schritt 2 — Reverse-Proxy mit TLS

Port 3060 niemals direkt öffentlich exponieren (kein TLS, kein Rate-Limiting).
Minimalbeispiele:

**Caddy** (automatisches Let's Encrypt):
```caddyfile
sign.beispiel.de {
    reverse_proxy 127.0.0.1:3060
}
```

**nginx** (mit `certbot` für TLS):
```nginx
server {
    listen 443 ssl http2;
    server_name sign.beispiel.de;
    # ssl_certificate / ssl_certificate_key via certbot

    location / {
        proxy_pass http://127.0.0.1:3060;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Wenn zusätzlich die PHP-Vorlagen-Tools auf derselben Domain laufen sollen,
siehe die erweiterte nginx-Konfiguration in
[DEPLOY-PHP.nexafile.md](DEPLOY-PHP.nexafile.md).

In `.env` muss `NEXT_PUBLIC_WEBAPP_URL` auf die öffentliche HTTPS-URL zeigen
(`https://sign.beispiel.de`), nicht auf `localhost:3060`.

### Schritt 3 — Signatur-Zertifikat (Pflicht!)

> ⚠️ **Ohne Signatur-Cert bleibt jedes signierte Dokument auf „Ausstehend"
> hängen**, weil der Seal-Job nach dem Unterzeichnen scheitert. Cert **vor**
> dem ersten Sign-Versuch einrichten.

Schnell-Setup (Self-signed, 10 Jahre, **nur Dev/Test**):

```bash
./scripts/nexasign/generate-dev-cert.sh
(cd docker/nexasign && docker compose restart app)
```

Für Produktivbetrieb ein AATL-Cert kaufen — Anleitung, Anbieter-Vergleich und
Fehlerdiagnose in [SIGNING.nexafile.md](SIGNING.nexafile.md).

### Schritt 4 — Vorlagen-Tools (optional)

Nur nötig, wenn Sie die Vorlagen-Bibliothek, AV-Generator, X-Rechnung-Generator
und GoBD-Tools mitnutzen wollen. Setup-Anleitung in
[DEPLOY-PHP.nexafile.md](DEPLOY-PHP.nexafile.md).

---

## Entwicklung

```bash
npm install
npm run dx            # Startet App + DB lokal via Docker
npm run test:dev      # Playwright-E2E-Suite
```

Details in [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Betrieb und Releases

- Backup und Restore: [BACKUP_RESTORE.nexafile.md](BACKUP_RESTORE.nexafile.md)
- Upgrade und Rollback: [UPGRADE.nexafile.md](UPGRADE.nexafile.md)
- Release-Workflow: [RELEASE_WORKFLOW.nexafile.md](RELEASE_WORKFLOW.nexafile.md)
- Monitoring/Post-Release-Checks: [MONITORING.nexafile.md](MONITORING.nexafile.md)

---

## Lizenz und Haftung

- **Code:** [AGPL-3.0-or-later](LICENSE)
- **Haftung:** Die Software wird **ohne jede Gewährleistung** bereitgestellt
  (§§ 15/16 AGPL-3.0). Bei unentgeltlicher Überlassung gilt zusätzlich § 521
  BGB analog — Haftung nur bei Vorsatz und grober Fahrlässigkeit.
- **Keine Rechtsberatung:** Die Ausgabe einer Signatur durch NexaFile ersetzt
  **keine juristische Prüfung** der unterzeichneten Dokumente.
- **Betrieb als Service:** AGPL-3.0 verlangt, dass alle Nutzer des Services
  Zugang zum Quellcode haben. Der gesamte NexaFile-Source liegt öffentlich
  in diesem Repo. Technische Paket-, Docker- und Datenbanknamen verwenden in V1
  aus Kompatibilitätsgründen teilweise weiterhin `nexasign`.

## Sicherheit

Nicht-kritische Bugs bitte als GitHub-Issue melden.
**Security-sensitive Befunde:** vertraulich per Mail an `security@nexastack.co`.
Details: [.well-known/security.txt](.well-known/security.txt).

## Support und kommerzielle Begleitung

- **Bugs, Fragen, Feature-Requests:** [GitHub-Issues](https://github.com/NexaStack-Software/NexaFile/issues)
- **Kommerzielle Unterstützung (Hosting, Setup, Schulung):**
  [NexaStack](https://nexastack.co/) · `info@nexastack.co`
