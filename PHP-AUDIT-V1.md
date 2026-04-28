<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- © 2026 NexaStack, NexaSign contributors. Based on NexaSign (AGPL-3.0). -->

# NexaSign — Sicherheits-Audit der PHP-Tools (V1-Pre-Release)

**Stand:** 2026-04-26
**Scope:** `templates/x-rechnung-web/{index,generate,extract}.php`,
`templates/av-vertrag-web/{index,template.html}.php`,
`templates/vorlagen-index/{index,download,_nav,_footer}.php`
**Methodik:** `composer audit` plus manueller Review gegen OWASP-Top-10 mit
Fokus auf Upload-Sicherheit, DoS-Resistenz, Information Disclosure,
XSS, Path-Traversal und Command Injection.

---

## Executive Summary

Die PHP-Tools sind insgesamt **deutlich besser gehärtet als für eine Phase-1-Beta
zu erwarten**. Es gibt zwei kleinere Information-Disclosure-Lücken im
Error-Handling, einen Lizenz-Drift in `composer.json`, und einen hart codierten
Pfad zur WeasyPrint-Binary. Keiner dieser Punkte ist V1-blockierend, alle sind
unter einer Stunde behoben.

**`composer audit`: clean** — keine bekannten Vulnerabilities in den Dependencies.

| Risiko | Anzahl |
|---|---|
| Hoch (V1-Blocker) | 0 |
| Mittel (V1, sollte gefixt werden) | 2 |
| Niedrig (V1.1 oder Polish) | 3 |

---

## Was gut funktioniert

| Schutz | Wo | Wie |
|---|---|---|
| Upload-Größen-Limits | extract.php, generate.php | 10 MB Hard-Cap mit `bail()` |
| MIME-Erkennung | extract.php L45, generate.php L62 | `mime_content_type()` plus Magic-Byte-Check `%PDF-` |
| Parser-DoS-Schutz | extract.php L20, generate.php L17 | `set_time_limit(25–30)` + `memory_limit=256M` |
| WeasyPrint-DoS | av-vertrag/index.php L15 | `set_time_limit(60)` + 5000-Zeichen-Längen-Cap pro Feld |
| XSS-Schutz | alle Templates | konsequent `htmlspecialchars($v, ENT_QUOTES \| ENT_SUBSTITUTE, 'UTF-8')` über `h()`-Helper |
| Path-Traversal | download.php L12 | strikte Regex-Whitelist `^[0-9a-z][0-9a-z-]*\.md$` |
| Method-Enforcement | extract.php L36, generate.php L30 | POST-only, sonst 405/Redirect |
| Input-Validation | generate.php L70–113 | `req()`-Helper für Pflichtfelder, numerische Bounds-Checks für Mengen/Preise/Steuersatz |
| Output-Filename-Sanitization | generate.php L253, av-vertrag L96 | `preg_replace('/[^A-Za-z0-9._-]/', ...)` |
| HTTP-Header | beide PDF-Endpoints | `X-Content-Type-Options: nosniff`, `Cache-Control: no-store` |
| Command Injection | av-vertrag L75 | `escapeshellcmd()` plus stdin-Pipe statt CLI-Args für User-Daten |
| Information Disclosure (Server-side) | beide Tools | Stacktraces nur ins `error_log`, nicht zum Client |

---

## Befunde

### Mittel: Exception-Message wird an Client geleakt

**Datei:** `templates/x-rechnung-web/extract.php` Zeile 58
**Datei:** `templates/x-rechnung-web/generate.php` Zeile 277

In beiden Fällen wird `$e->getMessage()` aus einer abgefangenen Exception
unverändert an den Browser zurückgegeben:

```php
// extract.php:58
fail(422, 'PDF konnte nicht gelesen werden: ' . $e->getMessage());

// generate.php:277
bail('Technischer Fehler bei der Erzeugung: ' . $e->getMessage());
```

**Risiko:** PHP-Exceptions enthalten in der Praxis häufig absolute Server-Pfade
(`/opt/NexaSign/...`), Library-interne Implementierungs-Details, oder
File-Permission-Hinweise. Ein Angreifer kann durch gezielt manipulierte PDFs
diese Meldungen provozieren und so Auskunft über das interne Layout bekommen
(OWASP A09: Security Logging and Monitoring Failures, A05: Security
Misconfiguration).

**Fix:** Exception-Details ins `error_log` schreiben, nur generische Meldung
an den Client. generate.php loggt schon — nur die Client-Meldung kürzen. extract.php
muss zusätzlich loggen.

### Mittel: composer.json deklariert falsche Lizenz

**Datei:** `templates/x-rechnung-web/composer.json`

```json
"license": "proprietary"
```

**Risiko:** Das Repo ist AGPL-3.0-or-later (siehe LICENSE, NOTICE, alle SPDX-Header).
`"proprietary"` ist nicht nur falsch, sondern juristisch gefährlich, weil ein
Distributor sich darauf verlassen könnte, dass die PHP-Tools NICHT der AGPL
unterliegen. Das wäre ein Lizenz-Verstoß auf beiden Seiten.

**Fix:** `"license": "AGPL-3.0-or-later"`.

### Niedrig: WeasyPrint-Pfad hart codiert

**Datei:** `templates/av-vertrag-web/index.php` Zeile 19

```php
const WEASYPRINT_BIN = '/opt/NexaSign/demo/tools/venv/bin/weasyprint';
```

**Risiko:** Operator, der den venv unter einem anderen Pfad anlegt (z. B.
`/srv/...` statt `/opt/NexaSign/demo/...`), kommt mit einer kryptischen
„PDF-Engine nicht erreichbar"-Meldung im UI nicht weit. Das Setup-Loch ist
nicht sicherheitsrelevant, aber es bricht den Self-Hoster-Pfad.

**Fix:** Konstante aus Env-Variable lesen, mit Default auf den dokumentierten
Pfad: `getenv('NEXASIGN_WEASYPRINT_BIN') ?: '/opt/NexaSign/demo/tools/venv/bin/weasyprint'`.
Plus expliziter Pre-Flight-Check `is_executable()` mit klarer Meldung im UI,
nicht nur als 500-Status.

### Niedrig: nginx-Härtung lebt nur in der Doku

**Datei:** `DEPLOY-PHP.nexasign.md` Abschnitt 5

Rate-Limit-Zonen, Security-Header-Snippet, `vendor/`-Block und
`source-md/`-Lockout existieren als Beispiel-Config. Wenn ein Operator den
nginx-Block falsch aufsetzt oder direkt an PHP-FPM hängt, sind alle Tools
ungeschützt.

**Fix:** Eine Beispiel-`nginx/nexasign-vorlagen.conf` und das
`nexasign-php-headers.conf`-Snippet als committete Files in
`deploy/nginx/`. Die Doku verweist dann auf dieses File statt es nur zu
beschreiben. Damit sind die Härtungs-Regeln in Versionskontrolle und können
mit dem Repo mitwachsen.

### Niedrig: package-Name in composer.json

**Datei:** `templates/x-rechnung-web/composer.json`

```json
"name": "nexasign/x-rechnung"
```

Konsistent mit dem Rest des Projekts wäre `nexastack/x-rechnung-web` oder
`nexasign/x-rechnung-web` als Package-Name. Reine Konsistenz, kein Bug.

---

## Was nicht im Audit-Scope war

- TLS-Konfiguration (delegiert an die nginx-Konfig auf der Operator-Seite)
- Rate-Limit-Werte selbst (Defaults sind in `DEPLOY-PHP.nexasign.md` dokumentiert,
  müssen pro Installation an Last angepasst werden)
- Authentifizierung der `/vorlagen/*`-Endpoints (Tools sind bewusst öffentlich,
  AV-Vertrag- und X-Rechnung-Generator sollen ohne Login nutzbar sein)
- Detail-Audit der Composer-Dependencies (`horstoeko/zugferd`, `smalot/pdfparser`):
  upstream gepflegt, `composer audit` clean

---

## Empfehlung für V1

Die zwei Mittel-Risiko-Befunde (Exception-Leak in extract.php und generate.php,
plus Lizenz-Drift in composer.json) sind in zehn Minuten behoben und gehören
in v1.0.0. Die drei Niedrig-Risiko-Befunde gehen in v1.0.1 oder das nächste
Polish-Sprint.

**Damit ist V1 aus PHP-Sicht release-fähig.**
