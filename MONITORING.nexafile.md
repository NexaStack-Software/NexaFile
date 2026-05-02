<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- © 2026 NexaStack, NexaSign contributors. Based on NexaSign (AGPL-3.0). -->

# NexaFile — Monitoring und Post-Release-Checks

Dieses Runbook beschreibt die minimale Betriebsueberwachung fuer Produktion und
Demo nach einem Release. Es ersetzt kein vollstaendiges Monitoring-System, gibt
aber klare Kommandos fuer die ersten Stunden nach einer Veroeffentlichung.

---

## Instanzen

| Instanz | Zweck | URL |
|---|---|---|
| Produktion | laufende NexaFile-App | `https://nexasign.nexastack.co` |
| Demo | oeffentliche Vorschau mit Reset | `https://nexasign-demo.nexastack.co` |

Die Demo wird privat betrieben und ist nicht Teil des Open-Source-Repos.

---

## Sofortcheck nach Release

```bash
cd /opt/NexaSign

git status -sb
git log -1 --oneline

curl -fsSL https://nexasign.nexastack.co/api/health
curl -fsSL https://nexasign-demo.nexastack.co/api/health

curl -fsSL https://nexasign.nexastack.co/api/certificate-status
curl -fsSL https://nexasign-demo.nexastack.co/api/certificate-status

docker ps --filter name=nexasign-app --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
scripts/nexasign/check-demo-drift.sh --strict
```

Erwartet:

- Git-Arbeitsbaum ist clean.
- Health-Endpunkte melden `status: ok`.
- Certificate-Status meldet `isAvailable: true`.
- `nexasign-app` ist `healthy`.
- Demo-Drift meldet keine Failures.

---

## 24-Stunden-Release-Watch

Empfohlene Kadenz nach einem stabilen Release:

| Zeitpunkt | Check |
|---|---|
| direkt nach Release | Sofortcheck komplett |
| +30 Minuten | Health, Container, App-Logs |
| +2 Stunden | Health, Demo-Reset, Demo-Drift |
| +24 Stunden | Health, Logs, GitHub Issues |

Kommandos:

```bash
curl -fsSL https://nexasign.nexastack.co/api/health
curl -fsSL https://nexasign-demo.nexastack.co/api/health
docker logs --tail 200 nexasign-app
systemctl status nexasign-demo-reset.timer
scripts/nexasign/check-demo-drift.sh --strict
gh issue list --repo NexaStack-Software/NexaFile --state open --limit 20
```

---

## Demo-Reset pruefen

Die Demo soll regelmaessig auf den Baseline-Zustand zurueckgesetzt werden.

```bash
systemctl status nexasign-demo-reset.timer
systemctl status nexasign-demo-reset.service
```

Wenn der Timer nicht aktiv ist:

```bash
systemctl list-units 'nexasign-demo-reset*'
journalctl -u nexasign-demo-reset.service -n 100 --no-pager
```

Nur nach Ursachenpruefung neu starten:

```bash
systemctl restart nexasign-demo-reset.timer
```

---

## Logs

App-Logs:

```bash
docker logs --tail 200 nexasign-app
docker logs --since 30m nexasign-app
```

Compose-Status:

```bash
docker compose -f docker/nexasign/compose.yml ps
```

nginx:

```bash
sudo tail -n 100 /var/log/nginx/error.log
sudo tail -n 100 /var/log/nginx/access.log
```

---

## Hinweise zu Warnungen

Bekannte nicht-blockierende Warnungen nach `v1.0.0`:

- Prisma `package.json#prisma` Deprecation. Tracking: GitHub Issue #2.
- Browserslist/caniuse-lite Daten veraltet. Tracking: GitHub Issue #3.
- Bestehende Lint-Warnungen ohne Errors. Tracking: GitHub Issue #4.

Diese Warnungen sind keine Sofort-Incidents, solange Health, Signatur-Flow,
Migrationsstatus und Container-Health gruen bleiben.

---

## Incident-Kriterien

Als Incident behandeln:

- `/api/health` meldet nicht `ok`.
- `/api/certificate-status` meldet `isAvailable: false` in Produktion.
- `nexasign-app` ist nicht healthy oder restartet fortlaufend.
- Signierte Dokumente bleiben nach Abschluss im falschen Status haengen.
- Demo-Drift meldet Failures, die nicht durch einen gerade laufenden Release-
  Commit erklaerbar sind.
- GitHub Issues melden reproduzierbare V1-Regressions.

Bei Incident:

1. Keine destruktiven Kommandos ausfuehren.
2. Logs und Health-Ausgaben sichern.
3. Letzten bekannten guten Commit/Tag notieren.
4. Rollback-Pfad in [`UPGRADE.nexafile.md`](UPGRADE.nexafile.md) nutzen.
