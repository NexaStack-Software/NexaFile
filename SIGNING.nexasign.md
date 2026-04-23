<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- © 2026 NexaStack, NexaSign contributors. Based on NexaSign (AGPL-3.0). -->

# NexaSign — Signatur-Zertifikat einrichten

NexaSign erzeugt signierte PDFs mit einer kryptografischen Signatur, die an das PDF
angehängt wird. Dafür braucht die App ein Signatur-Zertifikat im **PKCS#12-Format
(`.p12`)** mit **Passphrase**. Das Cert liegt im Container unter `/opt/nexasign/cert.p12`.

**Wichtig:** Ohne ein gültiges Cert schlägt der interne Seal-Job nach dem Signieren
fehl, und das Dokument bleibt auf Status „Ausstehend" hängen. Das Cert muss eingerichtet
sein, bevor das erste Dokument signiert werden kann.

Drei Optionen, nach Offizialität sortiert:

---

## Option 1 — Self-signed Cert (Entwicklung / interne Tests)

Schnell, kostenlos, reicht für Dev-Setups und interne Pilotbetriebe.

**Nachteil:** Alle PDF-Viewer zeigen beim signierten Dokument
„Gültigkeit unbekannt — Identität konnte nicht überprüft werden". Also: **nicht** geeignet
für Verträge mit externen Kunden.

### Einrichtung

Wir liefern ein Helper-Script, das ein Self-signed Cert erzeugt und direkt ins
Docker-Volume `nexasign-cert` legt:

```bash
# Voraussetzung: .env angelegt und NEXT_PRIVATE_SIGNING_PASSPHRASE gesetzt
cp docker/nexasign/.env.example docker/nexasign/.env
# → NEXT_PRIVATE_SIGNING_PASSPHRASE="$(openssl rand -base64 32)" in .env eintragen

# Script ausführen
./scripts/nexasign/generate-dev-cert.sh

# App starten (oder neu starten, falls schon läuft)
cd docker/nexasign && docker compose up -d
```

Das Cert hat 10 Jahre Laufzeit, RSA-4096, SHA-256. Common Name:
„NexaSign Document Signing (DEV)". Bleibt persistent im Volume zwischen Container-Restarts.

---

## Option 2 — AATL-Document-Signing-Cert (Produktivbetrieb, empfohlen)

**AATL** = Adobe Approved Trust List. Zertifikate von CAs auf dieser Liste werden von
Adobe Reader, Acrobat, Foxit etc. ohne Warnung als vertrauenswürdig akzeptiert.
Grüner Haken statt gelbes Dreieck.

Rechtlich: ergibt eine **fortgeschrittene elektronische Signatur (AES)** nach eIDAS
Art. 26. Ausreichend für alle B2B-Verträge, die keiner gesetzlichen Schriftform unterliegen.

### Anbieter (EU-basiert, Stand 2026)

| Anbieter | Produkt | Preis/Jahr | Hinweise |
|---|---|---|---|
| **Certum** (PL) | Document Signing EV | ca. 80 € | Günstigster seriöser AATL-Anbieter. Identitäts­prüfung per Video-Ident. |
| **D-Trust** (DE, Bundesdruckerei) | AdES | ca. 100–150 € | Deutscher Anbieter. Auch als QES-Upgrade erhältlich. |
| **Sectigo** (UK/US, EU-Reseller) | Document Signing | ca. 250–400 € | Etabliert, gute Brand-Wahrnehmung. |
| **GlobalSign** (BE) | Document Signing | ca. 300–400 € | Großer AATL-CA. |

### Einrichtung

1. Cert beim Anbieter kaufen. Identitäts­prüfung (Firmendokumente + Ausweis) dauert
   1–5 Werktage.
2. Nach Erhalt eine `.p12`-Datei + Passphrase. Passphrase in `docker/nexasign/.env`
   unter `NEXT_PRIVATE_SIGNING_PASSPHRASE` eintragen.
3. Cert ins Volume kopieren (ersetzt ein evtl. vorhandenes Self-signed):

   ```bash
   docker run --rm \
     -v nexasign-cert:/v \
     -v "$(pwd)":/src:ro \
     alpine sh -c "cp /src/ihr-cert.p12 /v/cert.p12 && chmod 644 /v/cert.p12"
   ```

4. Container neu starten: `cd docker/nexasign && docker compose restart app`

---

## Option 3 — Qualifizierte elektronische Signatur (QES)

Entspricht rechtlich der **handschriftlichen Unterschrift** nach § 126a BGB / eIDAS
Art. 25. Nötig für Schriftform-pflichtige Verträge (bestimmte Kündigungen,
Verbraucherdarlehen, Mietverträge > 1 Jahr, etc.).

**Wichtig:** QES ist **pro Unterzeichner** erforderlich, nicht pro Server. Jeder
Unterzeichner muss sich beim Vertrauensdiensteanbieter ausweisen und bekommt ein
persönliches Zertifikat (oft auf Hardware-Token oder Cloud-HSM). Das ist in NexaSign
**aktuell nicht integriert** — der oben beschriebene Server-weite `cert.p12`-Mechanismus
erzeugt AES, keine QES.

Wenn Sie QES produktiv brauchen:
- **D-Trust** (Bundesdruckerei) bietet QES-Cloud-Signaturen
- **Bundesnotarkammer**, **Swisscom**, **certSIGN** sind weitere akkreditierte Anbieter
- Integration in NexaSign erfordert Entwicklungsarbeit (Vertragspartner, SAM/SCAL-API-
  Anbindung, pro-Unterzeichner-Flow). Pull-Requests willkommen.

---

## Fehlerdiagnose

| Symptom | Wahrscheinliche Ursache |
|---|---|
| Dokument bleibt nach Signieren auf „Ausstehend", Frontend zeigt endlos „Dokument wird verarbeitet" | `cert.p12` fehlt oder unter falschem Pfad. Logs prüfen: `docker logs nexasign-app \| grep cert.p12` |
| `EACCES: permission denied` im Log | Cert-Datei nicht lesbar für den `nodejs`-User (UID 1001). Fix: im Volume `chmod 644 cert.p12` |
| `Failed to get private key bags` | Cert ohne Passphrase erstellt oder Passphrase in `.env` falsch |
| PDF im Adobe Reader: „Identität nicht verifiziert" | Self-signed Cert. Für Produktiv: AATL-Cert kaufen (Option 2). |

Log-Check nach Signier-Versuch:

```bash
docker logs --since 2m nexasign-app | grep -iE "seal-document|cert.p12"
```

Sweep-Neuversuch nach Cert-Fix erfolgt automatisch alle 15 Min
(`internal.seal-document-sweep`-Cron), oder manuell durch Container-Restart und
erneutes Signieren.
