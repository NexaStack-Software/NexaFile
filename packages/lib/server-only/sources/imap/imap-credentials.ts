// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors
import { symmetricDecrypt, symmetricEncrypt } from '@nexasign/lib/universal/crypto';
import { env } from '@nexasign/lib/utils/env';

import { type ImapAccountConfig, ZImapAccountConfigSchema } from './types';

/**
 * IMAP-Credential-Encryption — eigener Key (`NEXT_PRIVATE_IMAP_CREDENTIAL_KEY`),
 * damit IMAP-Passwörter / OAuth-Refresh-Tokens unabhängig von anderen NexaFile-
 * Secrets rotiert werden können. Fallback-Kette für gestaffelte Migration:
 * primär `NEXT_PRIVATE_IMAP_CREDENTIAL_KEY`, sekundär das Secondary-Key
 * (Vermeidung eines harten Bruchs bei Bestandsinstallationen, die noch keinen
 * eigenen IMAP-Key gesetzt haben).
 *
 * keyVersion-Tracking: jeder Ciphertext landet zusammen mit `keyVersion` in der
 * DB. Aktuell nur `"v1"`. Bei Rotation: neue Records bekommen `"v2"`, alte
 * werden mit `"v1"`-Schlüssel weiter entschlüsselt, bis ein Re-Encrypt-Job sie
 * migriert.
 */

export const CURRENT_KEY_VERSION = 'v1';

const getCurrentKey = (): string => {
  const imapKey = env('NEXT_PRIVATE_IMAP_CREDENTIAL_KEY');
  if (imapKey && imapKey.length >= 32) {
    return imapKey;
  }

  const fallback = env('NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY');
  if (fallback && fallback.length >= 32) {
    return fallback;
  }

  throw new Error(
    'IMAP-Credential-Verschlüsselung nicht möglich: weder NEXT_PRIVATE_IMAP_CREDENTIAL_KEY ' +
      'noch NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY ist gesetzt (oder beide < 32 Zeichen).',
  );
};

const getKeyForVersion = (keyVersion: string): string => {
  if (keyVersion === CURRENT_KEY_VERSION) {
    return getCurrentKey();
  }
  throw new Error(`Unbekannte IMAP-Credential-Key-Version: ${keyVersion}`);
};

export type EncryptedImapConfig = {
  ciphertext: string;
  keyVersion: string;
};

export const encryptImapConfig = (config: ImapAccountConfig): EncryptedImapConfig => {
  ZImapAccountConfigSchema.parse(config);

  const key = getCurrentKey();
  const ciphertext = symmetricEncrypt({
    key,
    data: JSON.stringify(config),
  });

  return {
    ciphertext,
    keyVersion: CURRENT_KEY_VERSION,
  };
};

export const decryptImapConfig = (input: EncryptedImapConfig): ImapAccountConfig => {
  const key = getKeyForVersion(input.keyVersion);
  const bytes = symmetricDecrypt({ key, data: input.ciphertext });
  const json = new TextDecoder('utf-8').decode(bytes);
  const parsed = JSON.parse(json);
  return ZImapAccountConfigSchema.parse(parsed);
};
