<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- © 2026 NexaStack, NexaSign contributors. Based on NexaSign (AGPL-3.0). -->

# NexaSign — Deployment der Vorlagen-Tools (PHP)

Dieser Abschnitt betrifft **nur die öffentlichen Vorlagen-Seiten** (`/vorlagen/*`),
den **AV-Vertrag- und X-Rechnung-Generator**, sowie die **GoBD-Tools**. Die eigentliche
Signatur-App (Docker auf Port 3060) wird separat über `docker/nexasign/compose.yml`
gestartet — siehe [README.md](README.md#schritt-1--app-stack-pflicht).

**Überspringen können Sie diesen Abschnitt**, wenn Sie die reine Dokumenten-Signatur-App
ohne Vorlagen-Hub betreiben willst.

---

## Überblick — wer ist wofür zuständig?

| Komponente | Ausführung | Quelle im Repo |
|---|---|---|
| Remix-App (Signatur-UI, tRPC, Worker-Jobs) | Docker-Container auf Port 3060 | `apps/remix/` |
| `/vorlagen/` — Hub + Vertragsgeneratoren + Markdown-Download | PHP 8.1+ via PHP-FPM + WeasyPrint | `templates/vorlagen-index/` |
| `/vorlagen/av-vertrag/` — Form-Generator | PHP + WeasyPrint (Python-venv) | `templates/av-vertrag-web/` |
| `/vorlagen/x-rechnung/` — ZUGFeRD-Generator | PHP + Composer (`horstoeko/zugferd`) | `templates/x-rechnung-web/` |
| `/vorlagen/gobd/` — Info-Hub | PHP | `templates/vorlagen-index/gobd/` |
| GoBD-Retention-Cron + Export-CLI | systemd-Units + Shell auf dem Host | `tools/` |

---

## Voraussetzungen

Debian/Ubuntu-Beispiel — für andere Distros entsprechend übersetzen:

```bash
sudo apt install \
  nginx \
  php8.4-fpm php8.4-cli php8.4-xml php8.4-mbstring php8.4-zip \
  python3-venv \
  unzip
```

---

## 1. Ordner-Layout auf dem Server

Vorschlag (kann angepasst werden — die nginx-Regeln dann entsprechend mitziehen):

```
/var/www/nexasign/vorlagen/           ← Web-Root für /vorlagen/*
/opt/NexaSign/demo/tools/             ← Lokale Host-Tools (venv, KoSIT; nicht GitHub)
/etc/systemd/system/                  ← Retention-Timer + Service
```

```bash
sudo mkdir -p /var/www/nexasign/vorlagen
sudo mkdir -p /opt/NexaSign/demo/tools
sudo chown -R $USER:www-data /var/www/nexasign
```

---

## 2. Vorlagen-Hub + 11 Markdown-Vorlagen

```bash
# Aus dem Repo-Root:
sudo cp -r templates/vorlagen-index/*.php /var/www/nexasign/vorlagen/
sudo cp -r templates/vorlagen-index/gobd /var/www/nexasign/vorlagen/
sudo mkdir -p /var/www/nexasign/vorlagen/source-md
sudo cp Vorlagen/*.md /var/www/nexasign/vorlagen/source-md/
sudo chown -R $USER:www-data /var/www/nexasign/vorlagen/
sudo find /var/www/nexasign/vorlagen -type d -exec chmod 750 {} \;
sudo find /var/www/nexasign/vorlagen -type f -exec chmod 640 {} \;
```

Die 11 Vorlagen (NDA, Arbeitsvertrag, AV-Vertrag, Verfahrensdokumentation, …)
liegen jetzt unter `/var/www/nexasign/vorlagen/source-md/`. Die operativen
Vertragsvorlagen werden vom `generator.php`-Handler als Formular + PDF
ausgeliefert; die Roh-Markdown-Dateien bleiben über `download.php` verfügbar.

---

## 3. AV-Vertrag-Generator (WeasyPrint)

WeasyPrint in einem isolierten venv — **nicht** system-weit installieren:

```bash
# Python venv mit WeasyPrint
sudo python3 -m venv /opt/NexaSign/demo/tools/venv
sudo /opt/NexaSign/demo/tools/venv/bin/pip install weasyprint
/opt/NexaSign/demo/tools/venv/bin/weasyprint --version   # Version-Check

# AV-Template deployen
sudo mkdir -p /var/www/nexasign/vorlagen/av-vertrag
sudo cp templates/av-vertrag-web/*.php /var/www/nexasign/vorlagen/av-vertrag/
sudo chown -R $USER:www-data /var/www/nexasign/vorlagen/av-vertrag
sudo chmod 640 /var/www/nexasign/vorlagen/av-vertrag/*.php
```

---

## 4. X-Rechnung-Generator (Composer + horstoeko/zugferd)

```bash
# Composer installieren (falls nicht vorhanden)
# → https://getcomposer.org/download/ für aktuelle Anleitung

# Dependencies lokal im templates-Ordner ziehen (vendor/ nicht committet!)
cd templates/x-rechnung-web
composer install --no-dev --prefer-dist --no-progress

# Deploy
sudo cp -r templates/x-rechnung-web/{*.php,composer.json,composer.lock,vendor} \
  /var/www/nexasign/vorlagen/x-rechnung/
sudo chown -R $USER:www-data /var/www/nexasign/vorlagen/x-rechnung
sudo find /var/www/nexasign/vorlagen/x-rechnung -type d -exec chmod 750 {} \;
sudo find /var/www/nexasign/vorlagen/x-rechnung -type f -exec chmod 640 {} \;
```

---

## 5. nginx-Konfiguration

Die folgenden location-Blöcke in den Server-Block Ihrer App-Domain aufnehmen
(Reverse-Proxy zum Docker-Container bleibt separat). Beispiel-Vollkonfig ist
kommentarreich — minimalistische Fassung:

```nginx
server {
    listen 443 ssl http2;
    server_name sign.example.com;

    # ── TLS-Zertifikat (Let's Encrypt o.ä.) ──
    ssl_certificate     /etc/letsencrypt/live/sign.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sign.example.com/privkey.pem;

    # ── Rate-Limits ──
    # Voraussetzung: in nginx.conf globale Zonen definieren:
    #   limit_req_zone $binary_remote_addr zone=nexasign_pdf:10m     rate=10r/m;
    #   limit_req_zone $binary_remote_addr zone=nexasign_extract:10m rate=30r/m;

    # ── Security-Header-Snippet (einmal anlegen) ──
    # In /etc/nginx/snippets/nexasign-php-headers.conf:
    #   add_header Content-Security-Policy "…" always;
    #   add_header X-Content-Type-Options "nosniff" always;
    #   add_header X-Frame-Options "DENY" always;
    #   add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    #   add_header Permissions-Policy "…" always;
    # Vorlage: siehe deploy/nginx/nexasign-php-headers.conf im Repo.

    # ── Statische Logos ──
    location ~* ^/logo-(1x|2x)\.(webp|png)$ {
        root /var/www/nexasign;
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # ── Vorlagen-Hub ──
    location = /vorlagen/ {
        include snippets/nexasign-php-headers.conf;
        include fastcgi_params;
        fastcgi_pass unix:/run/php/php8.4-fpm.sock;
        fastcgi_param SCRIPT_FILENAME /var/www/nexasign/vorlagen/index.php;
    }

    # ── Markdown-Download-Handler ──
    location ~ ^/vorlagen/download/([0-9a-z][0-9a-z-]*\.md)$ {
        include snippets/nexasign-php-headers.conf;
        include fastcgi_params;
        fastcgi_pass unix:/run/php/php8.4-fpm.sock;
        fastcgi_param SCRIPT_FILENAME /var/www/nexasign/vorlagen/download.php;
        fastcgi_param QUERY_STRING file=$1;
    }
    location ^~ /vorlagen/source-md/ { return 404; }

    # ── Generische Vertragsgeneratoren aus Markdown-Vorlagen ──
    location ~ ^/vorlagen/(nda-einseitig|nda-gegenseitig|freelancer-werkvertrag|arbeitsvertrag-unbefristet|arbeitsvertrag-befristet|beratungsvertrag|aufhebungsvertrag|angebotsannahme|agb-zustimmung)$ {
        return 301 /vorlagen/$1/;
    }
    location ~ ^/vorlagen/(nda-einseitig|nda-gegenseitig|freelancer-werkvertrag|arbeitsvertrag-unbefristet|arbeitsvertrag-befristet|beratungsvertrag|aufhebungsvertrag|angebotsannahme|agb-zustimmung)/$ {
        include snippets/nexasign-php-headers.conf;
        include fastcgi_params;
        fastcgi_pass unix:/run/php/php8.4-fpm.sock;
        fastcgi_param SCRIPT_FILENAME /var/www/nexasign/vorlagen/generator.php;
        fastcgi_param QUERY_STRING slug=$1;
        fastcgi_read_timeout 90s;
    }

    # ── GoBD-Hub ──
    location = /vorlagen/gobd/ {
        include snippets/nexasign-php-headers.conf;
        include fastcgi_params;
        fastcgi_pass unix:/run/php/php8.4-fpm.sock;
        fastcgi_param SCRIPT_FILENAME /var/www/nexasign/vorlagen/gobd/index.php;
    }

    # ── AV-Vertrag-Generator ──
    location = /vorlagen/av-vertrag/ {
        limit_req zone=nexasign_pdf burst=3 nodelay;
        include snippets/nexasign-php-headers.conf;
        include fastcgi_params;
        fastcgi_pass unix:/run/php/php8.4-fpm.sock;
        fastcgi_param SCRIPT_FILENAME /var/www/nexasign/vorlagen/av-vertrag/index.php;
        fastcgi_read_timeout 90s;
    }
    location = /vorlagen/av-vertrag/template.html.php { return 404; }

    # ── X-Rechnung-Generator + Extract ──
    location = /vorlagen/x-rechnung/ {
        client_max_body_size 15m;
        include snippets/nexasign-php-headers.conf;
        include fastcgi_params;
        fastcgi_pass unix:/run/php/php8.4-fpm.sock;
        fastcgi_param SCRIPT_FILENAME /var/www/nexasign/vorlagen/x-rechnung/index.php;
        fastcgi_read_timeout 120s;
    }
    location = /vorlagen/x-rechnung/generate {
        client_max_body_size 15m;
        limit_req zone=nexasign_pdf burst=3 nodelay;
        include snippets/nexasign-php-headers.conf;
        include fastcgi_params;
        fastcgi_pass unix:/run/php/php8.4-fpm.sock;
        fastcgi_param SCRIPT_FILENAME /var/www/nexasign/vorlagen/x-rechnung/generate.php;
        fastcgi_read_timeout 120s;
    }
    location = /vorlagen/x-rechnung/extract {
        client_max_body_size 15m;
        limit_req zone=nexasign_extract burst=5 nodelay;
        include snippets/nexasign-php-headers.conf;
        include fastcgi_params;
        fastcgi_pass unix:/run/php/php8.4-fpm.sock;
        fastcgi_param SCRIPT_FILENAME /var/www/nexasign/vorlagen/x-rechnung/extract.php;
        fastcgi_read_timeout 120s;
    }
    location ^~ /vorlagen/x-rechnung/vendor/   { return 404; }
    location = /vorlagen/x-rechnung/composer.json { return 404; }
    location = /vorlagen/x-rechnung/composer.lock { return 404; }

    # ── App (Docker-Reverse-Proxy) — kommt zuletzt als Catch-All ──
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

Nach jeder nginx-Änderung: `sudo nginx -t && sudo systemctl reload nginx`.

---

## 6. GoBD-Retention-Cron (optional)

Die systemd-Units prüfen täglich, welche signierten Envelopes die 10-jährige
Aufbewahrungspflicht nach § 147 AO / § 257 HGB erreicht haben. Sie **löschen nichts**
— melden nur im Log.

```bash
# Scripts
sudo chmod +x /opt/NexaSign/tools/nexasign-*.sh

# systemd-Units
sudo cp tools/nexasign-retention.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now nexasign-retention.timer
sudo systemctl list-timers nexasign-retention.timer
```

Log: `/var/log/nexasign/retention-check.log`. Das Script verbindet sich zum
`nexasign-db`-Container und zählt COMPLETED-Envelopes nach Alter.

Das **Export-Tool** (`nexasign-gobd-export.sh`) ist interaktiv — liefert ZIP mit
signierten PDFs, Audit-Log und SHA-256-Manifest für Z2/Z3-Prüfzugriff nach GoBD.
Bei Bedarf manuell aufrufen: `sudo /opt/NexaSign/tools/nexasign-gobd-export.sh`.

---

## 7. Verifizieren

```bash
curl -sS -o /dev/null -w "HTTP %{http_code}\n" https://sign.example.com/vorlagen/
curl -sS -o /dev/null -w "HTTP %{http_code}\n" https://sign.example.com/vorlagen/gobd/
curl -sS -o /dev/null -w "HTTP %{http_code}\n" https://sign.example.com/vorlagen/av-vertrag/
curl -sS -o /dev/null -w "HTTP %{http_code}\n" https://sign.example.com/vorlagen/x-rechnung/
# Alle 200 → deployed.
```

---

## Fehlerdiagnose

| Symptom | Check |
|---|---|
| `/vorlagen/x-rechnung/` wirft 500 | `tail /var/log/nginx/error.log` + `journalctl -u php8.4-fpm`. Typisch: vendor-Dir fehlt oder PHP-Extension. |
| Upload scheitert mit 413 | `client_max_body_size` im nginx-Block auf 15m setzen. |
| AV-Vertrag-Generator hängt, kein PDF | WeasyPrint-venv prüfen: `/opt/NexaSign/demo/tools/venv/bin/weasyprint --version`. Pfad in `templates/av-vertrag-web/index.php` stimmt? |
| X-Rechnung erzeugt, aber ist nicht KoSIT-konform | Siehe `scripts/nexasign/` oder bauen eigenes KoSIT-Setup (Java + Validator 1.6.2+ + XRechnung-Config). |
| Rate-Limit greift zu früh | Zonen-Definitionen in `nginx.conf` vs. `limit_req` in Location-Blöcken prüfen. |

---

## Upstream-Synchronisation

Die PHP-Tools sind **ausschließlich NexaSign-Zusatz**, keine Änderung am NexaSign-Kern.
Bei `git fetch upstream && git merge upstream/main` gibt es hier keine Konflikte.
Sicherheit: alle eigenen Dateien liegen in `templates/*`, `scripts/nexasign/`, `tools/`,
`Vorlagen/`, `docker/nexasign/` sowie den `*.nexasign.md`-Markdown-Files.
