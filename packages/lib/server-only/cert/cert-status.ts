import * as fs from 'node:fs';

import { env } from '@nexasign/lib/utils/env';

import { AppError, AppErrorCode } from '../../errors/app-error';

type CertificateStatus =
  | {
      isAvailable: true;
      transport: string;
      source: 'file' | 'env' | 'external';
      filePath?: string;
    }
  | {
      isAvailable: false;
      transport: string;
      source: 'file';
      filePath: string;
      reason: 'missing' | 'empty' | 'unreadable';
    };

export const getCertificateStatus = () => {
  const transport = env('NEXT_PRIVATE_SIGNING_TRANSPORT') || 'local';

  if (transport !== 'local') {
    return {
      isAvailable: true,
      transport,
      source: 'external',
    } satisfies CertificateStatus;
  }

  if (env('NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS')) {
    return {
      isAvailable: true,
      transport,
      source: 'env',
    } satisfies CertificateStatus;
  }

  const defaultPath =
    env('NODE_ENV') === 'production' ? '/opt/nexasign/cert.p12' : './example/cert.p12';

  const filePath = env('NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH') || defaultPath;

  try {
    fs.accessSync(filePath, fs.constants.F_OK | fs.constants.R_OK);

    const stats = fs.statSync(filePath);

    if (stats.size === 0) {
      return {
        isAvailable: false,
        transport,
        source: 'file',
        filePath,
        reason: 'empty',
      } satisfies CertificateStatus;
    }

    return {
      isAvailable: true,
      transport,
      source: 'file',
      filePath,
    } satisfies CertificateStatus;
  } catch {
    const reason = fs.existsSync(filePath) ? 'unreadable' : 'missing';

    return {
      isAvailable: false,
      transport,
      source: 'file',
      filePath,
      reason,
    } satisfies CertificateStatus;
  }
};

export const assertSigningCertificateConfigured = () => {
  const status = getCertificateStatus();

  if (status.isAvailable) {
    return status;
  }

  throw new AppError(AppErrorCode.NOT_SETUP, {
    message: `Signing certificate is not available at ${status.filePath} (${status.reason}).`,
    userMessage:
      'NexaFile needs a signing certificate before documents can be sent for signature. Configure cert.p12 or run scripts/nexasign/generate-dev-cert.sh for a test certificate.',
  });
};
