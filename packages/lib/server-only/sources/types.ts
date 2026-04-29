// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors
import type { SourceKind } from '@prisma/client';

/**
 * Ausführungs-Kontext für einen Sync-Lauf eines konkreten Source-Records.
 * Die Source-Konfig (host, port, credentials, …) ist bereits entschlüsselt,
 * der Adapter muss nicht mit `encryptedConfig` umgehen.
 */
export type SourceSyncContext = {
  sourceId: string;
  userId: number;
  teamId: number;
  /** Letzter erfolgreicher Sync-Zeitpunkt; null = erster Lauf (Backfill). */
  since: Date | null;
  /** Adapter-spezifische Konfig nach Decrypt. Adapter validiert selbst. */
  decryptedConfig: unknown;
};

export type SourceSyncResult = {
  imported: number;
  failed: number;
  errors?: string[];
};

export type TestConnectionInput = {
  config: unknown;
};

export type TestConnectionResult = {
  ok: boolean;
  error?: string;
};

/**
 * SourceAdapter-Interface — pro Source-Typ (IMAP, später Cloud) eine
 * Implementierung. Der Adapter ist der Schreib-Pfad in `DiscoveryDocument`;
 * der Lese-Pfad lebt im DiscoveryReader (db-reader).
 */
export interface SourceAdapter {
  readonly kind: SourceKind;

  /** Verbindungstest gegen die übergebene Konfig — kein Schreib-Effekt. */
  testConnection(input: TestConnectionInput): Promise<TestConnectionResult>;

  /** Echter Sync-Lauf: zieht neue Belege, schreibt DiscoveryDocument. */
  sync(ctx: SourceSyncContext): Promise<SourceSyncResult>;
}
