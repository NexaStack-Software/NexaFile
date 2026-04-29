// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors
import { env } from '@nexasign/lib/utils/env';

import { dbDiscoveryReader } from './readers/db-reader';
import { nullDiscoveryReader } from './readers/null-reader';
import { paperlessDiscoveryReader } from './readers/paperless-reader';
import type { DiscoveryReader } from './types';

/**
 * Wählt den Discovery-Reader anhand der Environment-Konfiguration.
 *
 * NEXT_PRIVATE_DISCOVERY_TRANSPORT bestimmt das Backend:
 *   - "db" (Default) → liest aus der DiscoveryDocument-Tabelle. Source-Sync
 *                       (IMAP, später Cloud) und manueller Upload schreiben dort
 *                       hinein.
 *   - "paperless"    → externer Indexdienst per REST.
 *   - "null"         → Stub, leere Listen.
 *
 * Der Aufrufer kennt nur das `DiscoveryReader`-Interface.
 */
export const getDiscoveryReader = (): DiscoveryReader => {
  const transport = env('NEXT_PRIVATE_DISCOVERY_TRANSPORT') ?? 'db';

  if (transport === 'paperless') {
    return paperlessDiscoveryReader;
  }
  if (transport === 'null') {
    return nullDiscoveryReader;
  }
  return dbDiscoveryReader;
};

/**
 * True, wenn der aktive Reader echte Daten liefern kann (kein null-Stub).
 */
export const isDiscoveryConfigured = (): boolean => {
  return getDiscoveryReader().id !== 'null';
};
