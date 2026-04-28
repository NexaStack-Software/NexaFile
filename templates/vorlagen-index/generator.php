<?php
// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors. Based on NexaSign (AGPL-3.0).
/**
 * Generischer PDF-Assistent für die Markdown-Vertragsvorlagen.
 *
 * Die AV- und X-Rechnung-Generatoren bleiben eigene Spezialtools. Diese Datei
 * deckt die einfachen Vertragsvorlagen ab: Markdown einlesen, Platzhalter als
 * Formularfelder anzeigen, ausgefülltes Dokument per WeasyPrint als PDF liefern.
 */
declare(strict_types=1);

set_time_limit(60);
ini_set('memory_limit', '256M');

const WEASYPRINT_BIN = '/opt/NexaSign/demo/tools/venv/bin/weasyprint';

function h(?string $v): string { return htmlspecialchars((string)$v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }

$templates = [
    'nda-einseitig' => [
        'file' => '01-nda-einseitig.md',
        'title' => 'NDA — einseitig',
        'lead' => 'Vertraulichkeitsvereinbarung, wenn eine Partei Informationen offenlegt und die andere Partei diese schützen muss.',
    ],
    'nda-gegenseitig' => [
        'file' => '02-nda-gegenseitig.md',
        'title' => 'NDA — gegenseitig',
        'lead' => 'Wechselseitige Vertraulichkeit für Gespräche, bei denen beide Seiten sensible Informationen teilen.',
    ],
    'freelancer-werkvertrag' => [
        'file' => '03-freelancer-werkvertrag.md',
        'title' => 'Freelancer- / Werkvertrag',
        'lead' => 'Projektvertrag mit Leistungsbeschreibung, Vergütung, Nutzungsrechten, Abnahme und Haftungsrahmen.',
    ],
    'arbeitsvertrag-unbefristet' => [
        'file' => '04-arbeitsvertrag-unbefristet.md',
        'title' => 'Arbeitsvertrag — unbefristet',
        'lead' => 'Unbefristete Festanstellung mit Tätigkeit, Vergütung, Arbeitszeit, Urlaub und Nebenpflichten.',
    ],
    'arbeitsvertrag-befristet' => [
        'file' => '05-arbeitsvertrag-befristet.md',
        'title' => 'Arbeitsvertrag — befristet',
        'lead' => 'Befristete Anstellung mit Befristungsende, optionalem Sachgrund und den üblichen Arbeitsvertragsdaten.',
    ],
    'beratungsvertrag' => [
        'file' => '07-beratungsvertrag.md',
        'title' => 'Beratungsvertrag',
        'lead' => 'Consulting-, Coaching- oder Strategieberatungsvertrag mit Vergütung, Haftung und Laufzeit.',
    ],
    'aufhebungsvertrag' => [
        'file' => '08-aufhebungsvertrag.md',
        'title' => 'Aufhebungsvertrag',
        'lead' => 'Einvernehmliche Beendigung eines Arbeitsverhältnisses mit Abfindung, Freistellung und Zeugnisregelung.',
    ],
    'angebotsannahme' => [
        'file' => '09-angebotsannahme.md',
        'title' => 'Angebotsannahme / Auftragsbestätigung',
        'lead' => 'Auftragsbestätigung mit Positionen, Zahlungsziel, Umsatzsteuer, Skonto und Liefertermin.',
    ],
    'agb-zustimmung' => [
        'file' => '10-agb-zustimmung.md',
        'title' => 'AGB-Zustimmung',
        'lead' => 'Dokumentierte Zustimmung zu AGB und Datenschutzerklärung für Registrierung, Rollout oder B2B-Nutzung.',
    ],
];

$labels = [
    'partei_a_name' => 'Partei A / Auftraggeber',
    'partei_a_anschrift' => 'Anschrift Partei A',
    'partei_a_vertreter' => 'Vertreten durch Partei A',
    'partei_a_ustid' => 'USt-IdNr. Partei A',
    'partei_b_name' => 'Partei B / Auftragnehmer',
    'partei_b_anschrift' => 'Anschrift Partei B',
    'partei_b_vertreter' => 'Vertreten durch Partei B',
    'arbeitgeber_name' => 'Arbeitgeber',
    'arbeitgeber_anschrift' => 'Anschrift Arbeitgeber',
    'arbeitgeber_vertreter' => 'Vertreten durch Arbeitgeber',
    'arbeitnehmer_name' => 'Arbeitnehmer',
    'arbeitnehmer_anschrift' => 'Anschrift Arbeitnehmer',
    'arbeitnehmer_geburtsdatum' => 'Geburtsdatum Arbeitnehmer',
    'ort_unterzeichnung' => 'Ort der Unterzeichnung',
    'datum_unterzeichnung' => 'Datum der Unterzeichnung',
    'anwendbares_recht' => 'Anwendbares Recht',
    'gerichtsstand' => 'Gerichtsstand',
    'geheimhaltungsdauer_jahre' => 'Geheimhaltungsdauer in Jahren',
    'vertragsstrafe_betrag' => 'Vertragsstrafe in EUR',
    'zweck_der_offenlegung' => 'Zweck der Offenlegung',
    'zweck_der_zusammenarbeit' => 'Zweck der Zusammenarbeit',
    'leistungsbeschreibung' => 'Leistungsbeschreibung',
    'taetigkeitsbeschreibung' => 'Tätigkeitsbeschreibung',
    'tagessatz_oder_pauschale' => 'Tagessatz oder Pauschale',
    'verguetungssatz' => 'Vergütungssatz',
    'zahlungsziel_tage' => 'Zahlungsziel in Tagen',
    'kuendigungsfrist' => 'Kündigungsfrist',
    'haftungsgrenze' => 'Haftungsgrenze',
    'haftpflicht_deckungssumme' => 'Haftpflicht-Deckungssumme',
    'vertragsbeginn' => 'Vertragsbeginn',
    'vertragsdauer' => 'Vertragsdauer',
    'vertragsende_oder_unbefristet' => 'Vertragsende oder unbefristet',
    'eintrittsdatum' => 'Eintrittsdatum',
    'befristungsende' => 'Befristungsende',
    'sachgrund_befristung' => 'Sachgrund der Befristung',
    'stellenbezeichnung' => 'Stellenbezeichnung',
    'arbeitsort' => 'Arbeitsort',
    'arbeitszeit_wochenstunden' => 'Wochenstunden',
    'monatsgehalt_brutto' => 'Brutto-Monatsgehalt',
    'urlaubstage_pro_jahr' => 'Urlaubstage pro Jahr',
    'mehrarbeit_pauschal_stunden' => 'Pauschal abgegoltene Mehrarbeit',
    'arbeitsvertrag_datum' => 'Datum des Arbeitsvertrags',
    'beendigungsdatum' => 'Beendigungsdatum',
    'beendigungsgrund' => 'Beendigungsgrund',
    'freistellungsbeginn' => 'Freistellungsbeginn',
    'abfindungsbetrag' => 'Abfindungsbetrag',
    'zeugnisnote' => 'Zeugnisnote',
    'beratungsfeld' => 'Beratungsfeld',
    'abrechnungseinheit' => 'Abrechnungseinheit',
    'angebots_nr' => 'Angebotsnummer',
    'angebots_datum' => 'Angebotsdatum',
    'auftragsbestaetigung_nr' => 'Auftragsbestätigungsnummer',
    'datum_auftragsbestaetigung' => 'Datum der Auftragsbestätigung',
    'kundennummer' => 'Kundennummer',
    'lieferort' => 'Lieferort',
    'leistungstermin' => 'Leistungstermin',
    'ust_satz' => 'Umsatzsteuersatz',
    'ust_betrag' => 'Umsatzsteuerbetrag',
    'summe_netto' => 'Summe netto',
    'summe_brutto' => 'Summe brutto',
    'skonto_prozent' => 'Skonto in Prozent',
    'skonto_tage' => 'Skonto-Frist in Tagen',
    'agb_url' => 'AGB-URL',
    'agb_version' => 'AGB-Version',
    'agb_fassung_datum' => 'AGB-Fassungsdatum',
    'datenschutzerklaerung_url' => 'Datenschutzerklärung-URL',
    'datenschutz_version' => 'Datenschutz-Version',
    'datenschutz_fassung_datum' => 'Datenschutz-Fassungsdatum',
    'produkt_bezeichnung' => 'Produkt / Dienst',
    'zustimmungszeitpunkt' => 'Zustimmungszeitpunkt',
    'zustimmung_ip' => 'IP-Adresse bei Zustimmung',
    'widerrufsbelehrung_abschnitt' => 'Widerrufsbelehrung / Zusatztext',
];

$defaults = [
    'anwendbares_recht' => 'Recht der Bundesrepublik Deutschland',
    'datum_unterzeichnung' => date('d.m.Y'),
    'geheimhaltungsdauer_jahre' => '3',
    'zahlungsziel_tage' => '14',
    'ust_satz' => '19 %',
    'urlaubstage_pro_jahr' => '30',
];

function template_label(string $key, array $labels): string {
    if (isset($labels[$key])) {
        return $labels[$key];
    }
    return ucfirst(str_replace(['_', 'ae', 'oe', 'ue'], [' ', 'ä', 'ö', 'ü'], $key));
}

function is_multiline_field(string $key): bool {
    return str_contains($key, 'anschrift')
        || str_contains($key, 'beschreibung')
        || str_contains($key, 'belehrung')
        || str_contains($key, 'grund')
        || str_contains($key, 'zweck');
}

function extract_fields(string $markdown): array {
    preg_match_all('/{{([a-zA-Z0-9_]+)}}/', $markdown, $matches);
    return array_values(array_unique($matches[1]));
}

function inline_md(string $text): string {
    $out = h($text);
    $out = preg_replace('/\*\*(.*?)\*\*/', '<strong>$1</strong>', $out) ?? $out;
    $out = preg_replace('/\*(.*?)\*/', '<em>$1</em>', $out) ?? $out;
    return $out;
}

function render_markdown_html(string $markdown): string {
    $lines = preg_split('/\R/', $markdown) ?: [];
    $html = '';
    $paragraph = [];

    $flush = static function () use (&$html, &$paragraph): void {
        if ($paragraph === []) {
            return;
        }
        $html .= '<p>' . implode('<br>', array_map('inline_md', $paragraph)) . "</p>\n";
        $paragraph = [];
    };

    foreach ($lines as $line) {
        $trim = trim($line);
        if ($trim === '') {
            $flush();
            continue;
        }
        if ($trim === '---') {
            $flush();
            $html .= "<hr>\n";
            continue;
        }
        if (str_starts_with($trim, '# ')) {
            $flush();
            $html .= '<h1>' . inline_md(substr($trim, 2)) . "</h1>\n";
            continue;
        }
        if (str_starts_with($trim, '## ')) {
            $flush();
            $html .= '<h2>' . inline_md(substr($trim, 3)) . "</h2>\n";
            continue;
        }
        if (str_starts_with($trim, '> ')) {
            $flush();
            $html .= '<blockquote>' . inline_md(substr($trim, 2)) . "</blockquote>\n";
            continue;
        }
        if (preg_match('/^_{8,}$/', $trim) === 1) {
            $flush();
            $html .= '<div class="signature-line"></div>' . "\n";
            continue;
        }
        $paragraph[] = rtrim($line);
    }
    $flush();
    return $html;
}

function render_pdf_html(string $title, string $markdown): string {
    $body = render_markdown_html($markdown);
    return '<!doctype html><html lang="de"><head><meta charset="utf-8"><title>' . h($title) . '</title><style>
@page { size: A4; margin: 22mm 19mm 24mm 19mm;
  @bottom-left { content: "Erstellt mit NexaSign · nexasign.nexastack.co"; font-size: 8pt; color: #6b6b63; }
  @bottom-right { content: "Seite " counter(page) " von " counter(pages); font-size: 8pt; color: #6b6b63; }
}
body { font-family: Helvetica, Arial, sans-serif; font-size: 10.5pt; line-height: 1.5; color: #1c1c18; }
h1 { font-family: Georgia, serif; font-size: 22pt; line-height: 1.1; color: #140100; margin: 0 0 14pt; }
h2 { font-family: Georgia, serif; font-size: 14.5pt; color: #140100; margin: 18pt 0 6pt; border-bottom: 1px solid #e6e2dc; padding-bottom: 3pt; }
p { margin: 0 0 8pt; }
blockquote { background: #fff8e6; border-left: 3pt solid #b8860b; margin: 0 0 14pt; padding: 9pt 12pt; font-size: 9.5pt; }
hr { border: 0; border-top: 1px solid #e6e2dc; margin: 14pt 0; }
.signature-line { width: 58mm; border-top: 1px solid #1c1c18; margin-top: 28pt; }
strong { color: #140100; }
</style></head><body>' . $body . '</body></html>';
}

$slug = (string)($_GET['slug'] ?? '');
if (!isset($templates[$slug])) {
    http_response_code(404);
    exit('Vorlage nicht gefunden.');
}

$config = $templates[$slug];
$md_dir = is_dir(__DIR__ . '/source-md/')
    ? __DIR__ . '/source-md/'
    : realpath(__DIR__ . '/../../Vorlagen') . '/';
$md_path = $md_dir . $config['file'];
if (!is_file($md_path) || !is_readable($md_path)) {
    http_response_code(500);
    exit('Vorlagen-Datei nicht lesbar.');
}

$markdown = (string)file_get_contents($md_path);
$fields = extract_fields($markdown);
$is_post = ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST';
$input = [];
$errors = [];

foreach ($fields as $field) {
    $value = $is_post ? trim((string)($_POST[$field] ?? '')) : ($defaults[$field] ?? '');
    if ($is_post && $value === '') {
        $errors[$field] = 'Pflichtfeld';
    }
    if (mb_strlen($value) > 8000) {
        $errors[$field] = 'Eingabe zu lang';
    }
    $input[$field] = $value;
}

if ($is_post && $errors === []) {
    $filled = $markdown;
    foreach ($input as $key => $value) {
        $filled = str_replace('{{' . $key . '}}', $value, $filled);
    }
    $html = render_pdf_html($config['title'], $filled);

    $desc = [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
    $proc = proc_open(escapeshellcmd(WEASYPRINT_BIN) . ' - -', $desc, $pipes);
    if (!is_resource($proc)) {
        http_response_code(500);
        exit('PDF-Engine nicht erreichbar.');
    }
    fwrite($pipes[0], $html);
    fclose($pipes[0]);
    $pdf = stream_get_contents($pipes[1]);
    $err = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    $exit = proc_close($proc);

    if ($exit !== 0 || $pdf === '' || $pdf === false) {
        error_log('NexaSign Vertragsgenerator: slug=' . $slug . ' exit=' . $exit . ' err=' . $err);
        http_response_code(500);
        exit('PDF-Erzeugung fehlgeschlagen. Bitte später erneut versuchen.');
    }

    $filename = 'NexaSign-' . $slug . '-' . date('Y-m-d') . '.pdf';
    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Content-Length: ' . strlen($pdf));
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    echo $pdf;
    exit;
}
?><!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title><?= h($config['title']) ?> — NexaSign</title>
<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;0,6..72,700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
:root {
  --primary:#140100; --accent:#9e4127; --accent-hover:#b84d2e;
  --bg:#fdf9f3; --bg-white:#ffffff; --text:#1c1c18; --text-muted:#6b6b63;
  --border:#e6e2dc; --error:#c0392b; --radius:0.5rem;
  --font-serif:'Newsreader', Georgia, serif;
  --font-sans:'Plus Jakarta Sans', system-ui, sans-serif;
}
body { font-family: var(--font-sans); background: var(--bg); color: var(--text);
  min-height: 100vh; -webkit-font-smoothing: antialiased; line-height: 1.55; }
main { max-width: 940px; margin: 2.5rem auto; padding: 0 1.5rem; }
.back { display:inline-block; color:var(--text-muted); text-decoration:none; font-size:0.9rem; margin-bottom:1rem; }
.back:hover { color: var(--accent); }
h1 { font-family: var(--font-serif); font-size: clamp(2rem, 4vw, 2.75rem);
  line-height: 1.1; color: var(--primary); margin-bottom: 0.5rem; font-weight: 600; }
.lead { font-size: 1.05rem; color: var(--text-muted); max-width: 760px; margin-bottom: 2rem; }
.errors { background: rgba(192,57,43,0.08); border-left: 3px solid var(--error);
  padding: 0.85rem 1.1rem; border-radius: 0 4px 4px 0; margin-bottom: 1.25rem;
  color: var(--error); font-size: 0.92rem; }
form { background: var(--bg-white); border: 1px solid var(--border);
  border-radius: 0.75rem; padding: 2rem; margin-bottom: 1.5rem; }
.grid { display: grid; grid-template-columns: 1fr; gap: 1rem 1.25rem; }
@media (min-width: 760px) { .grid { grid-template-columns: 1fr 1fr; } }
.field.full { grid-column: 1 / -1; }
.field label { display:block; font-size:0.84rem; font-weight:600; margin-bottom:0.3rem; }
.field input, .field textarea {
  width:100%; padding:0.7rem 0.9rem; border:1.5px solid var(--border);
  border-radius:var(--radius); background:var(--bg); font-family:var(--font-sans);
  font-size:0.95rem; color:var(--text);
}
.field textarea { resize: vertical; min-height: 5.2rem; line-height: 1.45; }
.field input:focus, .field textarea:focus { outline:none; border-color:var(--accent);
  box-shadow:0 0 0 3px rgba(158,65,39,0.08); }
.field.error input, .field.error textarea { border-color:var(--error);
  box-shadow:0 0 0 3px rgba(192,57,43,0.08); }
.field-error { color:var(--error); font-size:0.82rem; margin-top:0.25rem; }
.submit { width:100%; padding:0.95rem; background:var(--primary); color:var(--bg);
  border:0; border-radius:var(--radius); font-size:1rem; font-weight:600;
  font-family:var(--font-sans); cursor:pointer; margin-top:1.2rem; }
.submit:hover { background:#2a0d08; }
.secondary { text-align:center; margin-top:0.9rem; font-size:0.88rem; color:var(--text-muted); }
.secondary a { color:var(--accent); font-weight:600; }
.legal { font-size:0.85rem; color:var(--text-muted); background:#f7f3ed;
  border-radius:var(--radius); padding:1rem 1.25rem; border-left:3px solid var(--accent); }
.legal strong { color:var(--text); }
</style>
</head>
<body>
<?php $current_section = 'vorlagen'; require __DIR__ . '/_nav.php'; ?>
<main>
  <a class="back" href="/vorlagen/">← Zurück zu allen Vorlagen</a>
  <h1><?= h($config['title']) ?></h1>
  <p class="lead"><?= h($config['lead']) ?> Felder ausfüllen, PDF erzeugen, anschließend in NexaSign hochladen und signieren.</p>

  <?php if ($errors !== []): ?>
    <div class="errors"><strong>Bitte prüfen Sie die markierten Felder.</strong></div>
  <?php endif; ?>

  <form method="post" novalidate>
    <div class="grid">
      <?php foreach ($fields as $field): ?>
        <?php $multi = is_multiline_field($field); ?>
        <div class="field <?= $multi ? 'full' : '' ?> <?= isset($errors[$field]) ? 'error' : '' ?>">
          <label for="<?= h($field) ?>"><?= h(template_label($field, $labels)) ?> *</label>
          <?php if ($multi): ?>
            <textarea name="<?= h($field) ?>" id="<?= h($field) ?>" maxlength="8000" required><?= h($input[$field] ?? '') ?></textarea>
          <?php else: ?>
            <input type="text" name="<?= h($field) ?>" id="<?= h($field) ?>" maxlength="8000" required value="<?= h($input[$field] ?? '') ?>">
          <?php endif; ?>
          <?php if (isset($errors[$field])): ?>
            <div class="field-error"><?= h($errors[$field]) ?></div>
          <?php endif; ?>
        </div>
      <?php endforeach; ?>
    </div>
    <button class="submit" type="submit">PDF erzeugen</button>
    <div class="secondary">
      Rohvorlage als Markdown:
      <a href="/vorlagen/download/<?= h($config['file']) ?>">download</a>
    </div>
  </form>

  <div class="legal">
    <strong>Rechtlicher Hinweis:</strong> Diese Vorlage dient zur Orientierung und stellt keine Rechtsberatung dar.
    Vor produktiver Verwendung bitte durch zugelassene Rechtsanwältin oder zugelassenen Rechtsanwalt prüfen lassen.
  </div>
</main>
<?php require __DIR__ . '/_footer.php'; ?>
</body>
</html>
