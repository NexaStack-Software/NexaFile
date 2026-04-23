<?php
// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors. Based on NexaSign (AGPL-3.0).
/**
 * HTML-Template für den AV-Vertrag — wird von WeasyPrint in PDF gerendert.
 * Erwartet Variable $d (array mit 14+ Keys aus dem Form-POST).
 * Alle Ausgaben durch h() escapen, nl2br für Mehrzeilen-Felder.
 */
declare(strict_types=1);
// h() wird aus index.php übernommen; hm() ergänzen, falls nicht vorhanden
if (!function_exists('h')) {
    function h(?string $v): string { return htmlspecialchars((string)$v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
}
if (!function_exists('hm')) {
    function hm(?string $v): string { return nl2br(h((string)$v)); }
}

$subs_list = array_filter(array_map('trim', explode("\n", (string)($d['unterauftragsverarbeiter_liste'] ?? ''))));
?><!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>AV-Vertrag — <?= h($d['verantwortlicher_name']) ?> × <?= h($d['auftragsverarbeiter_name']) ?></title>
<style>
  @page {
    size: A4;
    margin: 24mm 20mm 26mm 20mm;
    @bottom-left {
      content: "Erstellt mit NexaSign · nexasign.nexastack.co";
      font-size: 8pt; color: #6b6b63;
      font-family: 'Plus Jakarta Sans', sans-serif;
    }
    @bottom-right {
      content: "Seite " counter(page) " von " counter(pages);
      font-size: 8pt; color: #6b6b63;
      font-family: 'Plus Jakarta Sans', sans-serif;
    }
  }
  * { box-sizing: border-box; }
  body {
    font-family: 'Plus Jakarta Sans', Helvetica, Arial, sans-serif;
    font-size: 10.5pt; line-height: 1.5; color: #1c1c18; margin: 0;
  }
  h1 {
    font-family: 'Newsreader', Georgia, serif;
    font-size: 24pt; line-height: 1.1; color: #140100;
    letter-spacing: -0.02em; margin: 0 0 4pt 0; font-weight: 600;
  }
  h1 + .subtitle {
    color: #6b6b63; font-size: 11pt; margin-bottom: 18pt;
  }
  h2 {
    font-family: 'Newsreader', Georgia, serif;
    font-size: 15pt; line-height: 1.2; color: #140100;
    margin: 20pt 0 6pt 0; font-weight: 600;
    border-bottom: 1px solid #e6e2dc; padding-bottom: 4pt;
  }
  h3 {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 11pt; color: #140100; margin: 12pt 0 4pt 0; font-weight: 700;
  }
  p { margin: 0 0 8pt 0; }
  .cover {
    text-align: center;
    padding-top: 20pt;
    border-bottom: 2px solid #9e4127;
    margin-bottom: 24pt;
    padding-bottom: 18pt;
  }
  .logo {
    display: inline-flex; align-items: center; gap: 8pt;
    color: #140100; font-weight: 700; font-size: 12pt;
    margin-bottom: 12pt;
  }
  .logo-box {
    background: #140100; color: #fdf9f3;
    width: 22pt; height: 22pt; border-radius: 4pt;
    display: inline-flex; align-items: center; justify-content: center;
    font-family: 'Newsreader', serif; font-weight: 600; font-size: 14pt;
  }
  .parties {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14pt;
    margin: 14pt 0 22pt 0;
  }
  .party {
    background: #ffffff;
    border: 1px solid #e6e2dc;
    border-radius: 6pt;
    padding: 10pt 12pt;
  }
  .party .label {
    font-size: 8.5pt; color: #6b6b63;
    text-transform: uppercase; letter-spacing: 0.05em;
    font-weight: 600; margin-bottom: 4pt;
  }
  .party .name {
    font-weight: 700; color: #140100; font-size: 11pt; margin-bottom: 2pt;
  }
  .party .line { color: #44474d; font-size: 10pt; }
  .paragraph { margin: 14pt 0; }
  .paragraph > .number {
    color: #9e4127; font-weight: 700; font-size: 11pt;
    margin-right: 4pt;
  }
  ol.sub { margin: 6pt 0 10pt 20pt; padding: 0; }
  ol.sub li { margin: 4pt 0; }
  table.data {
    width: 100%; border-collapse: collapse;
    margin: 8pt 0 14pt 0; font-size: 10pt;
  }
  table.data th, table.data td {
    border: 1px solid #d0d0cd; padding: 6pt 8pt; text-align: left;
    vertical-align: top;
  }
  table.data th {
    background: #f7f3ed; font-weight: 600; width: 35%; color: #44474d;
  }
  .signatures {
    display: grid; grid-template-columns: 1fr 1fr; gap: 30pt;
    margin: 40pt 0 0 0;
  }
  .sig-box { border-top: 1px solid #1c1c18; padding-top: 6pt; }
  .sig-box .label { font-size: 8.5pt; color: #6b6b63; text-transform: uppercase; letter-spacing: 0.05em; }
  .sig-box .name { font-weight: 600; color: #140100; margin-top: 2pt; }
  .annex {
    page-break-before: always;
  }
  .annex h1 {
    font-size: 18pt;
  }
  ul.toms { margin: 6pt 0 8pt 18pt; padding: 0; }
  ul.toms li { margin: 3pt 0; }
  .disclaimer {
    page-break-before: always;
    background: #fff8e6; border-left: 3pt solid #b8860b;
    padding: 12pt 16pt; border-radius: 4pt;
    font-size: 9.5pt; color: #1c1c18; margin-top: 20pt;
  }
  .disclaimer strong { color: #140100; }
  .footer-note {
    font-size: 9pt; color: #6b6b63; margin-top: 20pt;
    padding-top: 10pt; border-top: 1px solid #e6e2dc;
  }
</style>
</head>
<body>

<!-- ───────────── DECKBLATT / KOPFBEREICH ───────────── -->
<div class="cover">
  <div class="logo">
    <span class="logo-box">N</span>
    <span>NexaSign · Vorlage</span>
  </div>
  <h1>Vertrag über die Verarbeitung im Auftrag</h1>
  <div class="subtitle">nach Art. 28 Verordnung (EU) 2016/679 (DSGVO)</div>
</div>

<!-- ───────────── PARTEIEN ───────────── -->
<h2>Parteien</h2>
<div class="parties">
  <div class="party">
    <div class="label">Verantwortlicher</div>
    <div class="name"><?= h($d['verantwortlicher_name']) ?></div>
    <div class="line"><?= hm($d['verantwortlicher_anschrift']) ?></div>
    <div class="line" style="margin-top:4pt;"><em>vertreten durch <?= h($d['verantwortlicher_vertreter']) ?></em></div>
  </div>
  <div class="party">
    <div class="label">Auftragsverarbeiter</div>
    <div class="name"><?= h($d['auftragsverarbeiter_name']) ?></div>
    <div class="line"><?= hm($d['auftragsverarbeiter_anschrift']) ?></div>
    <div class="line" style="margin-top:4pt;"><em>vertreten durch <?= h($d['auftragsverarbeiter_vertreter']) ?></em></div>
  </div>
</div>

<!-- ───────────── § 1 ───────────── -->
<h2>§ 1 Gegenstand und Dauer der Verarbeitung</h2>
<p><span class="number">(1)</span> Gegenstand dieses Vertrages ist die Verarbeitung personenbezogener Daten durch den Auftragsverarbeiter im Auftrag des Verantwortlichen im Rahmen des folgenden Hauptvertrages:</p>
<p style="background:#f7f3ed;padding:8pt 12pt;border-radius:4pt;font-style:italic;"><?= hm($d['vertragsgegenstand']) ?></p>
<p><span class="number">(2)</span> Die Dauer dieses Vertrages richtet sich nach der Laufzeit des Hauptvertrages: <strong><?= h($d['vertragsdauer']) ?></strong></p>
<p><span class="number">(3)</span> Eine genauere Beschreibung der Verarbeitung (Art, Zweck, Datenkategorien, Betroffenenkreis) ergibt sich aus <strong>Anlage 1</strong>.</p>

<!-- ───────────── § 2 ───────────── -->
<h2>§ 2 Weisungsbefugnis des Verantwortlichen</h2>
<p><span class="number">(1)</span> Der Auftragsverarbeiter verarbeitet personenbezogene Daten ausschließlich auf <strong>dokumentierte Weisung</strong> des Verantwortlichen. Dies gilt auch für Datenübermittlungen in ein Drittland oder an eine internationale Organisation, sofern der Auftragsverarbeiter nicht durch Rechtsvorschriften zur Übermittlung verpflichtet ist.</p>
<p><span class="number">(2)</span> Weisungen werden schriftlich oder in Textform (z. B. per E-Mail) erteilt. Mündliche Weisungen sind unverzüglich in Textform zu bestätigen.</p>
<p><span class="number">(3)</span> Der Auftragsverarbeiter informiert den Verantwortlichen unverzüglich, falls er der Auffassung ist, dass eine Weisung gegen geltendes Datenschutzrecht verstößt. Er ist berechtigt, die Durchführung einer solchen Weisung bis zur Bestätigung oder Änderung durch den Verantwortlichen auszusetzen.</p>

<!-- ───────────── § 3 ───────────── -->
<h2>§ 3 Pflichten des Auftragsverarbeiters</h2>
<p><span class="number">(1)</span> Der Auftragsverarbeiter gewährleistet, dass die zur Verarbeitung eingesetzten Personen zur <strong>Vertraulichkeit</strong> verpflichtet sind oder einer angemessenen gesetzlichen Verschwiegenheitspflicht unterliegen.</p>
<p><span class="number">(2)</span> Der Auftragsverarbeiter trifft alle gemäß Art. 32 DSGVO erforderlichen <strong>technischen und organisatorischen Maßnahmen</strong> (TOM) gemäß <strong>Anlage 2</strong>.</p>
<p><span class="number">(3)</span> Der Auftragsverarbeiter unterstützt den Verantwortlichen mit geeigneten TOMs, soweit möglich, bei der Erfüllung seiner Pflichten hinsichtlich der Rechte betroffener Personen (Art. 12–22 DSGVO).</p>
<p><span class="number">(4)</span> Der Auftragsverarbeiter unterstützt den Verantwortlichen bei der Einhaltung der Pflichten aus Art. 32–36 DSGVO (Datensicherheit, Meldung von Datenschutzverletzungen, Datenschutz-Folgenabschätzung, Konsultation der Aufsichtsbehörde).</p>
<p><span class="number">(5)</span> Der Auftragsverarbeiter meldet Verletzungen des Schutzes personenbezogener Daten dem Verantwortlichen <strong>unverzüglich, spätestens binnen 24 Stunden</strong> nach Kenntniserlangung. Die Meldung muss die in Art. 33 Abs. 3 DSGVO genannten Informationen enthalten, soweit sie verfügbar sind.</p>
<p><span class="number">(6)</span> Nach Abschluss der Erbringung der Leistungen <strong>löscht</strong> der Auftragsverarbeiter alle personenbezogenen Daten oder gibt sie nach Wahl des Verantwortlichen zurück, sofern keine gesetzliche Pflicht zur Speicherung besteht.</p>

<!-- ───────────── § 4 ───────────── -->
<h2>§ 4 Unterauftragsverarbeiter</h2>
<p><span class="number">(1)</span> Der Auftragsverarbeiter darf weitere Unterauftragsverarbeiter nur mit <strong>vorheriger schriftlicher</strong> oder in Textform vorliegender Genehmigung des Verantwortlichen einsetzen.</p>
<p><span class="number">(2)</span> Bereits genehmigte Unterauftragsverarbeiter sind in <strong>Anlage 3</strong> aufgeführt. Änderungen sind dem Verantwortlichen mit einer Frist von mindestens 30 Tagen vorab mitzuteilen; dieser kann binnen 14 Tagen widersprechen.</p>
<p><span class="number">(3)</span> Der Auftragsverarbeiter schließt mit jedem Unterauftragsverarbeiter einen Vertrag, der <strong>inhaltlich diesem Vertrag entspricht</strong>, insbesondere hinsichtlich technischer und organisatorischer Maßnahmen.</p>

<!-- ───────────── § 5 ───────────── -->
<h2>§ 5 Nachweispflicht und Kontrolle</h2>
<p><span class="number">(1)</span> Der Auftragsverarbeiter stellt dem Verantwortlichen alle erforderlichen Informationen zum Nachweis der Einhaltung der in Art. 28 DSGVO niedergelegten Pflichten zur Verfügung.</p>
<p><span class="number">(2)</span> Der Verantwortliche ist berechtigt, <strong>Kontrollen</strong> der technischen und organisatorischen Maßnahmen durchzuführen — entweder selbst, durch einen sachkundigen Prüfer seiner Wahl oder durch Einsichtnahme in anerkannte Zertifikate (z. B. ISO 27001, BSI C5, SOC 2).</p>
<p><span class="number">(3)</span> Kontrollen erfolgen nach angemessener Vorankündigung während üblicher Geschäftszeiten und unter Wahrung der Betriebsgeheimnisse des Auftragsverarbeiters.</p>

<!-- ───────────── § 6 ───────────── -->
<h2>§ 6 Datenübermittlung in Drittländer</h2>
<p><span class="number">(1)</span> Eine Übermittlung personenbezogener Daten in ein Drittland erfolgt nur, wenn die besonderen Voraussetzungen der Art. 44 ff. DSGVO erfüllt sind (z. B. Angemessenheitsbeschluss, Standardvertragsklauseln, Binding Corporate Rules).</p>
<p><span class="number">(2)</span> Der Auftragsverarbeiter informiert den Verantwortlichen unverzüglich über geplante Drittlandübermittlungen und stellt den Nachweis der zugrundeliegenden Rechtsgrundlage.</p>

<!-- ───────────── § 7 ───────────── -->
<h2>§ 7 Haftung</h2>
<p>Die Haftung der Parteien richtet sich nach Art. 82 DSGVO und den Bestimmungen des Hauptvertrages.</p>

<!-- ───────────── § 8 ───────────── -->
<h2>§ 8 Schlussbestimmungen</h2>
<p><span class="number">(1)</span> Änderungen und Ergänzungen dieses Vertrages bedürfen der Textform.</p>
<p><span class="number">(2)</span> Bei Widersprüchen zwischen diesem Vertrag und dem Hauptvertrag gehen die Regelungen dieses Vertrages vor, soweit sie datenschutzrechtliche Fragen betreffen.</p>
<p><span class="number">(3)</span> Sollten einzelne Bestimmungen dieses Vertrages unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.</p>
<p><span class="number">(4)</span> Gerichtsstand ist <strong><?= h($d['ort_sitz']) ?></strong>, soweit gesetzlich zulässig.</p>

<!-- ───────────── UNTERSCHRIFTEN ───────────── -->
<div style="margin-top:32pt;">
  <p style="text-align:right;"><?= h($d['ort_sitz']) ?>, <?= h($d['datum']) ?></p>
  <div class="signatures">
    <div class="sig-box">
      <div class="label">Für den Verantwortlichen</div>
      <div class="name"><?= h($d['verantwortlicher_vertreter']) ?></div>
      <div style="font-size:9pt;color:#6b6b63;">(<?= h($d['verantwortlicher_name']) ?>)</div>
    </div>
    <div class="sig-box">
      <div class="label">Für den Auftragsverarbeiter</div>
      <div class="name"><?= h($d['auftragsverarbeiter_vertreter']) ?></div>
      <div style="font-size:9pt;color:#6b6b63;">(<?= h($d['auftragsverarbeiter_name']) ?>)</div>
    </div>
  </div>
</div>

<!-- ───────────── ANLAGE 1 ───────────── -->
<div class="annex">
<h1>Anlage 1 — Beschreibung der Verarbeitung</h1>
<table class="data">
  <tr><th>Zweck der Verarbeitung</th><td><?= hm($d['zweck_der_verarbeitung']) ?></td></tr>
  <tr><th>Art der Verarbeitung</th><td>Erheben, Speichern, Auslesen, Verändern, Übermitteln, Sperren, Löschen (je nach Leistung zutreffend)</td></tr>
  <tr><th>Kategorien personenbezogener Daten</th><td><?= hm($d['datenkategorien']) ?></td></tr>
  <tr><th>Kategorien betroffener Personen</th><td><?= hm($d['betroffenenkreis']) ?></td></tr>
  <tr><th>Speicherdauer</th><td>Gemäß Hauptvertrag bzw. gesetzlichen Aufbewahrungspflichten</td></tr>
</table>
</div>

<!-- ───────────── ANLAGE 2 ───────────── -->
<div class="annex">
<h1>Anlage 2 — Technische und organisatorische Maßnahmen (TOM)</h1>
<p>Gemäß Art. 32 DSGVO trifft der Auftragsverarbeiter folgende Maßnahmen. Die Liste bildet den Standard ab; konkrete Umsetzungen sind auf Anfrage dokumentiert abrufbar.</p>

<h2 style="border-bottom:0;">1. Vertraulichkeit</h2>
<h3>1.1 Zutrittskontrolle</h3>
<ul class="toms">
  <li>Gesicherter Zugang zu Server-Räumen / Rechenzentren (Chip-Karten, Protokollierung)</li>
  <li>Besucher-Regelung mit Begleitung und Protokoll</li>
</ul>
<h3>1.2 Zugangskontrolle</h3>
<ul class="toms">
  <li>Passwortrichtlinie mit Mindestlänge und Komplexität</li>
  <li>Zwei-Faktor-Authentisierung für administrative Zugänge</li>
  <li>Automatische Sperrung bei mehreren Fehlversuchen</li>
</ul>
<h3>1.3 Zugriffskontrolle</h3>
<ul class="toms">
  <li>Rollen- und Berechtigungskonzept</li>
  <li>Protokollierung administrativer Zugriffe</li>
  <li>Prinzip der minimalen Rechte („Need-to-Know")</li>
</ul>
<h3>1.4 Trennungskontrolle</h3>
<ul class="toms">
  <li>Logische Trennung von Produktivdaten und Testdaten</li>
  <li>Mandantenfähige Systeme mit Tenant-Isolation</li>
</ul>
<h3>1.5 Pseudonymisierung und Verschlüsselung</h3>
<ul class="toms">
  <li>Verschlüsselung bei Übertragung (TLS 1.2 oder neuer)</li>
  <li>Verschlüsselung bei Speicherung (Disk- oder Datenbank-Verschlüsselung)</li>
  <li>Pseudonymisierung wo technisch sinnvoll umsetzbar</li>
</ul>

<h2 style="border-bottom:0;">2. Integrität</h2>
<h3>2.1 Weitergabekontrolle</h3>
<ul class="toms">
  <li>Schutz beim Transport (TLS, VPN)</li>
  <li>Dokumentation aller Datenweitergaben</li>
</ul>
<h3>2.2 Eingabekontrolle</h3>
<ul class="toms">
  <li>Audit-Logs für Änderungen und Löschungen</li>
  <li>Revisionssichere Aufbewahrung von Logs</li>
</ul>

<h2 style="border-bottom:0;">3. Verfügbarkeit und Belastbarkeit</h2>
<ul class="toms">
  <li>Regelmäßige Backups mit verschlüsselter Ablage</li>
  <li>Dokumentiertes Wiederherstellungs­konzept (RTO/RPO je nach SLA)</li>
  <li>Redundante Systemkomponenten</li>
  <li>DDoS-Schutz, Firewall, Intrusion-Detection</li>
</ul>

<h2 style="border-bottom:0;">4. Verfahren zur regelmäßigen Überprüfung</h2>
<ul class="toms">
  <li>Interne Überprüfung durch den Datenschutzbeauftragten</li>
  <li>Regelmäßige Penetrationstests bei kritischen Komponenten</li>
  <li>Dokumentierter Vorfall-Reaktionsplan (Incident Response)</li>
  <li>Sicherheitsrelevante Updates zeitnah eingespielt</li>
</ul>
</div>

<!-- ───────────── ANLAGE 3 ───────────── -->
<div class="annex">
<h1>Anlage 3 — Genehmigte Unterauftragsverarbeiter</h1>
<?php if (!empty($subs_list)): ?>
<table class="data">
  <thead>
    <tr><th style="width:8%;">#</th><th style="width:46%;">Unternehmen / Leistung</th><th style="width:46%;">Sitz</th></tr>
  </thead>
  <tbody>
  <?php foreach ($subs_list as $i => $entry): ?>
    <tr>
      <td><?= $i + 1 ?></td>
      <td colspan="2"><?= h($entry) ?></td>
    </tr>
  <?php endforeach; ?>
  </tbody>
</table>
<?php else: ?>
<p><em>Zum Zeitpunkt des Vertragsschlusses werden keine Unterauftragsverarbeiter eingesetzt.
Spätere Änderungen siehe § 4.</em></p>
<?php endif; ?>
</div>

<!-- ───────────── RECHTLICHER HINWEIS ───────────── -->
<div class="disclaimer">
<strong>⚖️ Rechtlicher Hinweis</strong><br><br>
Dieses Muster orientiert sich an Art. 28 DSGVO und gängigen Empfehlungen der
Datenschutz-Aufsichtsbehörden (u. a. BfDI, GDD, DSK-Kurzpapier Nr. 13). Es ist eine
<strong>Orientierungshilfe</strong> und ersetzt <strong>keine individuelle Rechtsberatung</strong>.
Vor dem produktiven Einsatz empfehlen wir die Prüfung durch Ihren Datenschutzbeauftragten
oder eine/n zugelassene/n Rechtsanwältin/Rechtsanwalt für IT-Recht/Datenschutz.<br><br>
Insbesondere zu prüfen:
<ul style="margin:6pt 0 0 18pt;">
<li>Sind die TOMs in Anlage 2 an Ihre tatsächlichen technischen Umsetzungen angepasst?</li>
<li>Sind alle tatsächlich eingesetzten Unterauftragsverarbeiter in Anlage 3 aufgeführt?</li>
<li>Passt der Gerichtsstand (§ 8 Abs. 4) zu Ihrer Vertragslage?</li>
<li>Ist eine Drittlandübermittlung (§ 6) beabsichtigt und rechtlich abgesichert?</li>
</ul>
<br>
Bereitgestellt als Open-Source-Vorlage durch <strong>NexaSign</strong> (NexaStack) —
CC-BY 4.0. Frei verwendbar mit Quellenangabe.
</div>

</body>
</html>
