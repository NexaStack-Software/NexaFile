<?php
// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors. Based on NexaSign (AGPL-3.0).
/**
 * NexaSign — GoBD-Hub
 * Zentrale Anlaufstelle für alles rund um GoBD-konforme Archivierung.
 * Enthält: Einführung, Verantwortungs-Split, Verfahrensdoku-Download,
 * Export-Tool-Info, FAQ mit Fachbegriffen.
 */
declare(strict_types=1);
?><!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>GoBD-Archivierung — NexaSign</title>
<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;0,6..72,700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono&display=swap" rel="stylesheet">
<style>
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
:root {
  --primary:#140100; --accent:#9e4127; --accent-hover:#b84d2e;
  --bg:#fdf9f3; --bg-white:#ffffff; --text:#1c1c18; --text-muted:#6b6b63;
  --border:#e6e2dc; --success:#2d7a45; --warning:#b8860b;
  --radius:0.5rem;
  --font-serif:'Newsreader', Georgia, serif;
  --font-sans:'Plus Jakarta Sans', system-ui, sans-serif;
  --font-mono:'JetBrains Mono', 'SF Mono', Menlo, monospace;
}
body { font-family: var(--font-sans); background: var(--bg); color: var(--text);
  min-height: 100vh; -webkit-font-smoothing: antialiased; line-height: 1.6; }
main { max-width: 1280px; margin: 2.5rem auto 4rem; padding: 0 2rem; }
.back { display: inline-block; color: var(--text-muted); text-decoration: none;
  font-size: 0.9rem; margin-bottom: 1rem; }
.back:hover { color: var(--accent); }

/* ─── Hero ─── */
h1 { font-family: var(--font-serif); font-size: clamp(2rem, 4.5vw, 3rem);
  line-height: 1.08; letter-spacing: -0.02em; color: var(--primary);
  margin-bottom: 0.6rem; font-weight: 600; }
.lead { font-size: 1.1rem; color: var(--text-muted); max-width: 780px; margin-bottom: 2.5rem; }
.lead strong { color: var(--text); }

/* ─── Abschnitte ─── */
h2 { font-family: var(--font-serif); font-size: 1.75rem; color: var(--primary);
  margin: 3rem 0 0.75rem 0; font-weight: 600; letter-spacing: -0.015em;
  border-bottom: 1px solid var(--border); padding-bottom: 0.4rem; }
h3 { font-family: var(--font-sans); font-size: 1.05rem; color: var(--primary);
  margin: 1.4rem 0 0.4rem 0; font-weight: 700; }
p { margin-bottom: 0.8rem; }
ul, ol { margin: 0.5rem 0 1rem 1.5rem; }
li { margin-bottom: 0.35rem; }

.split { display: grid; grid-template-columns: 1fr; gap: 1.25rem; margin: 1rem 0 2rem 0; }
@media (min-width: 720px) { .split { grid-template-columns: 1fr 1fr; } }

.box { background: var(--bg-white); border: 1.5px solid var(--border);
  border-radius: 0.75rem; padding: 1.25rem 1.4rem; }
.box.ok   { border-left: 4px solid var(--success); }
.box.user { border-left: 4px solid var(--warning); }
.box h3 { margin-top: 0; display: flex; align-items: center; gap: 0.4rem; }
.box h3 .icon { font-size: 1.3rem; }
.box ul { margin: 0.4rem 0 0 1.3rem; }
.box li { font-size: 0.94rem; color: var(--text); }

/* ─── Karten für Module ─── */
.modules { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.1rem; margin: 1rem 0 2rem 0; }
.module-card { background: var(--bg-white); border: 1.5px solid var(--border);
  border-radius: 0.75rem; padding: 1.4rem; display: flex; flex-direction: column;
  gap: 0.45rem; text-decoration: none; color: inherit;
  transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s; }
.module-card:hover { transform: translateY(-2px);
  box-shadow: 0 10px 24px rgba(0,0,0,0.06); border-color: var(--accent); }
.module-card.disabled { opacity: 0.55; cursor: not-allowed; }
.module-card.disabled:hover { transform: none; box-shadow: none; border-color: var(--border); }
.module-badge { font-size: 0.72rem; font-weight: 700; color: var(--accent);
  background: rgba(158,65,39,0.10); padding: 0.2rem 0.55rem;
  border-radius: 99px; text-transform: uppercase; letter-spacing: 0.04em;
  align-self: flex-start; }
.module-badge.coming { color: var(--warning); background: rgba(184,134,11,0.10); }
.module-card h3 { font-family: var(--font-serif); font-size: 1.25rem; color: var(--primary);
  font-weight: 600; letter-spacing: -0.01em; margin: 0.3rem 0 0.15rem 0; }
.module-desc { color: var(--text-muted); font-size: 0.93rem; flex: 1; line-height: 1.5; }
.module-cta { color: var(--accent); font-size: 0.9rem; font-weight: 600; margin-top: 0.6rem; }
.module-cta::after { content: ' →'; }
.module-card.disabled .module-cta { color: var(--text-muted); }
.module-card.disabled .module-cta::after { content: ''; }

/* ─── FAQ ─── */
details { background: var(--bg-white); border: 1px solid var(--border);
  border-radius: 0.5rem; padding: 0; margin-bottom: 0.5rem; overflow: hidden; }
details summary { cursor: pointer; padding: 0.85rem 1.1rem;
  font-weight: 600; color: var(--primary); list-style: none; }
details summary::-webkit-details-marker { display: none; }
details summary::after { content: '+'; float: right; font-size: 1.2rem;
  color: var(--text-muted); font-weight: 300; }
details[open] summary::after { content: '−'; }
details[open] summary { border-bottom: 1px solid var(--border); background: #faf6f0; }
.faq-content { padding: 1rem 1.1rem; color: var(--text); font-size: 0.95rem; }
.faq-content p { margin-bottom: 0.5rem; }

/* ─── Code-Blöcke ─── */
code { background: #f7f3ed; padding: 2px 6px; border-radius: 3px;
  font-family: var(--font-mono); font-size: 0.85rem; color: var(--text); }
pre { background: #1c1c18; color: #fdf9f3; padding: 1rem 1.2rem;
  border-radius: 0.5rem; overflow-x: auto; margin: 0.5rem 0 1rem 0;
  font-family: var(--font-mono); font-size: 0.85rem; line-height: 1.5; }
pre code { background: transparent; padding: 0; color: inherit; }

/* ─── Legal Footer ─── */
.legal { font-size: 0.9rem; color: var(--text-muted); background: #f7f3ed;
  border-radius: var(--radius); padding: 1.2rem 1.4rem; margin-top: 3rem;
  border-left: 3px solid var(--accent); line-height: 1.5; }
.legal strong { color: var(--text); }
.legal a { color: var(--accent); font-weight: 600; text-decoration: underline; }
</style>
</head>
<body>

<?php $current_section = 'gobd'; require __DIR__ . '/../_nav.php'; ?>

<main>

  <h1>GoBD-konforme Archivierung mit NexaSign</h1>
  <p class="lead">
    Unterschriebene Verträge sind <strong>steuerrelevante Belege</strong> — das Finanzamt darf sie bis zu
    10 Jahre später prüfen. Hier finden Sie alle Bausteine, die NexaSign für eine
    <strong>GoBD-orientierte Archivierung</strong> mitbringt: Erklärungen, Vorlagen, Tools, FAQ.
  </p>

  <!-- ═══════════════ Module ═══════════════ -->
  <h2>Bausteine</h2>
  <div class="modules">

    <a class="module-card" href="#was-ist-gobd">
      <span class="module-badge">Wissen</span>
      <h3>Was ist GoBD?</h3>
      <div class="module-desc">Einstieg für Nicht-Fachleute — was bedeutet GoBD, wen betrifft es, welche Fristen gelten.</div>
      <div class="module-cta">Zum Abschnitt</div>
    </a>

    <a class="module-card" href="#verantwortung">
      <span class="module-badge">Verantwortung</span>
      <h3>NexaSign vs. Sie</h3>
      <div class="module-desc">Klare Aufteilung: was deckt NexaSign technisch ab, was müssen Sie organisatorisch selbst regeln.</div>
      <div class="module-cta">Verantwortungs-Split</div>
    </a>

    <a class="module-card" href="/vorlagen/download/11-verfahrensdokumentation-gobd.md">
      <span class="module-badge">Download</span>
      <h3>Verfahrensdokumentation</h3>
      <div class="module-desc">GoBD-Pflichtdokument. Vorlage mit Platzhaltern — Steuerberater gegenprüfen lassen, dann ablegen.</div>
      <div class="module-cta">Vorlage laden</div>
    </a>

    <a class="module-card" href="#export-tool">
      <span class="module-badge">Tool</span>
      <h3>Export-CLI</h3>
      <div class="module-desc">Exportiert signierte Envelopes und das Audit-Log als ZIP-Paket für Z2-/Z3-Prüfzugriff.</div>
      <div class="module-cta">Nutzung</div>
    </a>

    <a class="module-card" href="#zugriffsarten">
      <span class="module-badge">Prüfung</span>
      <h3>Finanzamt-Zugriffsarten</h3>
      <div class="module-desc">Z1, Z2, Z3 — was bedeuten die Zugriffs-Szenarien und was liefert NexaSign dafür.</div>
      <div class="module-cta">Erklärung</div>
    </a>

    <div class="module-card disabled" title="In Entwicklung">
      <span class="module-badge coming">Geplant</span>
      <h3>WORM-Enforcement in der App</h3>
      <div class="module-desc">Automatische Lösch-Sperre in der UI für signierte Envelopes — folgt in Phase 2.</div>
      <div class="module-cta">In Entwicklung</div>
    </div>

    <div class="module-card disabled" title="In Entwicklung">
      <span class="module-badge coming">Geplant</span>
      <h3>Retention-Cron (10 Jahre)</h3>
      <div class="module-desc">Automatische Fristenkontrolle: keine Dokumente vor Ablauf der 10-Jahres-Pflicht löschen.</div>
      <div class="module-cta">In Entwicklung</div>
    </div>

    <div class="module-card disabled" title="In Entwicklung">
      <span class="module-badge coming">Geplant</span>
      <h3>SHA-256-Manifest</h3>
      <div class="module-desc">Integritätsnachweis für jeden Export: unveränderte Hashes der Originale.</div>
      <div class="module-cta">In Entwicklung</div>
    </div>

  </div>

  <!-- ═══════════════ Was ist GoBD ═══════════════ -->
  <h2 id="was-ist-gobd">Was ist GoBD überhaupt?</h2>
  <p>
    GoBD steht für <strong>„Grundsätze zur ordnungsmäßigen Führung und Aufbewahrung von Büchern,
    Aufzeichnungen und Unterlagen in elektronischer Form sowie zum Datenzugriff"</strong> — ein
    BMF-Schreiben aus dem Jahr 2019, das für alle deutschen Unternehmen verbindlich ist, die
    Bücher führen.
  </p>
  <p>
    Kern: Wenn Sie <strong>steuerrelevante Dokumente</strong> (Rechnungen, Verträge, Handelsbriefe)
    digital erzeugen oder ablegen, müssen sie <strong>10 Jahre unveränderbar</strong> aufbewahrt
    und im Prüfungsfall dem Finanzamt zugänglich gemacht werden. Unterschriebene Verträge aus
    NexaSign fallen eindeutig unter diese Pflicht.
  </p>

  <!-- ═══════════════ Verantwortung ═══════════════ -->
  <h2 id="verantwortung">Die Verantwortungs-Teilung</h2>
  <p>
    GoBD-Konformität ist <strong>nie</strong> die Leistung eines einzelnen Tools. Sie entsteht aus
    dem Zusammenspiel von drei Elementen:
  </p>

  <div class="split">
    <div class="box ok">
      <h3><span class="icon">✅</span> Was NexaSign liefert</h3>
      <ul>
        <li><strong>Unveränderbare Ablage</strong> signierter PDFs mit kryptografischem Hash</li>
        <li><strong>Append-Only Audit-Log</strong> — wer, was, wann, bei welchem Envelope</li>
        <li><strong>Export-CLI</strong> <code>nexasign-gobd-export</code> für Z2/Z3-Prüfzugriff</li>
        <li><strong>Verfahrensdokumentations-Vorlage</strong> zum Anpassen und Freigeben</li>
        <li><strong>Rollen-/Rechte-Management</strong> (z. B. Nur-Lese-Konto für Steuerberater)</li>
        <li><strong>TLS + DB-Verschlüsselung</strong> im Ruhezustand</li>
      </ul>
    </div>
    <div class="box user">
      <h3><span class="icon">👤</span> Was Sie selbst regeln</h3>
      <ul>
        <li><strong>Verfahrensdokumentation</strong> schreiben, pflegen, freigeben lassen</li>
        <li><strong>Datensicherung</strong> (Backups, Off-Site-Kopien, Wiederherstellungstests)</li>
        <li><strong>Zugriffsrechte</strong> sauber nach Need-to-know vergeben</li>
        <li><strong>Personalwechsel-Prozesse</strong> (Handover, Rechte-Entzug)</li>
        <li><strong>Jährliche Integritätskontrollen</strong> (Hash-Vergleich, Test-Export)</li>
        <li><strong>Optional:</strong> Wirtschaftsprüfer-Testat nach IDW PS 880 / IDW 951</li>
      </ul>
    </div>
  </div>

  <!-- ═══════════════ Zugriffsarten ═══════════════ -->
  <h2 id="zugriffsarten">Finanzamt-Zugriff: Z1, Z2, Z3</h2>
  <p>
    Nach § 147 Abs. 6 AO kann das Finanzamt drei Arten von Datenzugriff fordern:
  </p>
  <ul>
    <li><strong>Z1 — unmittelbarer Zugriff:</strong> Der/Die Prüfer/in loggt sich mit einem Nur-Lese-Konto direkt in die NexaSign-Instanz ein und sichtet Dokumente online.</li>
    <li><strong>Z2 — mittelbarer Zugriff:</strong> Sie exportieren die angeforderten Dokumente in einem strukturierten Format; der/die Prüfer/in bekommt das Ergebnis.</li>
    <li><strong>Z3 — Datenträgerüberlassung:</strong> Das Export-Paket wird auf einem verschlüsselten USB-Medium übergeben.</li>
  </ul>
  <p>
    <strong>Für Z2 und Z3</strong> liefert NexaSign das CLI-Tool <code>nexasign-gobd-export</code> — siehe nächster Abschnitt.
  </p>

  <!-- ═══════════════ Export-Tool ═══════════════ -->
  <h2 id="export-tool">Export-CLI — <code>nexasign-gobd-export</code></h2>
  <p>
    Kommandozeilen-Tool für den System-Administrator. Exportiert alle abgeschlossen signierten
    Envelopes und das Audit-Log eines Zeitraums als strukturiertes Paket.
  </p>

  <h3>Nutzung</h3>
  <pre><code>sudo nexasign-gobd-export &lt;VON&gt; &lt;BIS&gt; &lt;ZIEL-VERZEICHNIS&gt;

# Beispiel — kompletter Zeitraum 2026:
sudo nexasign-gobd-export 2026-01-01 2026-12-31 /tmp/gobd-2026</code></pre>

  <h3>Inhalt des Export-Pakets</h3>
  <ul>
    <li><code>envelopes.csv</code> — Metadaten aller signierten Envelopes (ID, Titel, Status, Zeitstempel)</li>
    <li><code>audit-log.csv</code> — Vollständiger Audit-Trail im Zeitraum</li>
    <li><code>README.md</code> — Beschreibung des Pakets und rechtlicher Kontext</li>
    <li><code>nexasign-gobd-export_VON_BIS.zip</code> — alles zusammengefasst</li>
  </ul>

  <p style="font-size:0.9rem;color:var(--text-muted);">
    <em>Aktueller Stand (Phase 1): Metadaten- und Audit-Export. PDF-Binary-Export aus der
    <code>DocumentData</code>-Tabelle und SHA-256-Manifest folgen in Phase 2.</em>
  </p>

  <!-- ═══════════════ FAQ ═══════════════ -->
  <h2 id="faq">Fachbegriffe &amp; FAQ</h2>

  <details>
    <summary>Was ist WORM?</summary>
    <div class="faq-content">
      <p><strong>„Write Once Read Many"</strong> — Einmal geschriebene Dokumente können gelesen,
      aber nicht mehr geändert oder gelöscht werden (innerhalb der Aufbewahrungsfrist).
      Das ist das technische Fundament für Unveränderbarkeit nach § 146 Abs. 4 AO.</p>
    </div>
  </details>

  <details>
    <summary>Was ist ein SHA-256-Hash?</summary>
    <div class="faq-content">
      <p>Ein <strong>digitaler Fingerabdruck</strong> eines Dokuments — eine 64-stellige
      hexadezimale Zeichenkette, die eindeutig ist. Ändert sich auch nur ein Byte am Dokument,
      passt der Hash nicht mehr. Damit wird Unverändertheit mathematisch nachweisbar.</p>
    </div>
  </details>

  <details>
    <summary>Was ist ein Audit-Log?</summary>
    <div class="faq-content">
      <p>Ein Protokoll aller Ereignisse eines Dokuments: wer hat es erstellt, wer
      geöffnet, wer signiert, wann heruntergeladen. <em>Append-Only</em> heißt: Einträge
      können nur hinzugefügt werden, nicht gelöscht oder verändert.</p>
    </div>
  </details>

  <details>
    <summary>Was bedeutet IDW PS 880 / IDW 951?</summary>
    <div class="faq-content">
      <p><strong>Prüfungsstandards des Instituts der Wirtschaftsprüfer</strong> für IT-Systeme
      (PS 880) bzw. Dienstleister (PS 951). Darauf basieren formale
      „revisionssicher"-Testate. Eine solche Prüfung kostet typischerweise einen
      fünfstelligen Betrag und ist nur dann sinnvoll, wenn Sie das Testat gegenüber
      Kunden oder Aufsichtsbehörden formal nachweisen müssen.</p>
    </div>
  </details>

  <details>
    <summary>Muss ich den Steuerberater einbeziehen?</summary>
    <div class="faq-content">
      <p>Ja — spätestens bei der <strong>Verfahrensdokumentation</strong> und der jährlichen
      Integritätskontrolle. Die GoBD sind steuerliches Recht, und ein formal sauberes
      Setup ist Aufgabe von Buchhaltung und Steuerberatung. NexaSign liefert die Technik,
      Sie liefern die Prozess-Freigaben.</p>
    </div>
  </details>

  <details>
    <summary>Darf NexaSign selbst sich „GoBD-konform" nennen?</summary>
    <div class="faq-content">
      <p>Nein. NexaSign ist <strong>„GoBD-ready"</strong>: die technischen Funktionen sind da.
      „GoBD-konform" im juristischen Sinn wird erst Ihre konkrete Implementierung
      (Technik + Organisation + Verfahrensdokumentation). Für ein formales Testat wäre ein
      Wirtschaftsprüfer einzubeziehen.</p>
    </div>
  </details>

  <!-- ═══════════════ Legal ═══════════════ -->
  <div class="legal">
    <strong>⚖️ Rechtlicher Hinweis</strong><br>
    NexaSign stellt <strong>GoBD-orientierte Archivfunktionen</strong> zur Verfügung. Die
    GoBD-konforme Gesamtimplementierung (Technik + Organisation + Verfahrensdokumentation) in
    Ihrem Unternehmen verantworten Sie selbst. Diese Seite dient der Orientierung und ersetzt
    keine Rechts-, Steuer- oder Konformitäts-Beratung. Wir empfehlen die Abstimmung mit
    Ihrer/m Steuerberater/in, Datenschutzbeauftragten und — für formale Zertifizierungen —
    mit einer/m Wirtschaftsprüfer/in. <br><br>
    NexaSign ist Open-Source (AGPL-3.0, basiert auf NexaSign). Die Bereitstellung erfolgt
    ohne Gewährleistung.
  </div>

</main>
<?php require __DIR__ . "/../_footer.php"; ?>
</body>
</html>
