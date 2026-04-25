# NexaSign

**Die deutsche, selbstgehostete Alternative zu DocuSign.**

NexaSign ist ein **Open-Source-Fork** von [Documenso](https://github.com/documenso/documenso) unter der
[AGPL-3.0-Lizenz](LICENSE), spezialisiert auf den deutschsprachigen Raum und
gepflegt im Rahmen des Open-Source-Engagements von [NexaStack](https://nexastack.co/).

---

## 🙏 Attribution

NexaSign baut vollständig auf der hervorragenden Arbeit des Documenso-Teams auf.
Alle Kern-Funktionen (E-Signatur-Workflow, PDF-Rendering, Zertifikats-Management,
Team-Funktionen) kommen aus dem Upstream-Projekt. Wir danken Timur Ercan und
dem gesamten Documenso-Team.

- **Upstream:** [github.com/documenso/documenso](https://github.com/documenso/documenso)
- **Upstream-Website:** [documenso.com](https://documenso.com)
- **Upstream-Discord:** [documen.so/discord](https://documen.so/discord)

Unsere Änderungen sind im [CHANGELOG.nexasign.md](CHANGELOG.nexasign.md) dokumentiert.

## Was NexaSign macht

Elektronische Dokumente unterzeichnen, ohne auf DocuSign oder andere US-SaaS
angewiesen zu sein:

- Dokumente hochladen, Unterschrifts-Felder setzen, Unterzeichner per Link einladen
- Mehrere Unterzeichner, sequenzielle oder parallele Flows
- PDF mit eingebetteter digitaler Signatur als Ergebnis
- Komplett **self-hosted in Deutschland** — keine Daten verlassen Deine Infrastruktur
- **DSGVO-konform** durch Self-Hosting
- **eIDAS-Unterstützung** für einfache und fortgeschrittene elektronische Signaturen

## Wichtiger Hinweis zur Schriftform

NexaSign erzeugt **einfache und fortgeschrittene elektronische Signaturen (EES/AES)**.
Das reicht für die allermeisten Verträge im deutschen Geschäftsalltag (AGB-Zustimmungen,
NDAs, Freelance-Verträge, Dienstleistungen, Angebote), da diese nach § 125 BGB formfrei
sind.

Für Verträge mit gesetzlicher **Schriftform-Pflicht** (z. B. Mietverträge über mehr als
ein Jahr, bestimmte Kündigungen, Arbeitszeugnisse, Immobilienkäufe) wird eine
**qualifizierte elektronische Signatur (QES)** nach eIDAS Artikel 25 benötigt. Diese
erfordert einen akkreditierten Vertrauensdiensteanbieter (z. B. D-Trust / Bundesdruckerei)
und ist in NexaSign aktuell **nicht** integriert.

## Hinweis zu GoBD und Aufbewahrung

NexaSign liefert **GoBD-Tooling** (WORM-Strict-Mode, 10-Jahres-Retention nach
§ 147 AO / § 257 HGB, Z2/Z3-Export-CLI mit SHA-256-Manifest). Das ist die
technische Basis für eine GoBD-orientierte Aufbewahrung, **nicht** der fertige
GoBD-Nachweis. **GoBD-Konformität** entsteht erst aus Tooling, Verfahrens­
dokumentation und gelebtem Prozess zusammen — die Verfahrensdokumentation und
die formelle Prüfung durch Steuerberater oder Wirtschaftsprüfer bleiben
Betreiberpflicht. Eine Vorlage liegt unter
[`Vorlagen/11-verfahrensdokumentation-gobd.md`](Vorlagen/11-verfahrensdokumentation-gobd.md).

## Installation

### Entwicklung / lokal

Siehe das Original-README unter [README.md](README.md) — alle Entwicklungs­anleitungen
(`npm run dx`, Prisma-Migrations) gelten 1:1.

### Produktion / Self-Hosting

NexaSign besteht aus **zwei Teilen**:

1. **Die E-Signatur-App** (Remix / Documenso-Kernel) — läuft in Docker auf Port 3060.
2. **Die öffentlichen Vorlagen-Tools** (`/vorlagen/`, `/vorlagen/gobd/`,
   `/vorlagen/av-vertrag/`, `/vorlagen/x-rechnung/`) — PHP-Seiten, die direkt auf
   dem Host via nginx + PHP-FPM ausgeliefert werden. **Optional** — wenn Du nur
   die reine Signatur-App willst, kannst Du die PHP-Tools weglassen.

#### Schritt 1 — App-Stack (Docker, Pflicht)

```bash
cd docker/nexasign
cp .env.example .env
# .env editieren: DB-Passwort, Secrets (openssl rand -base64 32), NEXT_PUBLIC_WEBAPP_URL,
# SMTP-Zugangsdaten und NEXT_PRIVATE_SIGNING_PASSPHRASE (beliebiger starker String).

# Erster Start — baut das App-Image aus diesem Repo (dauert ~10 min):
docker compose up -d --build

# Spätere Restarts ohne Fork-Änderungen:
docker compose up -d

# Nach Fork-Code-Änderungen erneut builden:
docker compose up -d --build --force-recreate app
```

Die App läuft jetzt auf `http://localhost:3060`. Für öffentlichen Zugriff einen
Reverse-Proxy (nginx, Caddy) mit TLS davor schalten.

#### Schritt 2 — Signatur-Zertifikat (Pflicht vor erster Signatur!)

Ohne Signatur-Cert bleibt jedes signierte Dokument auf Status „Ausstehend" hängen,
weil der Seal-Job fehlschlägt. Für ein schnelles **Test-Setup**:

```bash
./scripts/nexasign/generate-dev-cert.sh
```

Das erzeugt ein Self-signed-Cert (10 Jahre Laufzeit) und legt es ins
Docker-Volume `nexasign-cert`. Anschließend: `docker compose restart app`.

**Für Produktivbetrieb** ein AATL-vertrauenswürdiges Cert kaufen (ca. 80–400 €/J).
Anleitung, Anbieter und Fehlerdiagnose in [SIGNING.nexasign.md](SIGNING.nexasign.md).

#### Schritt 3 — Vorlagen-Tools (PHP, optional)

Wer nur die App braucht, kann das hier überspringen. Die PHP-Tools liefern:
- Vertragsvorlagen-Hub (11 deutsche Vorlagen als Markdown)
- AV-Vertrag-Generator (Art. 28 DSGVO, via WeasyPrint zu PDF)
- X-Rechnung / ZUGFeRD-Generator (EN 16931, KoSIT-validiert)
- GoBD-Info-Hub + Tooling (WORM-Enforcement, 10-Jahre-Retention-Cron)

Voraussetzungen: PHP 8.1+, Composer, WeasyPrint in einem Python-venv, systemd für
das Retention-Cron, nginx mit den location-Blöcken unter `/vorlagen/*`.

Komplette Schritt-für-Schritt-Anleitung: [DEPLOY-PHP.nexasign.md](DEPLOY-PHP.nexasign.md).

## Lizenz und Haftung

- **Code:** AGPL-3.0 (wie Upstream)
- **Betrieb als Service:** Die AGPL-3.0 verlangt, dass alle Nutzer des Services
  Zugang zum Quellcode haben. Der gesamte NexaSign-Source liegt öffentlich in
  diesem Repository.
- **Haftung:** Die Software wird **ohne jede Gewährleistung** bereitgestellt
  (§15/§16 AGPL-3.0). Bei unentgeltlicher Überlassung gilt zusätzlich
  § 521 BGB analog — Haftung nur bei Vorsatz und grober Fahrlässigkeit.
- **Keine Rechtsberatung:** Die Ausgabe einer Signatur durch NexaSign ersetzt
  **keine juristische Prüfung** der zugrundeliegenden Dokumente.

## Unterstützung

- **Bugs/Fragen:** [GitHub-Issues in diesem Repository](https://github.com/NexaStack-Software/NexaSign)
- **Kommerzielle Unterstützung (Hosting, Setup, Schulung):** [NexaStack](https://nexastack.co/)

## Upstream-Synchronisation

Dieser Fork zieht regelmäßig Upstream-Updates per `git fetch upstream && git merge upstream/main`.
Reguläre Commits ohne Konflikte werden übernommen, unsere Anpassungen im
`docker/nexasign/`-Verzeichnis und in den deutschen Sprachdateien bleiben unberührt.
