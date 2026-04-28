<?php
// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors. Based on NexaSign (AGPL-3.0).
/**
 * NexaSign — X-Rechnung / ZUGFeRD Generator (Phase 1)
 *
 * Formular:
 *   - Upload eines bestehenden Rechnungs-PDFs (Bildrechnung oder regulär)
 *   - Strukturdaten: Verkäufer, Käufer, Rechnungsnummer, Positionen, Steuer, Zahlung
 *
 * Ausgabe (generate.php):
 *   - PDF/A-3 mit eingebettetem EN 16931 CII XML (ZUGFeRD EN16931-Profil, „Comfort")
 *   - Kompatibel mit der deutschen E-Rechnungspflicht ab 2025 (§ 14 UStG, B2B)
 */
declare(strict_types=1);

if (!function_exists('h')) {
    function h(?string $v): string { return htmlspecialchars((string)$v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
}

// Vorbelegung, wenn Generator einen Fehler zurückgibt (über Query-Param error, data in POST-Redirect-Get nicht trivial — wir nutzen reines form-resubmit mit Server-side-Reshow stattdessen).
$errors = [];
$old    = [];
?><!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>X-Rechnung / ZUGFeRD-Generator — NexaSign</title>
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
.back { display: inline-block; color: var(--text-muted); text-decoration: none;
  font-size: 0.9rem; margin-bottom: 1rem; }
.back:hover { color: var(--accent); }
h1 { font-family: var(--font-serif); font-size: clamp(2rem, 4vw, 2.75rem);
  line-height: 1.1; letter-spacing: -0.02em; color: var(--primary);
  margin-bottom: 0.5rem; font-weight: 600; }
.lead { font-size: 1.05rem; color: var(--text-muted); max-width: 760px; margin-bottom: 2rem; }
.lead strong { color: var(--text); }

/* ───── Sektionen ───── */
.section {
  background: var(--bg-white); border: 1px solid var(--border);
  border-radius: 0.75rem; padding: 1.5rem 1.75rem; margin-bottom: 1.25rem;
}
.section h2 {
  font-family: var(--font-serif); font-size: 1.35rem;
  color: var(--primary); margin-bottom: 0.35rem; font-weight: 600;
}
.section .hint {
  color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.1rem;
}

/* ───── Felder ───── */
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem 1.25rem; }
.grid-3 { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 1rem 1.25rem; }
.full { grid-column: 1 / -1; }
@media (max-width: 640px) { .grid, .grid-3 { grid-template-columns: 1fr; } }

.field { display: flex; flex-direction: column; gap: 0.3rem; }
.field label { font-size: 0.85rem; font-weight: 600; color: var(--text); }
.field label .opt { color: var(--text-muted); font-weight: 400; }
.field input, .field select, .field textarea {
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--border); border-radius: var(--radius);
  background: var(--bg-white); color: var(--text);
  font-family: var(--font-sans); font-size: 0.95rem;
}
.field input:focus, .field select:focus, .field textarea:focus {
  outline: none; border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(158,65,39,0.08);
}

/* ───── Positions-Tabelle ───── */
.positions {
  display: grid;
  grid-template-columns: 3fr 0.8fr 1fr 0.8fr 0.8fr 2.5rem;
  gap: 0.5rem; align-items: center;
  font-size: 0.9rem;
}
.positions .head {
  font-size: 0.75rem; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.04em; color: var(--text-muted);
  padding-bottom: 0.2rem; border-bottom: 1px solid var(--border);
  margin-bottom: 0.25rem;
}
.positions input {
  padding: 0.4rem 0.55rem;
  border: 1px solid var(--border); border-radius: 0.375rem;
  background: var(--bg-white); color: var(--text);
  font-family: var(--font-sans); font-size: 0.9rem; width: 100%;
}
.positions .remove {
  background: transparent; border: none; cursor: pointer;
  color: var(--text-muted); font-size: 1.3rem; line-height: 1;
  padding: 0.25rem;
}
.positions .remove:hover { color: var(--error); }
.positions-tools {
  margin-top: 0.8rem; display: flex; gap: 0.6rem; align-items: center;
}
.btn-ghost {
  border: 1px dashed var(--border); background: transparent;
  padding: 0.45rem 0.9rem; border-radius: var(--radius);
  font-size: 0.88rem; color: var(--accent);
  cursor: pointer; font-family: var(--font-sans); font-weight: 500;
}
.btn-ghost:hover { border-color: var(--accent); }
.total-preview {
  margin-top: 1rem; padding: 0.85rem 1.1rem;
  background: #f7f3ed; border-radius: var(--radius);
  display: flex; justify-content: space-between; align-items: baseline;
  font-size: 0.95rem;
}
.total-preview .value {
  font-family: var(--font-serif); font-size: 1.25rem; font-weight: 600;
  color: var(--primary);
}
@media (max-width: 720px) {
  .positions { grid-template-columns: 1fr; }
  .positions .head { display: none; }
  .positions input::placeholder { font-weight: 500; }
}

/* ───── Upload-Feld ───── */
.upload-box {
  border: 2px dashed var(--border); border-radius: var(--radius);
  padding: 1.75rem 1rem; text-align: center;
  transition: border-color 0.15s, background 0.15s;
  cursor: pointer;
}
.upload-box:hover, .upload-box.drag {
  border-color: var(--accent); background: #f7f3ed;
}
.upload-box input[type="file"] { display: none; }
.upload-box .label { font-weight: 600; color: var(--primary); }
.upload-box .sub { color: var(--text-muted); font-size: 0.88rem; margin-top: 0.25rem; }
.upload-box .filename { color: var(--accent); font-weight: 600; }
.upload-box.uploading .label::after {
  content: ' · wird gelesen …';
  color: var(--text-muted); font-weight: 500;
}
.upload-box.done { border-color: var(--success); background: #f0f7f3; }
.upload-box.done .label::after { content: ' ✓'; color: var(--success); }

.extract-result {
  display: none;
  margin-top: 1rem; padding: 0.85rem 1.1rem;
  background: #f0f7f3; border-left: 3px solid var(--success);
  border-radius: var(--radius);
  font-size: 0.92rem; color: var(--text);
}
.extract-result strong { color: var(--primary); }
.extract-result.visible { display: block; }
.extract-result.err {
  background: #fff0ec; border-left-color: var(--error); color: var(--error);
}

.form-body { display: none; }
.form-body.visible { display: block; }

/* Auto-gefüllte Felder visuell markieren */
.field input.auto-filled, .field select.auto-filled {
  border-color: var(--success);
  background: #f6fbf8;
}
.field .auto-hint {
  font-size: 0.75rem; color: var(--success); font-weight: 500;
  margin-top: 0.1rem;
}

.submit {
  width: 100%; padding: 0.95rem; background: var(--primary);
  color: var(--bg); border: none; border-radius: var(--radius);
  font-family: var(--font-sans); font-size: 1rem; font-weight: 600;
  cursor: pointer; transition: background 0.15s; margin-top: 0.5rem;
}
.submit:hover { background: #2a0d08; }

.legal {
  font-size: 0.85rem; color: var(--text-muted); background: #f7f3ed;
  border-radius: var(--radius); padding: 1rem 1.25rem; margin-top: 2rem;
  border-left: 3px solid var(--accent); line-height: 1.5;
}
.legal strong { color: var(--text); }

.errors {
  background: #fff0ec; border: 1px solid #e5b7ad; border-left: 4px solid var(--error);
  padding: 0.85rem 1.1rem; border-radius: var(--radius);
  margin-bottom: 1.25rem; color: var(--error); font-size: 0.95rem;
}

.beta-banner {
  background: #fff8e1; border: 1px solid #f0d97a; border-left: 4px solid #d49619;
  padding: 0.95rem 1.2rem; border-radius: var(--radius);
  margin-bottom: 1.5rem; color: #5b4708; font-size: 0.95rem; line-height: 1.55;
}
.beta-banner .tag {
  display: inline-block; background: #d49619; color: #fff;
  padding: 0.1rem 0.55rem; border-radius: 0.25rem;
  font-size: 0.75rem; font-weight: 700; letter-spacing: 0.04em;
  text-transform: uppercase; margin-right: 0.5rem; vertical-align: middle;
}
.beta-banner strong { color: #3d2f05; }
</style>
</head>
<body>

<?php $current_section = 'vorlagen'; require __DIR__ . '/../_nav.php'; ?>

<main>
  <a href="/vorlagen/" class="back">← zurück zur Vorlagen-Übersicht</a>

  <h1>X-Rechnung / ZUGFeRD-Generator</h1>

  <div class="beta-banner">
    <span class="tag">Beta</span>
    <strong>Noch nicht für produktive Buchhaltung.</strong>
    Der Generator erzeugt valides EN&nbsp;16931-XML im PDF/A-3, ist aber
    <strong>noch nicht gegen den offiziellen KoSIT-Validator</strong> des
    Bundesministeriums der Finanzen geprüft. Für interne Tests, Onboarding
    und Format-Vorschau geeignet — vor dem produktiven Versand an Behörden
    oder als steuerlich relevantes Dokument bitte mit dem KoSIT-Validator
    (<a href="https://github.com/itplr-kosit/validator" target="_blank" rel="noopener">itplr-kosit/validator</a>)
    gegenprüfen. Status verfolgen:
    <a href="https://github.com/NexaStack-Software/NexaSign/issues" target="_blank" rel="noopener">GitHub-Issues</a>.
  </div>

  <p class="lead">
    Seit 1. Januar 2025 sind deutsche B2B-Unternehmen verpflichtet, elektronische Rechnungen
    im Format <strong>X-Rechnung</strong> oder <strong>ZUGFeRD (≥ 2.0.1)</strong> empfangen zu können.
    Laden Sie Ihr bestehendes Rechnungs-PDF hoch, ergänzen die Strukturdaten — NexaSign
    erzeugt daraus ein <strong>PDF/A-3 mit eingebettetem EN&nbsp;16931 XML</strong> (Factur-X /
    ZUGFeRD Comfort-Profil).
  </p>

  <?php if (!empty($errors)): ?>
    <div class="errors">
      <strong>Fehler:</strong>
      <ul style="margin-top:0.4rem;padding-left:1.25rem;">
        <?php foreach ($errors as $e): ?><li><?= h($e) ?></li><?php endforeach; ?>
      </ul>
    </div>
  <?php endif; ?>

  <form method="post" action="/vorlagen/x-rechnung/generate" enctype="multipart/form-data" novalidate>

    <!-- ═══ 1. PDF-Upload ═══ -->
    <div class="section">
      <h2>1. Rechnungs-PDF hochladen</h2>
      <div class="hint">
        Laden Sie Ihr bestehendes Rechnungs-PDF hoch — NexaSign liest automatisch Nummer, Datum, Anschriften,
        IBAN und Steuersatz heraus und befüllt das Formular vor. Max. 10 MB.
      </div>
      <label class="upload-box" id="upload-box">
        <input type="file" name="pdf" accept="application/pdf" required id="pdf-input">
        <div class="label" id="upload-label">📄 Datei wählen oder hier ablegen</div>
        <div class="sub">Nur PDF, max. 10 MB</div>
      </label>
      <div class="extract-result" id="extract-result"></div>
    </div>

    <div class="form-body" id="form-body">

    <!-- ═══ 2. Rechnungs-Kopf ═══ -->
    <div class="section">
      <h2>2. Rechnungsdaten</h2>
      <div class="hint">Pflichtangaben für eine EN 16931-konforme elektronische Rechnung.</div>
      <div class="grid">
        <div class="field">
          <label>Rechnungsnummer *</label>
          <input type="text" name="invoice_number" required placeholder="z. B. 2026-0123" value="<?= h($old['invoice_number'] ?? '') ?>">
        </div>
        <div class="field">
          <label>Rechnungsdatum *</label>
          <input type="date" name="invoice_date" required value="<?= h($old['invoice_date'] ?? date('Y-m-d')) ?>">
        </div>
        <div class="field">
          <label>Leistungsdatum / -beginn *</label>
          <input type="date" name="service_date" required value="<?= h($old['service_date'] ?? date('Y-m-d')) ?>">
        </div>
        <div class="field">
          <label>Währung *</label>
          <select name="currency" required>
            <option value="EUR" selected>EUR</option>
            <option value="CHF">CHF</option>
            <option value="USD">USD</option>
          </select>
        </div>
        <div class="field full">
          <label>Bestell- / Auftragsreferenz des Empfängers <span class="opt">(optional, aber oft Pflicht bei Behörden)</span></label>
          <input type="text" name="buyer_reference" placeholder="z. B. Leitweg-ID oder Einkaufs-Nr." value="<?= h($old['buyer_reference'] ?? '') ?>">
        </div>
      </div>
    </div>

    <!-- ═══ 3. Verkäufer ═══ -->
    <div class="section">
      <h2>3. Verkäufer (Rechnungssteller)</h2>
      <div class="hint">Ihr Unternehmen oder Ihre Daten.</div>
      <div class="grid">
        <div class="field full">
          <label>Firmen- / Name *</label>
          <input type="text" name="seller_name" required value="<?= h($old['seller_name'] ?? '') ?>">
        </div>
        <div class="field full">
          <label>Straße + Hausnummer *</label>
          <input type="text" name="seller_street" required value="<?= h($old['seller_street'] ?? '') ?>">
        </div>
        <div class="field">
          <label>PLZ *</label>
          <input type="text" name="seller_zip" required value="<?= h($old['seller_zip'] ?? '') ?>">
        </div>
        <div class="field">
          <label>Ort *</label>
          <input type="text" name="seller_city" required value="<?= h($old['seller_city'] ?? '') ?>">
        </div>
        <div class="field">
          <label>Land (ISO 2) *</label>
          <input type="text" name="seller_country" required value="<?= h($old['seller_country'] ?? 'DE') ?>" maxlength="2" pattern="[A-Z]{2}" placeholder="DE">
        </div>
        <div class="field">
          <label>E-Mail <span class="opt">(für Rückfragen)</span></label>
          <input type="email" name="seller_email" value="<?= h($old['seller_email'] ?? '') ?>">
        </div>
        <div class="field">
          <label>USt-IdNr. <span class="opt">(z. B. DE123456789)</span></label>
          <input type="text" name="seller_vat_id" value="<?= h($old['seller_vat_id'] ?? '') ?>">
        </div>
        <div class="field">
          <label>Steuernummer <span class="opt">(falls keine USt-IdNr.)</span></label>
          <input type="text" name="seller_tax_id" value="<?= h($old['seller_tax_id'] ?? '') ?>">
        </div>
      </div>
    </div>

    <!-- ═══ 4. Käufer ═══ -->
    <div class="section">
      <h2>4. Käufer (Rechnungsempfänger)</h2>
      <div class="hint">Das Unternehmen, an das die Rechnung geht.</div>
      <div class="grid">
        <div class="field full">
          <label>Firmen- / Name *</label>
          <input type="text" name="buyer_name" required value="<?= h($old['buyer_name'] ?? '') ?>">
        </div>
        <div class="field full">
          <label>Straße + Hausnummer *</label>
          <input type="text" name="buyer_street" required value="<?= h($old['buyer_street'] ?? '') ?>">
        </div>
        <div class="field">
          <label>PLZ *</label>
          <input type="text" name="buyer_zip" required value="<?= h($old['buyer_zip'] ?? '') ?>">
        </div>
        <div class="field">
          <label>Ort *</label>
          <input type="text" name="buyer_city" required value="<?= h($old['buyer_city'] ?? '') ?>">
        </div>
        <div class="field">
          <label>Land (ISO 2) *</label>
          <input type="text" name="buyer_country" required value="<?= h($old['buyer_country'] ?? 'DE') ?>" maxlength="2" pattern="[A-Z]{2}">
        </div>
        <div class="field">
          <label>USt-IdNr. des Empfängers <span class="opt">(optional)</span></label>
          <input type="text" name="buyer_vat_id" value="<?= h($old['buyer_vat_id'] ?? '') ?>">
        </div>
      </div>
    </div>

    <!-- ═══ 5. Positionen ═══ -->
    <div class="section">
      <h2>5. Rechnungspositionen</h2>
      <div class="hint">Mindestens eine Position. Einzelpreise <strong>netto</strong>, Steuersatz in %.</div>

      <div class="positions">
        <div class="head">Bezeichnung</div>
        <div class="head">Menge</div>
        <div class="head">Einheit</div>
        <div class="head">Einzelpreis €</div>
        <div class="head">MwSt %</div>
        <div class="head"></div>

        <template id="position-row">
          <input type="text"   name="pos_description[]" placeholder="z. B. Beratungsleistung" required>
          <input type="number" name="pos_quantity[]"    placeholder="1"    step="0.01" min="0" required value="1" class="js-calc">
          <input type="text"   name="pos_unit[]"        placeholder="Std." value="Std." required>
          <input type="number" name="pos_unit_price[]"  placeholder="0,00" step="0.01" min="0" required class="js-calc">
          <input type="number" name="pos_tax_rate[]"    placeholder="19"   step="0.01" min="0" max="100" required value="19" class="js-calc">
          <button type="button" class="remove" title="Position entfernen">×</button>
        </template>

        <div id="positions-container" style="display:contents;"></div>
      </div>

      <div class="positions-tools">
        <button type="button" class="btn-ghost" id="add-position">+ weitere Position</button>
      </div>

      <div class="total-preview">
        <span>Geschätzte Summe (brutto, live berechnet)</span>
        <span class="value" id="total-preview">0,00 €</span>
      </div>
    </div>

    <!-- ═══ 6. Zahlungsbedingungen ═══ -->
    <div class="section">
      <h2>6. Zahlungsbedingungen</h2>
      <div class="hint">Für SEPA-Überweisung (das gängigste Szenario im DACH-B2B).</div>
      <div class="grid">
        <div class="field">
          <label>Fälligkeit <span class="opt">(Datum)</span></label>
          <input type="date" name="payment_due" value="<?= h($old['payment_due'] ?? date('Y-m-d', strtotime('+14 days'))) ?>">
        </div>
        <div class="field">
          <label>Zahlungsziel-Text</label>
          <input type="text" name="payment_terms" value="<?= h($old['payment_terms'] ?? 'Zahlbar innerhalb von 14 Tagen ohne Abzug.') ?>">
        </div>
        <div class="field">
          <label>IBAN *</label>
          <input type="text" name="payment_iban" required placeholder="DE12 …" value="<?= h($old['payment_iban'] ?? '') ?>">
        </div>
        <div class="field">
          <label>BIC <span class="opt">(optional bei DE-IBAN)</span></label>
          <input type="text" name="payment_bic" value="<?= h($old['payment_bic'] ?? '') ?>">
        </div>
        <div class="field full">
          <label>Kontoinhaber / Bank <span class="opt">(freitext)</span></label>
          <input type="text" name="payment_holder" placeholder="z. B. Max Mustermann / Sparkasse XY" value="<?= h($old['payment_holder'] ?? '') ?>">
        </div>
      </div>
    </div>

    <button type="submit" class="submit">
      X-Rechnung erzeugen (PDF/A-3 mit eingebettetem XML)
    </button>

    </div><!-- /.form-body -->
  </form>

  <div class="legal">
    <strong>Hinweis:</strong> Dieses Tool erzeugt eine technisch konforme E-Rechnung
    (EN 16931, ZUGFeRD 2.3 Comfort / EN16931-Profil). Die <em>inhaltliche</em> Richtigkeit
    der Rechnung — insbesondere Steuersätze, Umkehrung der Steuerschuldnerschaft,
    Kleinunternehmerregelung nach § 19 UStG, Auslandssachverhalte — liegt bei Ihnen bzw.
    Ihrer Steuerberatung. NexaSign stellt nur das Format bereit, keine Steuer- oder
    Rechtsberatung.
  </div>

</main>

<script>
(() => {
  const tpl = document.getElementById('position-row');
  const container = document.getElementById('positions-container');
  const addBtn = document.getElementById('add-position');
  const totalEl = document.getElementById('total-preview');

  const fmt = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

  function recalc() {
    let total = 0;
    container.querySelectorAll('.position-row').forEach((row) => {
      const q  = parseFloat(row.querySelector('[name="pos_quantity[]"]').value) || 0;
      const p  = parseFloat(row.querySelector('[name="pos_unit_price[]"]').value) || 0;
      const t  = parseFloat(row.querySelector('[name="pos_tax_rate[]"]').value) || 0;
      total += q * p * (1 + t/100);
    });
    totalEl.textContent = fmt.format(total);
  }

  function addRow() {
    const frag = tpl.content.cloneNode(true);
    const wrap = document.createElement('div');
    wrap.className = 'position-row';
    wrap.style.display = 'contents';
    // Alle Nachfahren umwickeln, damit die grid-Zellen direkt angeordnet sind:
    while (frag.firstChild) wrap.appendChild(frag.firstChild);
    container.appendChild(wrap);

    wrap.querySelector('.remove').addEventListener('click', () => {
      if (container.querySelectorAll('.position-row').length > 1) {
        wrap.remove(); recalc();
      }
    });
    wrap.querySelectorAll('.js-calc, [name="pos_unit_price[]"], [name="pos_quantity[]"], [name="pos_tax_rate[]"]').forEach(el => {
      el.addEventListener('input', recalc);
    });
  }

  addBtn.addEventListener('click', addRow);
  addRow(); // erste Zeile beim Laden

  // Upload-Feld + Auto-Extraktion
  const box      = document.getElementById('upload-box');
  const inp      = document.getElementById('pdf-input');
  const lbl      = document.getElementById('upload-label');
  const result   = document.getElementById('extract-result');
  const formBody = document.getElementById('form-body');

  async function extractFromPdf(file) {
    const fd = new FormData();
    fd.append('pdf', file);
    box.classList.add('uploading');
    result.classList.remove('visible', 'err');

    let data;
    try {
      const res = await fetch('/vorlagen/x-rechnung/extract', { method: 'POST', body: fd });
      data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || ('HTTP ' + res.status));
    } catch (e) {
      box.classList.remove('uploading');
      result.classList.add('visible', 'err');
      // XSS-safe: e.message könnte aus einer bösen Server-JSON stammen. textContent escaped.
      result.textContent = '';
      const strong = document.createElement('strong');
      strong.textContent = 'Konnte nichts auslesen: ';
      result.append(strong, (e.message || 'Unbekannter Fehler') + ' — Formular bitte manuell befüllen.');
      formBody.classList.add('visible');
      return;
    }
    box.classList.remove('uploading');
    box.classList.add('done');

    const ex = data.extracted || {};
    const applied = applyExtracted(ex);
    const count = applied.length;

    result.classList.add('visible');
    if (count > 0) {
      result.innerHTML = '<strong>✓ ' + count + ' Feld' + (count === 1 ? '' : 'er') + ' automatisch erkannt.</strong> '
                      + 'Bitte prüfen und fehlende Angaben ergänzen.';
    } else {
      result.innerHTML = '<strong>Keine Felder automatisch erkannt</strong> — das PDF enthält vermutlich keinen Text '
                      + '(gescannt?). Bitte die Felder manuell ausfüllen.';
    }
    formBody.classList.add('visible');
  }

  // Extracted-Daten ins Formular schreiben, Feld als „auto-gefüllt" markieren
  function setField(name, value) {
    if (value == null || value === '') return false;
    const el = document.querySelector('[name="' + name + '"]');
    if (!el) return false;
    el.value = String(value);
    el.classList.add('auto-filled');
    // Unsetze die Markierung bei User-Edit
    el.addEventListener('input', () => el.classList.remove('auto-filled'), { once: true });
    return true;
  }

  function applyExtracted(ex) {
    const fields = [
      'invoice_number', 'invoice_date', 'service_date', 'currency',
      'buyer_reference',
      'seller_name', 'seller_street', 'seller_zip', 'seller_city', 'seller_country',
      'seller_email', 'seller_vat_id', 'seller_tax_id',
      'buyer_name', 'buyer_street', 'buyer_zip', 'buyer_city', 'buyer_country', 'buyer_vat_id',
      'payment_iban', 'payment_bic', 'payment_holder',
    ];
    const applied = [];
    fields.forEach(f => { if (setField(f, ex[f])) applied.push(f); });

    // Positionen — wenn eine vorhanden ist, die erste Default-Zeile überschreiben
    if (Array.isArray(ex.positions) && ex.positions.length > 0) {
      const pos = ex.positions[0];
      const row = container.querySelector('.position-row');
      if (row) {
        const setPos = (selector, value) => {
          const el = row.querySelector(selector);
          if (el && value != null) {
            el.value = String(value);
            el.classList.add('auto-filled');
            el.addEventListener('input', () => el.classList.remove('auto-filled'), { once: true });
            applied.push(selector);
          }
        };
        setPos('[name="pos_description[]"]', pos.description);
        setPos('[name="pos_quantity[]"]',    pos.quantity);
        setPos('[name="pos_unit[]"]',        pos.unit);
        setPos('[name="pos_unit_price[]"]',  pos.unit_price);
        setPos('[name="pos_tax_rate[]"]',    pos.tax_rate);
        recalc();
      }
    }
    return applied;
  }

  inp.addEventListener('change', () => {
    if (inp.files && inp.files[0]) {
      // XSS-safe: DOM-Konstruktion statt innerHTML mit user-controlled file name.
      // Ein PDF kann einen Dateinamen mit HTML-/Script-Zeichen tragen — textContent escaped.
      lbl.textContent = '';
      lbl.append('📄 ');
      const span = document.createElement('span');
      span.className = 'filename';
      span.textContent = inp.files[0].name;
      lbl.append(span);
      extractFromPdf(inp.files[0]);
    }
  });
  ['dragover','dragenter'].forEach(ev => box.addEventListener(ev, e => { e.preventDefault(); box.classList.add('drag'); }));
  ['dragleave','drop'].forEach(ev => box.addEventListener(ev, e => { e.preventDefault(); box.classList.remove('drag'); }));
  box.addEventListener('drop', e => {
    if (e.dataTransfer.files.length) {
      inp.files = e.dataTransfer.files;
      inp.dispatchEvent(new Event('change'));
    }
  });
})();
</script>

<?php require __DIR__ . "/../_footer.php"; ?>
</body>
</html>
