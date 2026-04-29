// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors

/**
 * Klassifizierungs-Keywords für die IMAP-Discovery-Heuristik.
 *
 * Direkte Portierung aus dem Prototyp-Script (`Rechnungen erstellen/rechnungen.py`)
 * mit den Listen, die sich dort über Monate stabilisiert haben.
 */

/** Stichwörter, die auf eine Rechnungs-/Beleg-Mail hindeuten (Betreff oder Body). */
export const RECHNUNG_KEYWORDS: ReadonlyArray<string> = [
  'rechnung',
  'invoice',
  'beleg',
  'receipt',
  'quittung',
  'zahlungsbestätigung',
  'zahlungsbestaetigung',
  'payment confirmation',
  'abrechnung',
  'gutschrift',
  'kreditnote',
  'credit note',
  'auftragsbestätigung',
  'auftragsbestaetigung',
  'order confirmation',
];

/** Absender-Domains, die wir als verlässliche Beleg-Quellen kennen. */
export const KNOWN_RECHNUNG_DOMAINS: ReadonlyArray<string> = [
  'hetzner.com',
  'hetzner.de',
  'netcup.de',
  'netcup.eu',
  'all-inkl.com',
  'all-inkl.de',
  'strato.de',
  'strato.com',
  'anthropic.com',
  'openai.com',
  'cloudflare.com',
  'godaddy.com',
  'deutschepost.de',
  'uber.com',
  'flixbus.de',
  'amazon.de',
  'amazon.com',
  'paypal.com',
  'paypal.de',
  'telekom.de',
  'vodafone.de',
  'o2.de',
  '1und1.de',
  'ionos.de',
  'premiumsim.de',
  'congstar.de',
  'stripe.com',
  'suno.com',
  'github.com',
  'gitlab.com',
  'google.com',
  'microsoft.com',
  'apple.com',
  'wise.com',
  'n26.com',
  'dkb.de',
  'comdirect.de',
  'ing.de',
];

/** Mails, die diese Begriffe enthalten, gelten als Werbung/Newsletter und werden ignoriert. */
export const IGNORE_KEYWORDS: ReadonlyArray<string> = [
  'newsletter',
  'unsubscribe',
  'abmelden',
  'sale',
  'rabatt',
  '% off',
];

/**
 * Portal-Hinweise — Mail enthält Beleg-Indikator, aber kein PDF-Anhang.
 * Heißt: User muss sich im Kunden-Portal einloggen und dort die PDF ziehen.
 */
export const PORTAL_HINTS: ReadonlyArray<string> = [
  'im kundenportal',
  'im kundencenter',
  'in der servicewelt',
  'in ihrem konto',
  'im kundenlogin',
  'in ihrem account',
  'einloggen unter',
  'log in to',
  'anmelden unter',
  'rechnung abrufen',
  'rechnung steht zum download bereit',
  'view your invoice',
  'im ccp',
  'control panel',
];
