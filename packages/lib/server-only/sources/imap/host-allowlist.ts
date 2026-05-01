// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors
import { promises as dns } from 'node:dns';

import { env } from '@nexasign/lib/utils/env';

/**
 * SSRF-Schutz für die User-eingegebene IMAP-Host-Adresse.
 *
 * Default: harte Allowlist von Mainstream-Providern. Power-User können via
 * `NEXT_PRIVATE_IMAP_ALLOW_CUSTOM_HOSTS=true` eigene Hosts erlauben — dann
 * wird der Host per DNS aufgelöst und gegen private/loopback/Tailscale-Ranges
 * geprüft.
 *
 * Port: nur 993 (IMAPS) und 143 (STARTTLS) erlaubt.
 */

const DEFAULT_ALLOWLIST: ReadonlyArray<string> = [
  'imap.gmail.com',
  'outlook.office365.com',
  'imap.fastmail.com',
  'secureimap.t-online.de',
  'imap.web.de',
  'imap.gmx.net',
  'imap.gmx.de',
  'imap.mail.me.com',
  'imap.mail.yahoo.com',
  'mailbox.org',
  'imap.posteo.de',
];

const ALLOWED_PORTS = new Set([993, 143]);

/**
 * Liest die effektive Allowlist aus Env (`NEXT_PRIVATE_IMAP_HOST_ALLOWLIST`,
 * komma-getrennt) und mergt mit den Defaults. Default-Liste bleibt immer dabei
 * — User-Erweiterung kommt obendrauf.
 */
const readAllowlist = (): Set<string> => {
  const raw = env('NEXT_PRIVATE_IMAP_HOST_ALLOWLIST');
  const extra = raw
    ? raw
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    : [];
  return new Set([...DEFAULT_ALLOWLIST.map((h) => h.toLowerCase()), ...extra]);
};

const customHostsAllowed = (): boolean => {
  return env('NEXT_PRIVATE_IMAP_ALLOW_CUSTOM_HOSTS') === 'true';
};

export type HostValidationResult = {
  ok: boolean;
  reason?: string;
};

const isPrivateIPv4 = (ip: string): boolean => {
  const parts = ip.split('.').map((n) => parseInt(n, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a, b] = parts;
  // RFC1918
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  // Loopback
  if (a === 127) return true;
  // Link-local
  if (a === 169 && b === 254) return true;
  // CGNAT (RFC6598) — auch von Tailscale genutzt (100.64.0.0/10).
  if (a === 100 && b >= 64 && b <= 127) return true;
  // Multicast / reserved
  if (a >= 224) return true;
  // Broadcast
  if (a === 255) return true;
  // 0.0.0.0/8 — „this network", nicht routbar.
  if (a === 0) return true;
  return false;
};

const isPrivateIPv6 = (ip: string): boolean => {
  const lower = ip.toLowerCase();
  // Loopback
  if (lower === '::1') return true;
  // Unspecified
  if (lower === '::') return true;
  // Link-local fe80::/10
  if (
    lower.startsWith('fe80:') ||
    lower.startsWith('fe8') ||
    lower.startsWith('fe9') ||
    lower.startsWith('fea') ||
    lower.startsWith('feb')
  ) {
    return true;
  }
  // Unique local fc00::/7
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  // IPv4-mapped (::ffff:a.b.c.d) — auf v4-Logik abbilden
  const v4MappedMatch = lower.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (v4MappedMatch) {
    return isPrivateIPv4(v4MappedMatch[1]);
  }
  // Multicast ff00::/8
  if (lower.startsWith('ff')) return true;
  return false;
};

const isPrivateAddress = (ip: string): boolean => {
  if (ip.includes(':')) return isPrivateIPv6(ip);
  return isPrivateIPv4(ip);
};

const isIpLiteral = (host: string): boolean => /^[\d.]+$/.test(host) || host.includes(':');

/**
 * Prüft Host + Port. Bei Custom-Host-Zulassung wird DNS aufgelöst und gegen
 * private Ranges geprüft. Bei IP-Literal als Host wird sofort die Range-Prüfung
 * angewendet (ohne DNS-Round-Trip).
 */
export const validateImapHost = async (
  host: string,
  port: number,
): Promise<HostValidationResult> => {
  if (!ALLOWED_PORTS.has(port)) {
    return {
      ok: false,
      reason: `Port ${port} nicht erlaubt — nur 993 (IMAPS) oder 143 (STARTTLS).`,
    };
  }

  const normalized = host.trim().toLowerCase();
  if (!normalized) {
    return { ok: false, reason: 'Host darf nicht leer sein.' };
  }

  // Mainstream-Provider: keine DNS-Auflösung nötig, Allowlist matcht direkt.
  const allowlist = readAllowlist();
  if (allowlist.has(normalized)) {
    return { ok: true };
  }

  // Custom-Hosts nur, wenn explizit per Env erlaubt.
  if (!customHostsAllowed()) {
    return {
      ok: false,
      reason:
        'Eigene IMAP-Hosts sind nicht freigeschaltet. Bitte einen der unterstützten Anbieter auswählen oder den Betreiber bitten, NEXT_PRIVATE_IMAP_ALLOW_CUSTOM_HOSTS zu aktivieren.',
    };
  }

  // IP-Literal: direkt prüfen, kein DNS-Round-Trip.
  if (isIpLiteral(normalized)) {
    if (isPrivateAddress(normalized)) {
      return {
        ok: false,
        reason: 'Ziel-Adresse liegt in einem privaten oder reservierten Bereich.',
      };
    }
    return { ok: true };
  }

  // Hostname: DNS-Auflösung gegen private Ranges prüfen.
  let addresses: string[] = [];
  try {
    const lookup = await dns.lookup(normalized, { all: true });
    addresses = lookup.map((entry) => entry.address);
  } catch (err) {
    return {
      ok: false,
      reason: `Host ${normalized} ist per DNS nicht auflösbar.`,
    };
  }

  if (addresses.length === 0) {
    return { ok: false, reason: `Host ${normalized} liefert keine IP-Adressen.` };
  }

  for (const addr of addresses) {
    if (isPrivateAddress(addr)) {
      return {
        ok: false,
        reason: `Host ${normalized} löst auf eine private/reservierte Adresse auf (${addr}).`,
      };
    }
  }

  return { ok: true };
};

/**
 * Liefert die Liste der ohne Custom-Host-Freigabe verwendbaren Mainstream-
 * Provider. Wird vom UI für Auswahl-Dropdown genutzt.
 */
export const getDefaultImapHostAllowlist = (): ReadonlyArray<string> => {
  return [...DEFAULT_ALLOWLIST];
};

export const isCustomImapHostsAllowed = customHostsAllowed;
