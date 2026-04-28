<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- © 2026 NexaStack, NexaSign contributors. Based on NexaSign (AGPL-3.0). -->

# NexaSign — Upgrade und Rollback

Diese Anleitung beschreibt den Versionswechsel einer laufenden NexaSign-
Installation und den Rollback-Pfad, falls etwas schiefgeht. Sie deckt sowohl
**App-only** als auch **Full Install** (mit PHP-Tools) ab.

> **Pflicht vor jedem Upgrade:** vollständiges Backup nach
> [`BACKUP_RESTORE.nexasign.md`](BACKUP_RESTORE.nexasign.md). Ohne verifiziertes
> Backup kein Upgrade.

---

## Versions-Pinning

NexaSign-Versionen werden in `docker/nexasign/.env` über `NEXASIGN_VERSION`
gepinnt:

```env
NEXASIGN_VERSION=v0.1.0-beta.1
```

`compose.yml` zieht das Image als `nexasign:${NEXASIGN_VERSION:-latest}`. Wenn
die Variable fehlt, fällt der Stack auf `:latest` zurück — für Produktion
**niemals**.

Veröffentlichte Versionen: GitHub Releases unter
<https://github.com/NexaStack-Software/NexaSign/releases>. Jede Release-Note
enthält den Migrationsbedarf, neue Env-Vars und bekannte Breaking Changes.

---

## Was das Upgrade anfasst

| Modus | Komponenten |
|---|---|
| **App-only** | Docker-Image (Remix-App + Worker), Postgres-Migrationen (laufen automatisch beim App-Start). |
| **Full Install** | Zusätzlich: PHP-Tools unter `/var/www/nexasign/vorlagen/`, Composer-Vendor in `templates/x-rechnung-web/`, systemd-Units in `tools/`. |

Für beide Modi gilt: **`.env` gegen `.env.example` der neuen Version diffen.**
Neue Releases können Variablen einführen, die ohne Default-Wert nicht starten.

---

## Pre-Upgrade-Checkliste

```bash
# 1. Frisches Backup laufen lassen — siehe BACKUP_RESTORE.nexasign.md
#    Ergebnis liegt z. B. in /var/backups/nexasign/<datum>/

# 2. Aktuellen Zustand notieren
cd /opt/NexaSign
git rev-parse HEAD                              > /tmp/nx-pre-commit.txt
git describe --tags --always                    > /tmp/nx-pre-tag.txt
docker compose -f docker/nexasign/compose.yml ps > /tmp/nx-pre-state.txt
curl -sS http://localhost:3060/api/health | jq  > /tmp/nx-pre-health.json

# 3. Release-Notes der Ziel-Version lesen
#    https://github.com/NexaStack-Software/NexaSign/releases/tag/<NEUE_VERSION>
#    Achte auf:
#    - Neue/entfernte Env-Variablen
#    - Migration-Dauer (große Migrations können DB-Locks halten)
#    - Breaking Changes in API V1/V2
#    - PHP-/Composer-Änderungen

# 4. Wartungsfenster ankündigen — Migrations sperren ggf. Tabellen
```

---

## Sandbox-Test vor Produktions-Upgrade (empfohlen für Minor und Major)

NexaSign liefert eine Fresh-Install-Sandbox auf Port 3070 mit eigenen Volumen
(`docker/nexasign/compose.fresh-install.yml`). Für einen Test **neben der laufenden
Produktion** muss zusätzlich ein eigener Compose-Projektname und ein eigenes
Docker-Netzwerk verwendet werden, damit Service-Aliase wie `database` nicht mit
dem Produktiv-Stack kollidieren.

```bash
cd /opt/NexaSign

# Ziel-Version im Arbeitsbaum testen. Die laufende Produktion nutzt weiter das
# bereits gebaute Image, solange kein Produktions-compose ausgeführt wird.
git fetch origin --tags
git checkout <NEUE_VERSION>

cd /opt/NexaSign/docker/nexasign

# Separates Netzwerk für die Sandbox. compose.fresh-install.yml trennt Container-Namen,
# Ports und Volumes; dieses zusätzliche Override trennt auch das Netzwerk.
cat > /tmp/nexasign-sandbox-network.override.yml <<'EOF'
networks:
  nexasign-net:
    name: nexasign-fresh-net
EOF

# Sandbox-Stack hochziehen — Port 3070, Volumes nexasign-fresh-*
docker compose \
  -p nexasign-fresh \
  -f compose.yml \
  -f compose.fresh-install.yml \
  -f /tmp/nexasign-sandbox-network.override.yml \
  up -d --build

# App kurz stoppen, damit der Restore exklusiv gegen die Sandbox-DB läuft.
docker compose \
  -p nexasign-fresh \
  -f compose.yml \
  -f compose.fresh-install.yml \
  -f /tmp/nexasign-sandbox-network.override.yml \
  stop app

# Produktions-Backup in die Sandbox einspielen
docker exec -i nexasign-fresh-db pg_restore \
  -U nexasign -d nexasign --clean --if-exists --no-owner --no-privileges \
  < /var/backups/nexasign/<datum>/postgres.dump

docker run --rm \
  -v nexasign-fresh-cert:/data \
  -v /var/backups/nexasign/<datum>:/backup:ro \
  alpine sh -c "cd /data && tar xzf /backup/nexasign-cert-volume.tar.gz"

docker compose \
  -p nexasign-fresh \
  -f compose.yml \
  -f compose.fresh-install.yml \
  -f /tmp/nexasign-sandbox-network.override.yml \
  up -d app

# Smoke-Test gegen Port 3070
curl -sS http://localhost:3070/api/health | jq
curl -sS http://localhost:3070/api/certificate-status | jq

# Wenn ok: Upgrade-Plan in Produktion ausführen
# Wenn nicht: in der Sandbox debuggen, ohne Produktionsausfall

# Sandbox abräumen
docker compose \
  -p nexasign-fresh \
  -f compose.yml \
  -f compose.fresh-install.yml \
  -f /tmp/nexasign-sandbox-network.override.yml \
  down -v
rm -f /tmp/nexasign-sandbox-network.override.yml
```

---

## Upgrade — App-only

```bash
cd /opt/NexaSign

# 1. Neuen Code holen
git fetch origin --tags
git checkout <NEUE_VERSION>          # z. B. v1.0.0
git status                            # erwartet: clean

# 2. Env-Defaults vergleichen — neue Variablen ergänzen
diff -u docker/nexasign/.env docker/nexasign/.env.example | less
# Fehlende Variablen mit den neuen Defaults manuell ergänzen.

# 3. Version-Pin aktualisieren
sed -i 's|^NEXASIGN_VERSION=.*|NEXASIGN_VERSION=<NEUE_VERSION>|' \
  docker/nexasign/.env

# 4. Image bauen
cd docker/nexasign
docker compose build app
# Falls Image auf einer Registry: docker compose pull app

# 5. Stack hochziehen — Prisma-Migrations laufen on-app-start
docker compose up -d app

# 6. Logs während Migration verfolgen
docker compose logs -f app
#    Erwartet: Migrations laufen durch, dann „Server running on :3000"
#    Bei Fehler: SOFORT Rollback, weiter unten.

# 7. Healthcheck und Cert-Status
curl -sS http://localhost:3060/api/health             | jq
curl -sS http://localhost:3060/api/certificate-status | jq
```

---

## Upgrade — Full Install (zusätzlich PHP-Tools)

Nach den App-only-Schritten:

```bash
cd /opt/NexaSign

# 8. Vorlagen-Hub und GoBD-Info-Hub
sudo cp templates/vorlagen-index/*.php /var/www/nexasign/vorlagen/
sudo cp -r templates/vorlagen-index/gobd /var/www/nexasign/vorlagen/
sudo mkdir -p /var/www/nexasign/vorlagen/source-md
sudo cp Vorlagen/*.md /var/www/nexasign/vorlagen/source-md/

# 9. AV-Vertrag-Generator
sudo mkdir -p /var/www/nexasign/vorlagen/av-vertrag
sudo cp templates/av-vertrag-web/*.php /var/www/nexasign/vorlagen/av-vertrag/

# 10. X-Rechnung-Generator (Composer-Dependencies neu ziehen)
cd templates/x-rechnung-web
composer install --no-dev --prefer-dist --no-progress
sudo mkdir -p /var/www/nexasign/vorlagen/x-rechnung
sudo cp -r {*.php,composer.json,composer.lock,vendor} \
  /var/www/nexasign/vorlagen/x-rechnung/

# 11. Permissions
sudo chown -R $USER:www-data /var/www/nexasign/vorlagen/
sudo find /var/www/nexasign/vorlagen -type d -exec chmod 750 {} \;
sudo find /var/www/nexasign/vorlagen -type f -exec chmod 640 {} \;

# 12. systemd-Units neu deployen, falls geändert
sudo cp /opt/NexaSign/tools/nexasign-retention.{service,timer} \
  /etc/systemd/system/
sudo systemctl daemon-reload

# 13. PHP-FPM und nginx neu laden
sudo nginx -t && sudo systemctl reload nginx
sudo systemctl reload php8.4-fpm

# 14. PHP-Endpoints anpingen
for p in vorlagen vorlagen/gobd vorlagen/av-vertrag vorlagen/x-rechnung; do
  printf "%-30s → " "/$p/"
  curl -sS -o /dev/null -w "HTTP %{http_code}\n" \
    "https://sign.example.com/$p/"
done
# Alle 200 erwartet.
```

---

## Verifikation nach dem Upgrade

```bash
# Strukturell
curl -sS http://localhost:3060/api/health             | jq '.status'
# erwartet: "ok"

curl -sS http://localhost:3060/api/certificate-status | jq '.isAvailable'
# erwartet: true
```

Funktional (manuell, ~10 min):

- [ ] Login mit Test-Account funktioniert
- [ ] Test-PDF hochladen, Empfänger einladen, Felder setzen, senden
- [ ] In Inkognito-Tab Mail-Link öffnen, signieren
- [ ] Status wird COMPLETED, Seal-Job läuft sauber durch
- [ ] Signiertes PDF herunterladen und in Adobe oder Foxit öffnen — Signatur valide
- [ ] Bestehendes Envelope aus dem Vor-Upgrade-Zeitraum öffnen, PDF-Download intakt
- [ ] Audit-Log lesbar und vollständig

Bei Full Install zusätzlich:

- [ ] `https://<domain>/vorlagen/` 200, alle 11 Vorlagen sichtbar
- [ ] X-Rechnung mit Beispieldaten erzeugen, PDF kommt zurück
- [ ] AV-Vertrag erzeugen, PDF kommt zurück
- [ ] `systemctl list-timers nexasign-retention.timer` zeigt nächsten Lauf

Wenn alles grün: Upgrade erfolgreich abgeschlossen. Pre-Upgrade-Backup nach
Retention-Policy archivieren.

---

## Rollback

Wenn das Upgrade in Produktion bricht: zurück auf den Vor-Upgrade-Zustand. Zwei
Pfade, je nach Eingriffstiefe.

### Schnell-Rollback (nur Image-Tag)

Anwendbar bei Patch-Releases ohne neue DB-Migrations.

```bash
cd /opt/NexaSign/docker/nexasign

# 1. Image-Tag zurücksetzen
sed -i 's|^NEXASIGN_VERSION=.*|NEXASIGN_VERSION=<ALTE_VERSION>|' .env

# 2. Container neu starten
docker compose up -d --force-recreate app

# 3. Verifizieren — Verifikations-Checkliste oben
```

### Voll-Rollback (Image + DB + .env)

Anwendbar wenn neue Migrations gelaufen sind und das Schema **nicht** abwärts­
kompatibel ist.

```bash
cd /opt/NexaSign/docker/nexasign

# 1. App stoppen, DB lassen (für gezielten Restore)
docker compose stop app

# 2. DB-Inhalt aus Pre-Upgrade-Backup wiederherstellen
docker exec -i nexasign-db psql -U nexasign -d nexasign \
  -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'

docker exec -i nexasign-db pg_restore \
  -U nexasign -d nexasign \
  --clean --if-exists --no-owner --no-privileges \
  < /var/backups/nexasign/<datum>/postgres.dump

# 3. Code zurück auf alte Version
cd /opt/NexaSign
git checkout <ALTE_VERSION>

# 4. .env zurücksetzen, falls beim Upgrade Variablen geändert
cp /var/backups/nexasign/<datum>/env.bak docker/nexasign/.env
chmod 600 docker/nexasign/.env

# 5. Image neu bauen
cd docker/nexasign
docker compose build app
# alternativ: docker compose pull app

# 6. Stack hochziehen
docker compose up -d

# 7. Verifizieren — siehe Verifikations-Checkliste
```

Cert-Volume wird in der Regel **nicht** zurückgerollt — das `.p12` ändert sich
nicht zwischen App-Versionen. Nur falls Mount-Punkt oder Permissions im Upgrade
angefasst wurden.

### Voll-Rollback bei Full Install

Zusätzlich zu den App-only-Rollback-Schritten:

```bash
# 8. PHP-Tool-Code aus dem alten Tag erneut deployen
#    (Wiederholung der Schritte 8–11 aus dem Upgrade-Abschnitt,
#    aber aus der alten Version)

# 9. Composer-Vendor zurücksetzen, falls inkompatibel
cd /opt/NexaSign/templates/x-rechnung-web
rm -rf vendor
composer install --no-dev --prefer-dist --no-progress
sudo cp -r vendor /var/www/nexasign/vorlagen/x-rechnung/
```

---

## Häufige Upgrade-Fehler

| Symptom | Ursache | Fix |
|---|---|---|
| App startet nicht, Log: „migration failed" | Neue Prisma-Migration kollidiert mit existierenden Daten | Migration-Log lesen, ggf. Daten manuell anpassen, sonst Voll-Rollback |
| Login schlägt fehl direkt nach Upgrade | `.env` versehentlich überschrieben oder Symlink gebrochen | `.env` aus Pre-Upgrade-Backup wiederherstellen |
| `/api/health` zeigt `cert: missing` | Volume-Mount in `compose.yml` geändert oder Pfad versetzt | `compose.yml` gegen Backup diffen, Mount-Punkt korrigieren |
| `/vorlagen/x-rechnung/` 500 nach Full-Upgrade | Composer-Vendor wurde nicht erneuert | Schritt 10 aus Full-Install-Upgrade wiederholen |
| App ist langsam, Postgres-CPU 100 % nach Upgrade | Neue Indexe werden gebaut | Abwarten — `docker compose logs database` zeigt Index-Build-Fortschritt |
| Container restartet permanent | `.env` enthält neue Pflicht-Variable ohne Wert | Logs prüfen, Variable ergänzen, `docker compose up -d` |
| Bestehende Signaturen invalidieren | Cert wurde unbeabsichtigt ausgetauscht | Cert-Volume aus Backup zurückrollen |

---

## Strategische Empfehlung

| Release-Typ | Sandbox-Test | Backup-Pflicht | Wartungsfenster |
|---|---|---|---|
| **Patch** (vX.Y.Z → vX.Y.(Z+1)) | optional | ja | 5 min |
| **Minor** (vX.Y → vX.(Y+1)) | empfohlen | ja | 15 min |
| **Major** (vX → v(X+1)) | zwingend | ja, mit Volume-Tar zusätzlich | geplant, 30+ min |

Niemals direkt von einer Version mehrere Major-Sprünge auf einmal — jede
Major-Migration einzeln durchziehen, dazwischen verifizieren.

Versions-Tag erst nach erfolgreichem Sandbox-Test in Produktion ziehen. Pre-
Upgrade-Backup mindestens bis zum nächsten erfolgreichen Backup nach dem
Upgrade aufheben — damit ein Voll-Rollback auch nach 24 h noch möglich ist.
