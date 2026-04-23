<?php
// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors. Based on NexaSign (AGPL-3.0).
/**
 * NexaSign — AV-Vertrag-Assistent (Art. 28 DSGVO)
 * Single-Page-Form; bei POST wird via WeasyPrint ein PDF erzeugt und als Download geliefert.
 *
 * Pfad: https://nexasign.nexastack.co/vorlagen/av-vertrag
 * Lebt auf dem Host-Filesystem, NICHT im NexaSign-Docker-Container.
 */

declare(strict_types=1);

// ── Schutz gegen Renderer-DoS (WeasyPrint kann bei CSS-Loops hängen) ──
set_time_limit(60);  // WeasyPrint ist langsamer als das ZUGFeRD-Writing
ini_set('memory_limit', '256M');

const TEMPLATE_FILE    = __DIR__ . '/template.html.php';
const WEASYPRINT_BIN   = '/opt/nexasign-tools/venv/bin/weasyprint';
const REQUIRED_FIELDS  = [
    'verantwortlicher_name',
    'verantwortlicher_anschrift',
    'verantwortlicher_vertreter',
    'auftragsverarbeiter_name',
    'auftragsverarbeiter_anschrift',
    'auftragsverarbeiter_vertreter',
    'vertragsgegenstand',
    'vertragsdauer',
    'zweck_der_verarbeitung',
    'datenkategorien',
    'betroffenenkreis',
    'ort_sitz',
];

function h(?string $v): string { return htmlspecialchars((string)$v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }

// ─────────────────────────────────────────────────────────────────
// POST-Handler — PDF erzeugen und ausliefern
// ─────────────────────────────────────────────────────────────────
$errors  = [];
$input   = [];
$in_post = ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST';

if ($in_post) {
    foreach (REQUIRED_FIELDS as $f) {
        $v = trim((string)($_POST[$f] ?? ''));
        if ($v === '') {
            $errors[$f] = 'Pflichtfeld';
        }
        $input[$f] = $v;
    }
    $input['unterauftragsverarbeiter_liste'] = trim((string)($_POST['unterauftragsverarbeiter_liste'] ?? ''));
    $input['datum'] = trim((string)($_POST['datum'] ?? '')) ?: date('d.m.Y');

    // Längen-Validierung (Schutz vor Missbrauch)
    foreach ($input as $k => $v) {
        if (mb_strlen($v) > 5000) {
            $errors[$k] = 'Eingabe zu lang (max. 5 000 Zeichen)';
        }
    }

    if (empty($errors)) {
        // HTML rendern
        $d = $input;
        ob_start();
        require TEMPLATE_FILE;
        $html = ob_get_clean();

        // WeasyPrint per proc_open aufrufen
        $desc = [
            0 => ['pipe', 'r'], // stdin
            1 => ['pipe', 'w'], // stdout
            2 => ['pipe', 'w'], // stderr
        ];
        $cmd = escapeshellcmd(WEASYPRINT_BIN) . ' - -';
        $proc = proc_open($cmd, $desc, $pipes);
        if (!is_resource($proc)) {
            http_response_code(500);
            exit('PDF-Engine nicht erreichbar.');
        }
        fwrite($pipes[0], $html);
        fclose($pipes[0]);

        $pdf  = stream_get_contents($pipes[1]);
        $err  = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        $exit = proc_close($proc);

        if ($exit !== 0 || $pdf === '' || $pdf === false) {
            error_log('NexaSign AV-Assistent: WeasyPrint exit=' . $exit . ' err=' . $err);
            http_response_code(500);
            exit('PDF-Erzeugung fehlgeschlagen. Bitte später erneut versuchen.');
        }

        $filename = 'NexaSign-AV-Vertrag_' . preg_replace('/[^A-Za-z0-9._-]/', '', $input['verantwortlicher_name']) . '_' . date('Y-m-d') . '.pdf';
        header('Content-Type: application/pdf');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Content-Length: ' . strlen($pdf));
        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
        echo $pdf;
        exit;
    }
}

// ─────────────────────────────────────────────────────────────────
// GET oder Fehler → Form rendern
// ─────────────────────────────────────────────────────────────────
$today = date('d.m.Y');
?><!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>AV-Vertrag-Assistent — NexaSign</title>
<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;0,6..72,700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
:root {
  --primary:#140100; --accent:#9e4127; --accent-hover:#b84d2e;
  --bg:#fdf9f3; --bg-white:#ffffff; --text:#1c1c18; --text-muted:#6b6b63;
  --border:#e6e2dc; --error:#c0392b; --success:#2d7a45; --radius:0.5rem;
  --font-serif:'Newsreader', Georgia, serif;
  --font-sans:'Plus Jakarta Sans', system-ui, sans-serif;
}
body { font-family: var(--font-sans); background: var(--bg); color: var(--text);
  min-height: 100vh; -webkit-font-smoothing: antialiased; line-height: 1.55; }
main { max-width: 900px; margin: 2.5rem auto; padding: 0 1.5rem; }
h1 { font-family: var(--font-serif); font-size: clamp(2rem, 4vw, 2.75rem);
  line-height: 1.1; letter-spacing: -0.02em; color: var(--primary);
  margin-bottom: 0.5rem; font-weight: 600; }
.lead { font-size: 1.05rem; color: var(--text-muted); max-width: 720px; margin-bottom: 2rem; }
.errors {
  background: rgba(192,57,43,0.08); border-left: 3px solid var(--error);
  padding: 0.85rem 1.1rem; border-radius: 0 4px 4px 0;
  margin-bottom: 1.25rem; color: var(--error); font-size: 0.92rem;
}
form { background: var(--bg-white); border: 1px solid var(--border);
  border-radius: 0.75rem; padding: 2rem 2rem 1.5rem; margin-bottom: 2rem; }
fieldset { border: 0; padding: 0; margin: 0 0 1.5rem 0; }
fieldset:last-of-type { margin-bottom: 0.5rem; }
legend {
  font-family: var(--font-serif); font-size: 1.3rem; color: var(--primary);
  font-weight: 600; letter-spacing: -0.01em;
  padding-bottom: 0.4rem; margin-bottom: 1rem;
  border-bottom: 1px solid var(--border); width: 100%;
}
.grid-2 { display: grid; grid-template-columns: 1fr; gap: 1rem; }
@media (min-width: 720px) { .grid-2 { grid-template-columns: 1fr 1fr; } }
.field { margin-bottom: 0.9rem; }
.field label {
  display: block; font-size: 0.84rem; font-weight: 600;
  color: var(--text); margin-bottom: 0.3rem;
}
.field .hint { display: block; font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem; }
.field input[type="text"], .field textarea {
  width: 100%; padding: 0.7rem 0.9rem;
  border: 1.5px solid var(--border); border-radius: var(--radius);
  background: var(--bg); font-family: var(--font-sans); font-size: 0.95rem;
  color: var(--text);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.field input[type="text"]:focus, .field textarea:focus {
  outline: none; border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(158,65,39,0.08);
}
.field textarea { resize: vertical; min-height: 4.5rem; line-height: 1.45; }
.field.error input, .field.error textarea {
  border-color: var(--error);
  box-shadow: 0 0 0 3px rgba(192,57,43,0.08);
}
.field .field-error { color: var(--error); font-size: 0.82rem; margin-top: 0.25rem; }
.submit {
  width: 100%; padding: 0.95rem; background: var(--primary);
  color: var(--bg); border: none; border-radius: var(--radius);
  font-family: var(--font-sans); font-size: 1rem; font-weight: 600;
  cursor: pointer; transition: background 0.15s; margin-top: 0.5rem;
}
.submit:hover { background: #2a0d08; }
.submit-hint {
  text-align: center; font-size: 0.85rem; color: var(--text-muted); margin-top: 0.7rem;
}
.legal {
  font-size: 0.85rem; color: var(--text-muted); background: #f7f3ed;
  border-radius: var(--radius); padding: 1rem 1.25rem; margin-top: 2rem;
  border-left: 3px solid var(--accent); line-height: 1.5;
}
.legal strong { color: var(--text); }
.legal a { color: var(--accent); font-weight: 600; text-decoration: underline; }
</style>
</head>
<body>

<?php $current_section = 'vorlagen'; require __DIR__ . '/../_nav.php'; ?>

<main>

  <h1>AV-Vertrag nach Art. 28 DSGVO</h1>
  <p class="lead">
    Füllen Sie die folgenden Felder aus — NexaSign erzeugt daraus ein unterschriftsreifes
    PDF im DACH-Rechts-Standard. Das Dokument enthält alle nach Art. 28 DSGVO
    erforderlichen Mindestinhalte, einen TOM-Katalog nach Art. 32 DSGVO (Anlage 2)
    und eine Liste der Unterauftragsverarbeiter (Anlage 3).
  </p>

  <?php if (!empty($errors)): ?>
    <div class="errors"><strong>Bitte prüfen Sie die markierten Felder.</strong></div>
  <?php endif; ?>

  <form method="post" novalidate>

    <!-- ──────────── Parteien ──────────── -->
    <fieldset>
      <legend>1. Parteien</legend>

      <div class="grid-2">
        <div>
          <div class="field <?= isset($errors['verantwortlicher_name']) ? 'error' : '' ?>">
            <label for="verantwortlicher_name">Verantwortlicher (Auftraggeber) *</label>
            <input type="text" name="verantwortlicher_name" id="verantwortlicher_name"
                   maxlength="200" required
                   value="<?= h($input['verantwortlicher_name'] ?? '') ?>"
                   placeholder="z. B. Musterfirma GmbH">
            <?php if (isset($errors['verantwortlicher_name'])): ?>
              <div class="field-error"><?= h($errors['verantwortlicher_name']) ?></div>
            <?php endif; ?>
          </div>
          <div class="field <?= isset($errors['verantwortlicher_anschrift']) ? 'error' : '' ?>">
            <label for="verantwortlicher_anschrift">Anschrift *</label>
            <textarea name="verantwortlicher_anschrift" id="verantwortlicher_anschrift"
                      required rows="3" maxlength="500"
                      placeholder="Musterstraße 1&#10;12345 Musterstadt"><?= h($input['verantwortlicher_anschrift'] ?? '') ?></textarea>
          </div>
          <div class="field <?= isset($errors['verantwortlicher_vertreter']) ? 'error' : '' ?>">
            <label for="verantwortlicher_vertreter">Vertreten durch *</label>
            <input type="text" name="verantwortlicher_vertreter" id="verantwortlicher_vertreter"
                   maxlength="200" required
                   value="<?= h($input['verantwortlicher_vertreter'] ?? '') ?>"
                   placeholder="z. B. Max Mustermann, Geschäftsführer">
          </div>
        </div>
        <div>
          <div class="field <?= isset($errors['auftragsverarbeiter_name']) ? 'error' : '' ?>">
            <label for="auftragsverarbeiter_name">Auftragsverarbeiter (Dienstleister) *</label>
            <input type="text" name="auftragsverarbeiter_name" id="auftragsverarbeiter_name"
                   maxlength="200" required
                   value="<?= h($input['auftragsverarbeiter_name'] ?? '') ?>"
                   placeholder="z. B. Dienstleister AG">
          </div>
          <div class="field <?= isset($errors['auftragsverarbeiter_anschrift']) ? 'error' : '' ?>">
            <label for="auftragsverarbeiter_anschrift">Anschrift *</label>
            <textarea name="auftragsverarbeiter_anschrift" id="auftragsverarbeiter_anschrift"
                      required rows="3" maxlength="500"
                      placeholder="Beispielweg 42&#10;54321 Beispielort"><?= h($input['auftragsverarbeiter_anschrift'] ?? '') ?></textarea>
          </div>
          <div class="field <?= isset($errors['auftragsverarbeiter_vertreter']) ? 'error' : '' ?>">
            <label for="auftragsverarbeiter_vertreter">Vertreten durch *</label>
            <input type="text" name="auftragsverarbeiter_vertreter" id="auftragsverarbeiter_vertreter"
                   maxlength="200" required
                   value="<?= h($input['auftragsverarbeiter_vertreter'] ?? '') ?>"
                   placeholder="z. B. Erika Beispiel, Vorstand">
          </div>
        </div>
      </div>
    </fieldset>

    <!-- ──────────── Vertragskontext ──────────── -->
    <fieldset>
      <legend>2. Vertragskontext</legend>

      <div class="field <?= isset($errors['vertragsgegenstand']) ? 'error' : '' ?>">
        <label for="vertragsgegenstand">Gegenstand des Hauptvertrages *</label>
        <textarea name="vertragsgegenstand" id="vertragsgegenstand"
                  required rows="3" maxlength="1000"
                  placeholder="z. B. Bereitstellung einer SaaS-Lösung zur Kundenverwaltung inkl. Hosting, Wartung und Support."><?= h($input['vertragsgegenstand'] ?? '') ?></textarea>
        <span class="hint">Worauf bezieht sich der AV-Vertrag? Die Hauptleistung in 1–3 Sätzen.</span>
      </div>

      <div class="grid-2">
        <div class="field <?= isset($errors['vertragsdauer']) ? 'error' : '' ?>">
          <label for="vertragsdauer">Vertragsdauer *</label>
          <input type="text" name="vertragsdauer" id="vertragsdauer"
                 maxlength="200" required
                 value="<?= h($input['vertragsdauer'] ?? '') ?>"
                 placeholder="z. B. Unbefristet, mit 3 Monaten Kündigungsfrist">
        </div>
        <div class="field <?= isset($errors['ort_sitz']) ? 'error' : '' ?>">
          <label for="ort_sitz">Gerichtsstand / Ort *</label>
          <input type="text" name="ort_sitz" id="ort_sitz"
                 maxlength="100" required
                 value="<?= h($input['ort_sitz'] ?? 'Berlin') ?>"
                 placeholder="z. B. Berlin">
        </div>
      </div>
    </fieldset>

    <!-- ──────────── DSGVO-Detail ──────────── -->
    <fieldset>
      <legend>3. Beschreibung der Verarbeitung (DSGVO Art. 28 Abs. 3)</legend>

      <div class="field <?= isset($errors['zweck_der_verarbeitung']) ? 'error' : '' ?>">
        <label for="zweck_der_verarbeitung">Zweck der Verarbeitung *</label>
        <textarea name="zweck_der_verarbeitung" id="zweck_der_verarbeitung"
                  required rows="3" maxlength="1000"
                  placeholder="z. B. Speicherung und Verwaltung von Kundenstammdaten und Vertragsdaten im Rahmen der vertraglichen Hauptleistung."><?= h($input['zweck_der_verarbeitung'] ?? '') ?></textarea>
      </div>

      <div class="field <?= isset($errors['datenkategorien']) ? 'error' : '' ?>">
        <label for="datenkategorien">Kategorien personenbezogener Daten *</label>
        <textarea name="datenkategorien" id="datenkategorien"
                  required rows="3" maxlength="1000"
                  placeholder="z. B. Stammdaten (Name, Anschrift, E-Mail), Kommunikationsdaten, Nutzungsdaten, Zahlungsdaten."><?= h($input['datenkategorien'] ?? '') ?></textarea>
        <span class="hint">Welche Datenarten werden verarbeitet? Eine pro Zeile oder kommagetrennt.</span>
      </div>

      <div class="field <?= isset($errors['betroffenenkreis']) ? 'error' : '' ?>">
        <label for="betroffenenkreis">Kategorien betroffener Personen *</label>
        <textarea name="betroffenenkreis" id="betroffenenkreis"
                  required rows="2" maxlength="500"
                  placeholder="z. B. Kunden und Interessenten des Verantwortlichen; Mitarbeitende des Verantwortlichen."><?= h($input['betroffenenkreis'] ?? '') ?></textarea>
      </div>
    </fieldset>

    <!-- ──────────── Unterauftragsverarbeiter ──────────── -->
    <fieldset>
      <legend>4. Unterauftragsverarbeiter (optional)</legend>

      <div class="field">
        <label for="unterauftragsverarbeiter_liste">Aktuelle Unterauftragsverarbeiter</label>
        <textarea name="unterauftragsverarbeiter_liste" id="unterauftragsverarbeiter_liste"
                  rows="4" maxlength="2000"
                  placeholder="Ein Unterauftragsverarbeiter pro Zeile, z. B.:&#10;Amazon Web Services EMEA SARL, Frankfurt (Hosting)&#10;Stripe Payments Europe Ltd, Dublin (Zahlungsabwicklung)"><?= h($input['unterauftragsverarbeiter_liste'] ?? '') ?></textarea>
        <span class="hint">Kann leer bleiben, wenn aktuell keine Subprozessoren eingesetzt werden.</span>
      </div>

      <div class="field">
        <label for="datum">Datum</label>
        <input type="text" name="datum" id="datum"
               maxlength="20"
               value="<?= h($input['datum'] ?? $today) ?>"
               placeholder="<?= $today ?>">
      </div>
    </fieldset>

    <button type="submit" class="submit">PDF erzeugen</button>
    <p class="submit-hint">
      Das PDF wird im Browser heruntergeladen. Zum Signieren
      können Sie es anschließend in <a href="<?= htmlspecialchars($nx_app_base) ?>/" style="color:var(--accent);">NexaSign</a>
      hochladen.
    </p>
  </form>

  <!-- ──────────── Rechtlicher Hinweis ──────────── -->
  <div class="legal">
    <strong>⚖️ Rechtlicher Hinweis</strong><br>
    Dieser Generator erzeugt eine <strong>Vorlage</strong> auf Basis von Art. 28 DSGVO,
    orientiert an BfDI-, GDD- und DSK-Kurzpapier-Nr.-13-Empfehlungen. Es handelt sich um eine
    <strong>Orientierungshilfe</strong> und <strong>ersetzt keine individuelle
    Rechtsberatung</strong>. Vor produktiver Nutzung empfehlen wir die Prüfung
    durch Ihren Datenschutzbeauftragten oder eine/n zugelassene/n Rechtsanwältin/Rechtsanwalt.
    <br><br>
    NexaStack ist <strong>nicht Partei</strong> des erzeugten Vertrages, speichert
    <strong>keine Ihrer Eingaben</strong> und tritt nicht als Auftragsverarbeiter,
    Treuhänder oder Notar auf. Das erzeugte PDF wird ausschließlich in Ihrem Browser
    heruntergeladen und verlässt unseren Server nicht.
  </div>

</main>
<?php require __DIR__ . "/../_footer.php"; ?>
</body>
</html>
