<?php
// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors. Based on NexaSign (AGPL-3.0).
/**
 * NexaSign — X-Rechnung: Daten aus Rechnungs-PDF extrahieren.
 *
 * Nimmt ein hochgeladenes PDF entgegen, extrahiert Text via smalot/pdfparser
 * (pure PHP, keine externe API — DSGVO-safe, Daten verlassen den Server nicht),
 * und versucht die typischen deutschen Rechnungsfelder per Regex zu finden.
 *
 * Liefert JSON mit den Feldern, die zu den Form-Inputs von index.php passen.
 * Ein Feld fehlt = konnte nicht erkannt werden, User füllt manuell aus.
 */
declare(strict_types=1);

// ── Schutz gegen Parser-DoS / PDF-Bomb ──
// smalot/pdfparser ist pure PHP und kann bei bösartig konstruierten PDFs exponentiell viel
// CPU/Memory fressen. Wir begrenzen den Worker hart — schlägt die Extraktion fehl, meldet
// das Frontend sauber und der User füllt manuell.
set_time_limit(25);
ini_set('memory_limit', '256M');

require __DIR__ . '/vendor/autoload.php';

use Smalot\PdfParser\Parser;

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function fail(int $code, string $msg): never {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'POST required');

if (!isset($_FILES['pdf']) || $_FILES['pdf']['error'] !== UPLOAD_ERR_OK) {
    fail(400, 'Kein PDF empfangen.');
}
if ($_FILES['pdf']['size'] > 10 * 1024 * 1024) fail(400, 'PDF > 10 MB.');
// Zweistufige PDF-Prüfung: MIME-Erkennung via libmagic + echte Magic-Bytes.
// mime_content_type kann in seltenen Fällen (defekte libmagic-DB, manipulierte Header)
// falsch liegen; der erste PDF-Header „%PDF-" ist dagegen eindeutig.
$mime = mime_content_type($_FILES['pdf']['tmp_name']) ?: '';
if ($mime !== 'application/pdf') fail(400, 'Datei ist kein PDF.');
$fh = @fopen($_FILES['pdf']['tmp_name'], 'rb');
if ($fh === false) fail(400, 'Upload nicht lesbar.');
$magic = fread($fh, 5);
fclose($fh);
if ($magic !== '%PDF-') fail(400, 'Datei beginnt nicht mit gültigem PDF-Header.');

try {
    $parser = new Parser();
    $pdf    = $parser->parseFile($_FILES['pdf']['tmp_name']);
    $text   = $pdf->getText();
} catch (\Throwable $e) {
    error_log("[nexasign/x-rechnung/extract] " . $e->getMessage());
    fail(422, "PDF konnte nicht gelesen werden. Bitte Datei pruefen oder manuell ausfuellen.");
}

// Zeilen-normalisiert + alle-Text
$lines = preg_split('/\r\n|\r|\n/', $text) ?: [];
$lines = array_values(array_filter(array_map(fn($l) => trim(preg_replace('/\s+/u', ' ', $l)), $lines), fn($l) => $l !== ''));
$all   = implode("\n", $lines);

// ────────────────────────────────────────────────────────────
// Helfer: erste Regex-Capture zurückgeben oder null
// ────────────────────────────────────────────────────────────
function m1(string $pattern, string $haystack): ?string {
    if (preg_match($pattern, $haystack, $m)) {
        return trim($m[1] ?? '');
    }
    return null;
}

// ────────────────────────────────────────────────────────────
// Extraktoren — robust gegen Leerzeichen, Doppelpunkte, Groß/Klein
// ────────────────────────────────────────────────────────────
$extracted = [];

// Rechnungsnummer
$extracted['invoice_number'] = m1('/(?:Rechnungs?\s*-?\s*Nr\.?|Rechnungsnummer|Invoice\s*(?:No|Nr|Number))\.?\s*:?\s*([A-Za-z0-9][A-Za-z0-9\-\/._]{2,40})/u', $all);

// Rechnungsdatum (DE-Format oder ISO)
$dateRaw = m1('/(?:Rechnungs?datum|Datum|Invoice\s*Date)\.?\s*:?\s*(\d{1,2}[.\-\/]\d{1,2}[.\-\/]\d{2,4}|\d{4}-\d{1,2}-\d{1,2})/u', $all);
if ($dateRaw) {
    $ts = strtotime(str_replace('/', '.', $dateRaw));
    if ($ts !== false) $extracted['invoice_date'] = date('Y-m-d', $ts);
}

// Leistungsdatum / -zeitraum
$svcRaw = m1('/(?:Leistungs?datum|Lieferdatum|Service\s*Date)\.?\s*:?\s*(\d{1,2}[.\-\/]\d{1,2}[.\-\/]\d{2,4}|\d{4}-\d{1,2}-\d{1,2})/u', $all);
if ($svcRaw) {
    $ts = strtotime(str_replace('/', '.', $svcRaw));
    if ($ts !== false) $extracted['service_date'] = date('Y-m-d', $ts);
}

// Währung
if (stripos($all, 'EUR') !== false || str_contains($all, '€')) $extracted['currency'] = 'EUR';
elseif (stripos($all, 'CHF') !== false) $extracted['currency'] = 'CHF';
elseif (stripos($all, 'USD') !== false || str_contains($all, '$')) $extracted['currency'] = 'USD';

// IBAN — beliebige EU-IBAN, Leerzeichen ignorieren
if (preg_match('/\b([A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){10,30})\b/u', $all, $m)) {
    $extracted['payment_iban'] = preg_replace('/\s+/', '', $m[1]);
}

// BIC
if (preg_match('/\b([A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)\b/u', $all, $m)) {
    // Vermeide Kollision mit USt-IdNr./zufälligen Strings
    $bic = $m[1];
    if (strlen($bic) >= 8 && strlen($bic) <= 11) {
        $extracted['payment_bic'] = $bic;
    }
}

// Verkäufer-USt-IdNr. (DE-Format am häufigsten; Library unterstützt alle EU)
if (preg_match('/\b(DE\d{9}|AT[UU]\d{8}|CH[EE]\d{9}|FR[A-Z0-9]{2}\d{9}|IT\d{11}|NL\d{9}B\d{2})\b/u', $all, $m)) {
    $extracted['seller_vat_id'] = $m[1];
}

// Steuernummer (DE — z. B. 123/456/78901)
$extracted['seller_tax_id'] = m1('/(?:Steuer(?:nummer|-?Nr\.?)|St\.?-?Nr\.?)\s*:?\s*(\d{2,3}\s*[\/.-]\s*\d{3}\s*[\/.-]\s*\d{4,5})/u', $all);

// Beträge — Gesamt netto / USt / Gesamt brutto
function parseEuro(string $s): ?float {
    // „1.234,56" → 1234.56 ; „1,234.56" → 1234.56 ; „1234.56" → 1234.56
    $s = trim(str_replace(['€', ' ', ' '], '', $s));
    if (preg_match('/^-?\d+([.,]\d{1,2})?$/', $s)) {
        return (float) str_replace(',', '.', $s);
    }
    if (substr_count($s, ',') === 1 && substr_count($s, '.') >= 1) {
        // 1.234,56 (DE)
        return (float) str_replace(',', '.', str_replace('.', '', $s));
    }
    if (substr_count($s, '.') === 1 && substr_count($s, ',') >= 1) {
        // 1,234.56 (EN)
        return (float) str_replace(',', '', $s);
    }
    if (substr_count($s, ',') === 1) return (float) str_replace(',', '.', $s);
    return is_numeric($s) ? (float) $s : null;
}

$netTotal   = null;
$grossTotal = null;
$taxRate    = null;
$taxAmount  = null;

if (preg_match('/(?:Gesamt|Summe)\s*(?:netto|Nettobetrag|Zwischensumme)?\s*[:\.]?\s*([\d\.,]+)\s*(?:€|EUR)/iu', $all, $m)) {
    $netTotal = parseEuro($m[1]);
}
if (preg_match('/(?:Brutto(?:betrag)?|Gesamt(?:betrag)?|Rechnungs?betrag|Gesamt\s*brutto|Endbetrag|Zahlbetrag|Total)\s*[:\.]?\s*([\d\.,]+)\s*(?:€|EUR)/iu', $all, $m)) {
    $grossTotal = parseEuro($m[1]);
}
if (preg_match('/(\d{1,2}(?:[.,]\d{1,2})?)\s*%\s*(?:MwSt|USt|Mehrwertsteuer|Umsatzsteuer|VAT)/iu', $all, $m)) {
    $taxRate = (float) str_replace(',', '.', $m[1]);
} elseif (preg_match('/(?:MwSt|USt|Mehrwertsteuer|Umsatzsteuer|VAT).{0,20}?(\d{1,2}(?:[.,]\d{1,2})?)\s*%/iu', $all, $m)) {
    $taxRate = (float) str_replace(',', '.', $m[1]);
}
if (preg_match('/(?:MwSt|USt|Mehrwertsteuer|Umsatzsteuer|VAT)(?:\s*\d+%)?\s*[:\.]?\s*([\d\.,]+)\s*(?:€|EUR)/iu', $all, $m)) {
    $taxAmount = parseEuro($m[1]);
}

// Aus den drei Werten ggf. fehlende ableiten
if ($grossTotal !== null && $netTotal === null && $taxRate !== null) {
    $netTotal = round($grossTotal / (1 + $taxRate/100), 2);
}
if ($netTotal !== null && $grossTotal === null && $taxRate !== null) {
    $grossTotal = round($netTotal * (1 + $taxRate/100), 2);
}

// Als einzelne Sammel-Position ins Formular mappen (Phase 1 — einzelne Positionen
// aus einer Tabelle zuverlässig zu parsen geht mit reinem Regex nicht)
if ($netTotal !== null) {
    $extracted['positions'] = [[
        'description' => 'Rechnungssumme gemäß beigefügtem PDF',
        'quantity'    => 1,
        'unit'        => 'Pausch',
        'unit_price'  => $netTotal,
        'tax_rate'    => $taxRate ?? 19.0,
    ]];
}

// ────────────────────────────────────────────────────────────
// Adressblöcke — heuristisch: nach „An:", „Rechnungsempfänger:", oder
// typische Zeilenmuster „Straße 12 / PLZ Stadt"
// ────────────────────────────────────────────────────────────
// Rechtsform-Marker helfen, Firmennamen zuverlässiger zu erkennen.
$COMPANY_RE = '/\b(GmbH\s*(?:&\s*Co\.?\s*KG)?|AG|UG(?:\s*\(haftungsbeschränkt\))?|KG|OHG|GbR|SE|e\.?\s*K\.?|e\.?\s*V\.?|Ltd\.?|Inc\.?|S\.?A\.?|B\.?V\.?|N\.?V\.?)\b/iu';

function findZipLine(array $lines, int $startFrom = 0, ?string $excludeZip = null): ?int {
    foreach ($lines as $idx => $l) {
        if ($idx < $startFrom) continue;
        if (preg_match('/^(\d{4,5})\s+([A-Za-zÄÖÜäöüß\-\.\s]{2,})$/u', $l, $m)
            && ($excludeZip === null || $m[1] !== $excludeZip)) {
            return $idx;
        }
    }
    return null;
}

function pickName(array $lines, string $companyRe): ?string {
    // Zuerst nach expliziter Rechtsform suchen — der zuverlässigste Marker
    foreach ($lines as $l) {
        if (preg_match($companyRe, $l) && strlen($l) < 80) return $l;
    }
    // Sonst: erste „alphabetische" Zeile, die kein Adress-/Label-Text ist
    foreach ($lines as $l) {
        if (preg_match('/^[A-ZÄÖÜ][A-Za-zÄÖÜäöüß][\w\s\-\.&,]{2,58}$/u', $l)
            && !preg_match('/(Straße|Str\.|PLZ|USt|Steuer|IBAN|BIC|Tel\.|E-Mail|Rechnung|Datum)/iu', $l)
            && !preg_match('/^\d/', $l)) {
            return $l;
        }
    }
    return null;
}

function pickStreet(array $lines): ?string {
    foreach ($lines as $l) {
        if (preg_match('/^([A-ZÄÖÜ][A-Za-zÄÖÜäöüß\-\.\s]+\s+\d+[a-zA-Z]?(?:\s*-\s*\d+[a-zA-Z]?)?)\s*$/u', $l)) {
            return $l;
        }
    }
    return null;
}

// ─── Verkäufer: Briefkopf (Zeilen vor dem ersten ZIP)
$sellerZipIdx = findZipLine($lines);
if ($sellerZipIdx !== null) {
    $sellerBlock = array_slice($lines, 0, $sellerZipIdx);     // oberhalb der ZIP-Zeile
    if (preg_match('/^(\d{4,5})\s+(.+)$/u', $lines[$sellerZipIdx], $m)) {
        $extracted['seller_zip']  = $m[1];
        $extracted['seller_city'] = trim($m[2]);
    }
    if ($n = pickName($sellerBlock, $COMPANY_RE))   $extracted['seller_name']   = $n;
    if ($s = pickStreet($sellerBlock))              $extracted['seller_street'] = $s;
    $extracted['seller_country'] = 'DE';
} else {
    $extracted['seller_country'] = 'DE';
}

// ─── Käufer: nächste ZIP-Zeile, die NICHT die Verkäufer-ZIP ist
$buyerZipIdx = findZipLine($lines, ($sellerZipIdx ?? -1) + 1, $extracted['seller_zip'] ?? null);
if ($buyerZipIdx !== null) {
    $sliceStart = max(($sellerZipIdx ?? -1) + 1, $buyerZipIdx - 4);
    $buyerBlock = array_slice($lines, $sliceStart, $buyerZipIdx - $sliceStart); // nur Zeilen VOR der ZIP
    if (preg_match('/^(\d{4,5})\s+(.+)$/u', $lines[$buyerZipIdx], $m)) {
        $extracted['buyer_zip']  = $m[1];
        $extracted['buyer_city'] = trim($m[2]);
    }
    if ($n = pickName($buyerBlock, $COMPANY_RE))
        if ($n !== ($extracted['seller_name'] ?? null)) $extracted['buyer_name']   = $n;
    if ($s = pickStreet($buyerBlock))                    $extracted['buyer_street'] = $s;
    $extracted['buyer_country'] = 'DE';
}

// E-Mail (Verkäufer)
if (preg_match('/([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/u', $all, $m)) {
    $extracted['seller_email'] = $m[1];
}

// Leere / null-Werte raus
$extracted = array_filter($extracted, fn($v) => $v !== null && $v !== '');

echo json_encode([
    'ok'        => true,
    'extracted' => $extracted,
    'fields_found' => count($extracted),
    'text_length'  => strlen($text),
], JSON_UNESCAPED_UNICODE);
