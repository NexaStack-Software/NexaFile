<?php
// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors. Based on NexaSign (AGPL-3.0).
/**
 * Vorlagen-Übersicht für NexaSign.
 * Zeigt alle 10 Vertragsvorlagen als Kacheln.
 * AV-Vertrag hat einen Generator; die übrigen 9 werden aktuell als Markdown
 * zum Download angeboten (PDF-Generatoren folgen).
 */
declare(strict_types=1);

function h(?string $v): string { return htmlspecialchars((string)$v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }

$vorlagen = [
  [
    'slug'  => 'av-vertrag',
    'badge' => 'Generator',
    'titel' => 'AV-Vertrag nach Art. 28 DSGVO',
    'desc'  => 'Auftragsverarbeitungs-Vertrag für jedes B2B-SaaS. 14 Felder ausfüllen, fertig unterschriftsreifes PDF mit TOM-Anhang und Unterauftragsverarbeiter-Liste.',
    'href'  => '/vorlagen/av-vertrag/',
    'cta'   => 'Generator starten',
  ],
  [
    'slug'  => 'x-rechnung',
    'badge' => 'Generator',
    'titel' => 'X-Rechnung / ZUGFeRD-Generator',
    'desc'  => 'E-Rechnungspflicht ab 2025: Ihr Rechnungs-PDF + Strukturdaten → PDF/A-3 mit eingebettetem EN 16931 XML (ZUGFeRD Comfort). B2B-pflichtkonform im Empfang beim Kunden.',
    'href'  => '/vorlagen/x-rechnung/',
    'cta'   => 'Generator starten',
  ],
  [
    'slug'  => 'nda-einseitig',
    'badge' => 'Markdown',
    'titel' => 'NDA — einseitig',
    'desc'  => 'Vertraulichkeitsvereinbarung, wenn nur eine Partei offenlegt (Bewerbungen, Partnergespräche).',
    'href'  => '/vorlagen/download/01-nda-einseitig.md',
    'cta'   => 'Markdown laden',
  ],
  [
    'slug'  => 'nda-gegenseitig',
    'badge' => 'Markdown',
    'titel' => 'NDA — gegenseitig',
    'desc'  => 'Wechselseitige Vertraulichkeit für echte B2B-Verhandlungen.',
    'href'  => '/vorlagen/download/02-nda-gegenseitig.md',
    'cta'   => 'Markdown laden',
  ],
  [
    'slug'  => 'freelancer-werkvertrag',
    'badge' => 'Markdown',
    'titel' => 'Freelancer- / Werkvertrag',
    'desc'  => 'Projektarbeit mit freien Mitarbeitenden — inkl. Nutzungsrechte und Abnahme.',
    'href'  => '/vorlagen/download/03-freelancer-werkvertrag.md',
    'cta'   => 'Markdown laden',
  ],
  [
    'slug'  => 'arbeitsvertrag-unbefristet',
    'badge' => 'Markdown',
    'titel' => 'Arbeitsvertrag — unbefristet',
    'desc'  => 'Festanstellung nach deutschem Arbeitsrecht. Nachweisgesetz-konform.',
    'href'  => '/vorlagen/download/04-arbeitsvertrag-unbefristet.md',
    'cta'   => 'Markdown laden',
  ],
  [
    'slug'  => 'arbeitsvertrag-befristet',
    'badge' => 'Markdown',
    'titel' => 'Arbeitsvertrag — befristet',
    'desc'  => 'Befristung nach TzBfG, mit oder ohne Sachgrund.',
    'href'  => '/vorlagen/download/05-arbeitsvertrag-befristet.md',
    'cta'   => 'Markdown laden',
  ],
  [
    'slug'  => 'beratungsvertrag',
    'badge' => 'Markdown',
    'titel' => 'Beratungsvertrag',
    'desc'  => 'Consulting, Coaching, Strategieberatung — inkl. Vergütung und Vertraulichkeit.',
    'href'  => '/vorlagen/download/07-beratungsvertrag.md',
    'cta'   => 'Markdown laden',
  ],
  [
    'slug'  => 'aufhebungsvertrag',
    'badge' => 'Markdown',
    'titel' => 'Aufhebungsvertrag',
    'desc'  => 'Einvernehmliche Beendigung eines Arbeitsverhältnisses inkl. Abfindungs-Platzhalter.',
    'href'  => '/vorlagen/download/08-aufhebungsvertrag.md',
    'cta'   => 'Markdown laden',
  ],
  [
    'slug'  => 'angebotsannahme',
    'badge' => 'Markdown',
    'titel' => 'Angebotsannahme / Auftragsbestätigung',
    'desc'  => 'Standard-Geschäftsabschluss nach BGB-Angebotsannahme.',
    'href'  => '/vorlagen/download/09-angebotsannahme.md',
    'cta'   => 'Markdown laden',
  ],
  [
    'slug'  => 'agb-zustimmung',
    'badge' => 'Markdown',
    'titel' => 'AGB-Zustimmung',
    'desc'  => 'Für Online-Registrierung oder Software-Rollout im Unternehmen.',
    'href'  => '/vorlagen/download/10-agb-zustimmung.md',
    'cta'   => 'Markdown laden',
  ],
];
?><!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Vorlagen — NexaSign</title>
<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;0,6..72,700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
:root {
  --primary:#140100; --accent:#9e4127; --accent-hover:#b84d2e;
  --bg:#fdf9f3; --bg-white:#ffffff; --text:#1c1c18; --text-muted:#6b6b63;
  --border:#e6e2dc; --radius:0.5rem;
  --font-serif:'Newsreader', Georgia, serif;
  --font-sans:'Plus Jakarta Sans', system-ui, sans-serif;
}
body { font-family: var(--font-sans); background: var(--bg); color: var(--text);
  min-height: 100vh; -webkit-font-smoothing: antialiased; line-height: 1.55; }
main { max-width: 1280px; margin: 2.5rem auto; padding: 0 2rem; }
h1 { font-family: var(--font-serif); font-size: clamp(2rem, 4vw, 3rem);
  line-height: 1.1; letter-spacing: -0.02em; color: var(--primary);
  margin-bottom: 0.6rem; font-weight: 600; }
.lead { font-size: 1.05rem; color: var(--text-muted); max-width: 760px; margin-bottom: 2.5rem; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.25rem; margin-bottom: 2.5rem; }
.card { background: var(--bg-white); border: 1.5px solid var(--border);
  border-radius: 0.75rem; padding: 1.5rem; display: flex; flex-direction: column;
  transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
  text-decoration: none; color: inherit; cursor: pointer; gap: 0.5rem;
  position: relative;
}
.card:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(0,0,0,0.06);
  border-color: var(--accent); }
.badge {
  position: absolute; top: 1rem; right: 1rem;
  background: rgba(158,65,39,0.10); color: var(--accent);
  font-size: 0.72rem; font-weight: 700; padding: 0.2rem 0.55rem;
  border-radius: 99px; text-transform: uppercase; letter-spacing: 0.04em;
}
.card.generator { border-color: var(--accent); }
.card.generator .badge {
  background: var(--accent); color: var(--bg);
}
.card-titel { font-family: var(--font-serif); font-size: 1.3rem;
  color: var(--primary); font-weight: 600; letter-spacing: -0.01em;
  margin: 0.2rem 0 0.25rem 0; max-width: calc(100% - 80px); }
.card-desc { color: var(--text-muted); font-size: 0.92rem; line-height: 1.5; flex: 1; }
.card-cta { color: var(--accent); font-size: 0.9rem; font-weight: 600;
  margin-top: 0.85rem; padding-top: 0.85rem; border-top: 1px solid var(--border); }
.card-cta::after { content: ' →'; transition: margin 0.15s; }
.card:hover .card-cta::after { margin-left: 0.3rem; }
.hint-box {
  background: #f7f3ed; border-left: 3px solid var(--accent); border-radius: 0.5rem;
  padding: 1rem 1.25rem; margin-top: 1.5rem; font-size: 0.92rem; color: var(--text);
  line-height: 1.55;
}
.hint-box strong { color: var(--primary); }
.hint-box a { color: var(--accent); font-weight: 600; text-decoration: underline; }
</style>
</head>
<body>

<?php $current_section = 'vorlagen'; require __DIR__ . '/_nav.php'; ?>

<main>

  <h1>Vertragsvorlagen für deutsche Unternehmen</h1>
  <p class="lead">
    10 pragmatische, rechtlich solide Vorlagen nach BGB / HGB / TzBfG / DSGVO.
    Alles als Markdown mit klaren Platzhaltern — direkt zur Nutzung in NexaSign oder
    im Texteditor Deiner Wahl. Der <strong>AV-Vertrag-Generator</strong> erzeugt
    zusätzlich ein fertiges PDF in unter einer Minute.
  </p>

  <div class="grid">
    <?php foreach ($vorlagen as $v): ?>
      <a href="<?= h($v['href']) ?>" class="card <?= $v['badge'] === 'Generator' ? 'generator' : '' ?>">
        <span class="badge"><?= h($v['badge']) ?></span>
        <div class="card-titel"><?= h($v['titel']) ?></div>
        <div class="card-desc"><?= h($v['desc']) ?></div>
        <div class="card-cta"><?= h($v['cta']) ?></div>
      </a>
    <?php endforeach; ?>
  </div>

  <div class="hint-box">
    <strong>⚖️ Rechtlicher Hinweis</strong><br>
    Diese Vorlagen dienen zur <strong>Orientierung</strong> und stellen keine
    Rechtsberatung i.S.d. Rechtsdienstleistungsgesetzes dar. Vor produktiver Verwendung
    bitte durch zugelassene/n Rechtsanwältin/-anwalt prüfen lassen. Die Nutzung erfolgt
    auf eigenes Risiko. <br><br>
    Quelle: <strong>NexaStack</strong> — Open-Source-Vorlagen unter CC-BY 4.0.
    Feedback und Pull Requests willkommen.
  </div>

</main>
<?php require __DIR__ . "/_footer.php"; ?>
</body>
</html>
