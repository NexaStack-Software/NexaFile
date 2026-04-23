<?php
// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors. Based on NexaSign (AGPL-3.0).
/**
 * Sicherer Markdown-Download-Handler für die Vorlagen.
 */
declare(strict_types=1);

const MD_DIR = '/var/www/nexasign/vorlagen/source-md/';

$file = (string)($_GET['file'] ?? '');
if (!preg_match('/^[0-9a-z][0-9a-z-]*\.md$/', $file)) {
    http_response_code(400);
    exit('Ungültiger Dateiname.');
}

$path = MD_DIR . $file;
if (!is_file($path) || !is_readable($path)) {
    http_response_code(404);
    exit('Vorlage nicht gefunden.');
}

header('Content-Type: text/markdown; charset=UTF-8');
header('Content-Disposition: attachment; filename="NexaSign-' . basename($file) . '"');
header('Content-Length: ' . (string)filesize($path));
header('Cache-Control: public, max-age=3600');
readfile($path);
