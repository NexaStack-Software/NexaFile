// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors
import { z } from 'zod';

/**
 * IMAP-Konfig — was im Klartext im Sync-Worker liegt. In der DB steht nur das
 * verschlüsselte JSON (Source.encryptedConfig).
 */
export const ZImapAccountConfigSchema = z.object({
  host: z.string().min(1).max(255),
  port: z.number().int().min(1).max(65535),
  username: z.string().min(1).max(255),
  password: z.string().min(1).max(1024),
  /** Default true. Auf false nur explizit, mit deutlicher UI-Warnung + Audit-Log. */
  tlsVerify: z.boolean(),
});

export type ImapAccountConfig = z.infer<typeof ZImapAccountConfigSchema>;
