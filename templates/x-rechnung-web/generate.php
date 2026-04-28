<?php
// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors. Based on NexaSign (AGPL-3.0).
/**
 * NexaSign — X-Rechnung / ZUGFeRD Generator: POST-Handler
 *
 * Flow:
 *   1. Formulardaten validieren
 *   2. Hochgeladenes PDF in Temp-Datei sichern
 *   3. ZUGFeRD-XML (EN16931-Profil) aus Form-Daten bauen via horstoeko/zugferd
 *   4. XML in das PDF einbetten (PDF/A-3)
 *   5. Result als Download ausliefern
 */
declare(strict_types=1);

// ── Schutz gegen Parser-/Renderer-DoS (PDF-Bomb, böswillig großes Input) ──
set_time_limit(30);
ini_set('memory_limit', '256M');

require __DIR__ . '/vendor/autoload.php';

use horstoeko\zugferd\ZugferdDocumentBuilder;
use horstoeko\zugferd\ZugferdProfiles;
use horstoeko\zugferd\ZugferdDocumentPdfBuilder;

// ───────────────────────────────────────────────────────────────
// 1. Input einlesen + strikt validieren
// ───────────────────────────────────────────────────────────────

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: /vorlagen/x-rechnung/', true, 303);
    exit;
}

function bail(string $msg): never {
    http_response_code(400);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Fehler</title>'
       . '<style>body{font-family:system-ui;max-width:640px;margin:3rem auto;padding:0 1rem;line-height:1.55;color:#1c1c18}'
       . 'h1{color:#c0392b;font-size:1.5rem}a{color:#9e4127}</style></head><body>'
       . '<h1>Rechnung konnte nicht erzeugt werden</h1>'
       . '<p>' . htmlspecialchars($msg, ENT_QUOTES) . '</p>'
       . '<p><a href="/vorlagen/x-rechnung/">← Zurück zum Formular</a></p></body></html>';
    exit;
}

function req(string $key): string {
    $v = trim((string)($_POST[$key] ?? ''));
    if ($v === '') bail('Pflichtfeld fehlt: ' . $key);
    return $v;
}
function opt(string $key, string $default = ''): string {
    return trim((string)($_POST[$key] ?? $default));
}

// PDF-Upload prüfen
if (!isset($_FILES['pdf']) || $_FILES['pdf']['error'] !== UPLOAD_ERR_OK) {
    bail('Bitte ein Rechnungs-PDF hochladen (max. 10 MB).');
}
$pdfTmp = $_FILES['pdf']['tmp_name'];
if ($_FILES['pdf']['size'] > 10 * 1024 * 1024) bail('PDF überschreitet 10 MB.');
$mime = mime_content_type($pdfTmp) ?: '';
if ($mime !== 'application/pdf') bail('Upload ist kein gültiges PDF (erkannt: ' . $mime . ').');
$fh = @fopen($pdfTmp, 'rb');
if ($fh === false) bail('Upload nicht lesbar.');
$magic = fread($fh, 5);
fclose($fh);
if ($magic !== '%PDF-') bail('Datei beginnt nicht mit gültigem PDF-Header.');

// Pflicht-Strings
$invoiceNo   = req('invoice_number');
$invoiceDate = req('invoice_date');
$serviceDate = req('service_date');
$currency    = strtoupper(req('currency'));

$sellerName    = req('seller_name');
$sellerStreet  = req('seller_street');
$sellerZip     = req('seller_zip');
$sellerCity    = req('seller_city');
$sellerCountry = strtoupper(req('seller_country'));

$buyerName    = req('buyer_name');
$buyerStreet  = req('buyer_street');
$buyerZip     = req('buyer_zip');
$buyerCity    = req('buyer_city');
$buyerCountry = strtoupper(req('buyer_country'));

$paymentIban  = preg_replace('/\s+/', '', req('payment_iban'));

// Positionen (parallele Arrays)
$descs  = $_POST['pos_description'] ?? [];
$qtys   = $_POST['pos_quantity']    ?? [];
$units  = $_POST['pos_unit']        ?? [];
$prices = $_POST['pos_unit_price']  ?? [];
$taxes  = $_POST['pos_tax_rate']    ?? [];

if (!is_array($descs) || count($descs) === 0) bail('Mindestens eine Rechnungsposition erforderlich.');

$positions = [];
for ($i = 0; $i < count($descs); $i++) {
    $d = trim((string)($descs[$i]  ?? ''));
    $q = (float)  str_replace(',', '.', (string)($qtys[$i]   ?? '0'));
    $u = trim((string)($units[$i]  ?? 'Std.'));
    $p = (float)  str_replace(',', '.', (string)($prices[$i] ?? '0'));
    $t = (float)  str_replace(',', '.', (string)($taxes[$i]  ?? '0'));
    if ($d === '' && $q == 0.0 && $p == 0.0) continue; // leere Zeile überspringen
    if ($d === '') bail('Position ' . ($i + 1) . ': Bezeichnung fehlt.');
    if ($q <= 0)   bail('Position ' . ($i + 1) . ': Menge muss > 0 sein.');
    if ($p < 0)    bail('Position ' . ($i + 1) . ': Einzelpreis muss ≥ 0 sein.');
    if ($t < 0 || $t > 100) bail('Position ' . ($i + 1) . ': Steuersatz muss 0–100 sein.');
    $positions[] = ['d' => $d, 'q' => $q, 'u' => $u, 'p' => $p, 't' => $t];
}
if (count($positions) === 0) bail('Keine gültigen Positionen gefunden.');

// ───────────────────────────────────────────────────────────────
// 2. UN/ECE-Unit-Mapping (nur die häufigsten, Fallback auf "C62" = Stück)
// ───────────────────────────────────────────────────────────────
function mapUnit(string $u): string {
    $u = mb_strtolower(trim($u));
    return match (true) {
        in_array($u, ['std.', 'std', 'stunde', 'stunden', 'h']) => 'HUR',
        in_array($u, ['tag', 'tage', 'd'])                       => 'DAY',
        in_array($u, ['stk', 'stk.', 'stück', 'pcs'])            => 'H87',
        in_array($u, ['pauschal', 'pausch', 'ps'])               => 'C62',
        in_array($u, ['m', 'meter'])                             => 'MTR',
        in_array($u, ['kg'])                                      => 'KGM',
        in_array($u, ['monat', 'monate', 'mo'])                   => 'MON',
        default                                                   => 'C62',
    };
}

// ───────────────────────────────────────────────────────────────
// 3. Summen berechnen (alle netto → Steuer getrennt ausgewiesen)
// ───────────────────────────────────────────────────────────────
$totalsByRate = [];  // [19.0 => ['base' => 123.45, 'tax' => 23.46], ...]
$grandNet = 0.0;
foreach ($positions as $pos) {
    $line = round($pos['q'] * $pos['p'], 2);
    $rate = (float)$pos['t'];
    if (!isset($totalsByRate[(string)$rate])) {
        $totalsByRate[(string)$rate] = ['base' => 0.0, 'tax' => 0.0];
    }
    $totalsByRate[(string)$rate]['base'] += $line;
    $grandNet += $line;
}
$grandTax = 0.0;
foreach ($totalsByRate as $rate => &$t) {
    $t['base'] = round($t['base'], 2);
    $t['tax']  = round($t['base'] * ((float)$rate / 100), 2);
    $grandTax += $t['tax'];
}
unset($t);
$grandGross = round($grandNet + $grandTax, 2);

// ───────────────────────────────────────────────────────────────
// 4. ZUGFeRD-XML erzeugen (EN16931 / „Comfort" — gültig für X-Rechnung-Gleichwertigkeit)
// ───────────────────────────────────────────────────────────────
try {
    $doc = ZugferdDocumentBuilder::createNew(ZugferdProfiles::PROFILE_EN16931);

    // Rechnungs-Kopf: „380" = kommerzielle Rechnung (UN/CEFACT doc type)
    $doc->setDocumentInformation(
        $invoiceNo,
        '380',
        \DateTime::createFromFormat('Y-m-d', $invoiceDate) ?: new \DateTime(),
        $currency
    );

    $buyerRef = opt('buyer_reference');
    if ($buyerRef !== '') {
        $doc->setDocumentBuyerReference($buyerRef);
    }

    // Verkäufer
    $doc->setDocumentSeller($sellerName)
        ->setDocumentSellerAddress($sellerStreet, '', '', $sellerZip, $sellerCity, $sellerCountry);
    $sellerVat   = opt('seller_vat_id');
    $sellerTax   = opt('seller_tax_id');
    $sellerEmail = opt('seller_email');
    if ($sellerVat !== '') $doc->addDocumentSellerTaxRegistration('VA', $sellerVat);
    if ($sellerTax !== '') $doc->addDocumentSellerTaxRegistration('FC', $sellerTax);
    // EN 16931 BR-CO-26: Verkäufer braucht mindestens einen Identifier (BT-29 / BT-30 / BT-31).
    // BT-31 (VAT-ID) wird oben gesetzt, wenn USt-IdNr. vorhanden ist. Bei Kleinunternehmern
    // ohne USt-IdNr. fällt das weg — dann setzen wir BT-29 (Seller-Identifier) aus der
    // Steuernummer oder ersatzweise aus dem Namen, damit die Rechnung EN 16931-konform bleibt.
    if ($sellerVat === '') {
        $fallbackId = $sellerTax !== '' ? $sellerTax : preg_replace('/[^A-Za-z0-9]+/', '-', $sellerName);
        if ($fallbackId !== '') $doc->addDocumentSellerId($fallbackId);
    }
    if ($sellerEmail !== '') {
        $doc->setDocumentSellerContact(null, null, null, null, $sellerEmail);
    }

    // Käufer
    $doc->setDocumentBuyer($buyerName)
        ->setDocumentBuyerAddress($buyerStreet, '', '', $buyerZip, $buyerCity, $buyerCountry);
    $buyerVat = opt('buyer_vat_id');
    if ($buyerVat !== '') $doc->addDocumentBuyerTaxRegistration('VA', $buyerVat);

    // Leistungsdatum (nur ein Datum, nicht Zeitraum — Phase-1-Vereinfachung)
    $doc->setDocumentSupplyChainEvent(\DateTime::createFromFormat('Y-m-d', $serviceDate) ?: new \DateTime());

    // Zahlung — SEPA Credit Transfer (UNCL 4461 Code 58)
    $paymentHolder = opt('payment_holder');
    $paymentBic    = opt('payment_bic');
    $doc->addDocumentPaymentMeanToCreditTransfer(
        $paymentIban,
        $paymentHolder ?: null,
        null,
        $paymentBic ?: null,
        $invoiceNo,
    );
    $paymentDue   = opt('payment_due');
    $paymentTerms = opt('payment_terms', 'Zahlbar gemäß Vereinbarung.');
    $doc->addDocumentPaymentTerm(
        $paymentTerms,
        $paymentDue !== '' ? (\DateTime::createFromFormat('Y-m-d', $paymentDue) ?: null) : null
    );

    // Positionen
    $lineNo = 0;
    foreach ($positions as $pos) {
        $lineNo++;
        $line = round($pos['q'] * $pos['p'], 2);
        $doc->addNewPosition((string)$lineNo)
            ->setDocumentPositionProductDetails($pos['d'])
            ->setDocumentPositionGrossPrice($pos['p'])
            ->setDocumentPositionNetPrice($pos['p'])
            ->setDocumentPositionQuantity($pos['q'], mapUnit($pos['u']))
            ->addDocumentPositionTax('S', 'VAT', $pos['t'])
            ->setDocumentPositionLineSummation($line);
    }

    // Steuer-Zusammenfassung
    foreach ($totalsByRate as $rate => $t) {
        $doc->addDocumentTax('S', 'VAT', $t['base'], $t['tax'], (float)$rate);
    }

    // Gesamt-Summen
    $doc->setDocumentSummation(
        $grandGross, $grandGross,         // line total, grand total (= gross)
        $grandNet,                        // sum of net
        0.0, 0.0,                         // charges / allowances
        $grandNet,                        // tax basis
        $grandTax,                        // total tax
        null,                             // rounding
        0.0                               // already paid
    );

    // ───────────────────────────────────────────────────────────
    // 5. In PDF einbetten (PDF/A-3) und zurückgeben
    // ───────────────────────────────────────────────────────────
    $outputName = preg_replace('/[^a-zA-Z0-9_-]+/', '-', $invoiceNo) . '-zugferd.pdf';
    if ($outputName === '-zugferd.pdf') $outputName = 'rechnung-zugferd.pdf';

    $pdfBuilder = new ZugferdDocumentPdfBuilder($doc, $pdfTmp);
    $pdfBuilder->generateDocument();

    // saveDocumentAs(string) — gibt das Ergebnis als String zurück? Nein, wir schreiben in Temp-File.
    $tmpOut = tempnam(sys_get_temp_dir(), 'nexasign-xrech-');
    if ($tmpOut === false) bail('Konnte temporäre Ausgabedatei nicht anlegen.');
    $pdfBuilder->saveDocument($tmpOut);

    $bytes = @file_get_contents($tmpOut);
    @unlink($tmpOut);
    if ($bytes === false || $bytes === '') bail('Generierung lieferte leeres PDF.');

    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="' . $outputName . '"');
    header('Content-Length: ' . strlen($bytes));
    header('X-Content-Type-Options: nosniff');
    echo $bytes;
    exit;

} catch (\Throwable $e) {
    error_log('[nexasign/x-rechnung] Fehler: ' . $e->getMessage() . "\n" . $e->getTraceAsString());
    bail("Technischer Fehler bei der Erzeugung. Bitte spaeter erneut versuchen.");
}
