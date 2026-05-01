// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors
import type { SourceKind } from '@prisma/client';

import type { SourceAdapter } from './types';

const adapters = new Map<SourceKind, SourceAdapter>();

/**
 * Adapter-Registrierung — wird vom IMAP-Modul (Welle 2) zur Modul-Initialisierung
 * aufgerufen. Sources-Router nutzt `getSourceAdapter`, um zur richtigen
 * Implementierung zu dispatchen, ohne hart darauf zu importieren.
 */
export const registerSourceAdapter = (adapter: SourceAdapter): void => {
  adapters.set(adapter.kind, adapter);
};

export const getSourceAdapter = (kind: SourceKind): SourceAdapter | undefined => {
  return adapters.get(kind);
};

export const listRegisteredKinds = (): SourceKind[] => {
  return Array.from(adapters.keys());
};
