<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- © 2026 NexaStack, NexaSign contributors. Based on NexaSign (AGPL-3.0). -->

# NexaSign — Backup und Restore

Dieses Dokument beschreibt das vollständige Backup einer NexaSign-Installation
und die Wiederherstellung aus einem Backup. Es deckt sowohl den
**App-only-Modus** als auch den **Full-Install-Modus** (mit PHP-Tools) ab.

> **Pflicht vor jedem Upgrade.** Lies [`UPGRADE.nexasign.md`](UPGRADE.nexasign.md)
> nicht ohne ein frisches Backup nach dieser Anleitung. Die Reihenfolge ist:
> Backup → Verifikation des Backups → erst dann Upgrade.

---

## Was muss gesichert werden — und warum

NexaSign hat drei kritische Persistenzschichten. **Wenn auch nur eine fehlt, sind
die anderen wertlos.**

| Komponente | Speicherort | Warum kritisch |
|---|---|---|
| Postgres-Daten | Docker-Volume `nexasign-db` | Envelopes, Recipients, Fields, Audit-Log, sowie die PDF-Bytes selbst (bei `NEXT_PUBLIC_UPLOAD_TRANSPORT=database`). |
| Signatur-Cert | Docker-Volume `nexasign-cert`, im Container unter `/opt/nexasign/cert.p12` | Ohne `.p12` und passende Passphrase keine neuen Signaturen. Renewals sind kein Ersatz: bestehende signierte PDFs validieren weiterhin gegen das Original-Cert. |
| `.env`-Datei | `docker/nexasign/.env` (oft via Symlink) | Enthält `NEXTAUTH_SECRET`, `NEXT_PRIVATE_ENCRYPTION_KEY`, `NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY`, `NEXT_PRIVATE_SIGNING_PASSPHRASE`. **Verlierst Du die Encryption-Keys, ist der DB-Inhalt nicht mehr entschlüsselbar — endgültiger Datenverlust.** |

**Bei Full Install** zusätzlich relevant:

| Komponente | Speicherort | Backup-Strategie |
|---|---|---|
| nginx-Konfiguration | `/etc/nginx/sites-available/...` und `/etc/nginx/snippets/nexasign-php-headers.conf` | Versionskontrolle empfohlen (`/etc/nginx/` in Git oder Etckeeper). |
| systemd-Units | `/etc/systemd/system/nexasign-retention.{service,timer}` | Reproduzierbar aus dem Repo unter `tools/`. Trotzdem mitsichern, falls lokal angepasst. |
| WeasyPrint-venv | `/opt/NexaSign/demo/tools/venv/` | Nicht sichern. Reproduzierbar via `python3 -m venv ... && pip install weasyprint`. |
| Composer-Vendor X-Rechnung | `/var/www/nexasign/vorlagen/x-rechnung/vendor/` | Nicht sichern. Reproduzierbar via `composer install`. |

Faustregel: **Daten sichern, Code reproduzieren.** Was im Git-Repo liegt oder per
Paketmanager installierbar ist, gehört nicht ins Backup.

---

## Backup-Strategie

NexaSign empfiehlt zwei Backup-Pfade nebeneinander:

- **Logisches Backup** mit `pg_dump` — portabel über Postgres-Major-Versionen,
  läuft online, einfach zu prüfen.
- **Volume-Tar** der gesamten Postgres- und Cert-Volumes — bitgenau, schneller
  beim Restore, an die Postgres-Major-Version gebunden.

Für Routine-Backups reicht `pg_dump` plus Cert-Volume-Tar. Vor jedem Major-Upgrade
zusätzlich ein Volume-Tar des DB-Volumes, damit ein Voll-Rollback ohne
Migrations-Replay möglich ist.

---

## Backup — Vorbereitung

```bash
# Ziel-Pfad festlegen — anpassen.
BACKUP_DIR="/var/backups/nexasign/$(date -I)"
sudo mkdir -p "$BACKUP_DIR"
sudo chmod 700 "$BACKUP_DIR"
sudo chown $USER:$USER "$BACKUP_DIR"
```

Off-site-Ziel sollte vorbereitet sein. Backup auf demselben Server ist kein Backup.

---

## 1. Postgres sichern

### Variante A — `pg_dump` (Routine, online)

```bash
docker exec nexasign-db pg_dump \
  -U nexasign \
  -d nexasign \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file=/tmp/postgres.dump

docker cp nexasign-db:/tmp/postgres.dump "$BACKUP_DIR/postgres.dump"
docker exec nexasign-db rm /tmp/postgres.dump
```

Größe prüfen — ein Dump unter 50 KB ist verdächtig:

```bash
du -h "$BACKUP_DIR/postgres.dump"
```

### Variante B — Volume-Tar (vor Major-Upgrade, offline)

```bash
cd /opt/NexaSign/docker/nexasign

# DB-Container für konsistenten Snapshot stoppen
docker compose stop database

docker run --rm \
  -v nexasign-db:/data:ro \
  -v "$BACKUP_DIR":/backup \
  alpine tar czf /backup/nexasign-db-volume.tar.gz -C /data .

docker compose start database
```

---

## 2. Cert-Volume sichern

```bash
docker run --rm \
  -v nexasign-cert:/data:ro \
  -v "$BACKUP_DIR":/backup \
  alpine tar czf /backup/nexasign-cert-volume.tar.gz -C /data .
```

Verifizieren, dass `cert.p12` enthalten ist:

```bash
tar tzf "$BACKUP_DIR/nexasign-cert-volume.tar.gz"
# Erwartet: cert.p12
```

Das `.p12` ist mit der Passphrase aus `.env` verschlüsselt. **Beide gehören
zusammen ins Backup**, sonst ist die Signatur-Funktion beim Restore kaputt.

---

## 3. `.env` sichern

Default-Setup — `.env` liegt direkt in `docker/nexasign/`:

```bash
cp -L /opt/NexaSign/docker/nexasign/.env "$BACKUP_DIR/env.bak"
chmod 600 "$BACKUP_DIR/env.bak"
(
  cd "$BACKUP_DIR"
  sha256sum env.bak > env.sha256
)
```

`-L` folgt Symlinks — relevant, wenn `.env` per Symlink auf einen externen Pfad
zeigt (z. B. `../../demo/app/.env`). So landet die echte Datei im Backup, nicht
nur der Symlink.

---

## 4. Backup-Manifest

```bash
cd "$BACKUP_DIR"
sha256sum postgres.dump nexasign-cert-volume.tar.gz env.bak \
  $(test -f nexasign-db-volume.tar.gz && echo nexasign-db-volume.tar.gz) \
  > MANIFEST.sha256

cat > README.txt <<EOF
NexaSign-Backup vom $(date -Iseconds)
Postgres-Image:  $(docker inspect nexasign-db --format '{{.Config.Image}}' 2>/dev/null)
NexaSign-Image:  $(docker inspect nexasign-app --format '{{.Config.Image}}' 2>/dev/null)
Repo-Commit:     $(cd /opt/NexaSign && git rev-parse HEAD)
Repo-Tag:        $(cd /opt/NexaSign && git describe --tags --always)
EOF

# Optional: in ein einzelnes Archiv packen, leichter zu verschieben
cd /var/backups/nexasign
tar czf "$(basename $BACKUP_DIR).tar.gz" "$(basename $BACKUP_DIR)"
```

---

## 5. Off-site-Sync

Backup auf demselben Server schützt nicht gegen Hardware-Verlust, Ransomware
oder versehentliches `rm -rf`.

```bash
rsync -a --remove-source-files \
  "/var/backups/nexasign/$(date -I).tar.gz" \
  backup-host:/srv/nexasign/

# Letzte 30 Tage lokal halten, ältere off-site rotieren — eigene Policy.
```

---

## Restore — Disaster-Szenario

Frischer Server, Backup ist da, NexaSign soll mit allen Daten wieder laufen.

### 1. System vorbereiten

```bash
sudo apt update
sudo apt install docker.io docker-compose-plugin git jq
sudo systemctl enable --now docker

# Optional: SSH-Key für Repo-Zugriff einrichten
git clone git@github-nexastack:NexaStack-Software/NexaSign.git /opt/NexaSign
cd /opt/NexaSign
git checkout <Tag-aus-README.txt-im-Backup>
```

### 2. Backup-Archiv entpacken

```bash
sudo mkdir -p /restore
sudo tar xzf <backup>.tar.gz -C /restore
RESTORE_DIR="/restore/$(basename <backup> .tar.gz)"
(
  cd "$RESTORE_DIR"
  sha256sum -c MANIFEST.sha256
)
```

Wenn `MANIFEST.sha256` Fehler meldet, Backup ist beschädigt — anderes Backup nehmen.

### 3. `.env` wiederherstellen

```bash
cp "$RESTORE_DIR/env.bak" /opt/NexaSign/docker/nexasign/.env
chmod 600 /opt/NexaSign/docker/nexasign/.env
(
  cd "$RESTORE_DIR"
  sha256sum -c env.sha256
)
```

### 4. Volumes anlegen

```bash
docker volume create nexasign-db
docker volume create nexasign-cert
```

### 5. Cert-Volume befüllen

```bash
docker run --rm \
  -v nexasign-cert:/data \
  -v "$RESTORE_DIR":/backup:ro \
  alpine sh -c "cd /data && tar xzf /backup/nexasign-cert-volume.tar.gz"

docker run --rm -v nexasign-cert:/data:ro alpine ls -la /data
# Erwartet: cert.p12 + ggf. weitere Dateien
```

### 6. Postgres wiederherstellen

**Variante A — aus `pg_dump`:**

```bash
cd /opt/NexaSign/docker/nexasign
docker compose up -d database

# Warten, bis healthy
until docker compose ps database | grep -q "healthy"; do
  sleep 2
done

docker exec -i nexasign-db pg_restore \
  -U nexasign \
  -d nexasign \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  < "$RESTORE_DIR/postgres.dump"
```

**Variante B — aus Volume-Tar:**

```bash
cd /opt/NexaSign/docker/nexasign
docker compose down
docker volume rm nexasign-db
docker volume create nexasign-db

docker run --rm \
  -v nexasign-db:/data \
  -v "$RESTORE_DIR":/backup:ro \
  alpine sh -c "cd /data && tar xzf /backup/nexasign-db-volume.tar.gz"
```

### 7. App starten

```bash
docker compose up -d
```

Prisma-Migrations laufen automatisch beim App-Start. Logs verfolgen:

```bash
docker compose logs -f app
```

### 8. PHP-Tools (nur Full Install)

Folge der Schritt-für-Schritt-Anleitung in
[`DEPLOY-PHP.nexasign.md`](DEPLOY-PHP.nexasign.md). Diese Tools haben keinen
eigenen State — sie werden vom Repo aus neu deployt, nicht restored.

---

## Verifikations-Checkliste nach Restore

```bash
# Strukturell
curl -sS http://localhost:3060/api/health | jq

# Cert-Status
curl -sS http://localhost:3060/api/certificate-status | jq
# erwartet: "isAvailable": true
```

Funktional:

- [ ] Login mit bestehendem Account funktioniert
- [ ] Ein altes COMPLETED-Envelope wird angezeigt
- [ ] Signiertes PDF eines alten Envelopes lädt herunter und öffnet im PDF-Reader
- [ ] Audit-Log eines alten Envelopes ist vollständig lesbar
- [ ] Neues Test-Envelope kann erstellt, gesendet, signiert werden
- [ ] Empfänger-Mail kommt an (SMTP-Konfig stimmt)

Wenn alle sechs Punkte grün sind: Restore erfolgreich abgeschlossen.

---

## Häufige Fehler und Diagnose

| Symptom | Ursache | Fix |
|---|---|---|
| Login schlägt fehl, „Invalid session" | `NEXTAUTH_SECRET` in restored `.env` weicht vom DB-Stand ab | Original-`.env` aus Backup nehmen, oder alle Sessions in DB löschen: `docker exec nexasign-db psql -U nexasign -d nexasign -c 'TRUNCATE TABLE "Session";'` |
| Encrypted DB-Felder unleserlich | `NEXT_PRIVATE_ENCRYPTION_KEY` weicht vom Original ab | Originaler Key zwingend nötig, kein Workaround. Falls verloren: Datenverlust. |
| Signaturen schlagen fehl nach Restore | `NEXT_PRIVATE_SIGNING_PASSPHRASE` weicht von der `.p12`-Passphrase ab | Beide aus dem gleichen Backup-Stand wiederherstellen |
| `pg_restore` meldet „role does not exist" | DB-User-Anlage hat im Restore nicht funktioniert | `--no-owner --no-privileges` bei Dump UND Restore verwenden, wie oben |
| `pg_restore` meldet „relation already exists" | Restore in nicht-leere DB | `--clean --if-exists` ergänzen, oder Volume vorher löschen und neu anlegen |
| `/api/certificate-status` meldet `unreadable` | Volume korrekt restored, aber Permissions falsch | `docker run --rm -v nexasign-cert:/v alpine chmod 644 /v/cert.p12` |
| Container-User darf Cert nicht lesen (`EACCES`) | UID-Mismatch zwischen Image und Volume | Im Volume `chown 1001:1001 cert.p12` (Container-User in `docker/Dockerfile` nachschlagen) |
| Healthcheck dauerhaft `error` | Postgres-Volume nicht oder falsch restored | `docker compose logs database`, `pg_restore`-Schritt erneut prüfen |

---

## Backup-Automatisierung

NexaSign liefert aktuell **kein** fertiges Backup-Skript mit. Für die
Produktion empfohlen: ein eigenes systemd-Timer-Skript, das die obigen Schritte
1–4 ausführt, das Resultat off-site syncht und ältere Backups nach einer
Retention-Policy (z. B. 7 tägliche, 4 wöchentliche, 6 monatliche) abräumt.

Ein Pull-Request mit einem `tools/nexasign-backup.{sh,service,timer}`-Trio in den
Stil der bestehenden Retention-Units ist willkommen.

Bis dahin: das Backup wöchentlich aus dem Kalender heraus zur Probe restoren —
ein nicht getestetes Backup ist kein Backup.
