// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors. Independent re-implementation.
//
// Einheitlicher Fehler für Enterprise-Features, die in der NexaSign-AGPL-
// Edition bewusst deaktiviert sind. Wir werfen statt silent-no-op, damit
// Fehlkonfigurationen (z.B. jemand ruft `createCheckoutSession` im UI auf)
// laut scheitern und im Log sichtbar sind.
import { AppError, AppErrorCode } from '@nexasign/lib/errors/app-error';

export const notAvailable = (feature: string): AppError =>
  new AppError(AppErrorCode.UNKNOWN_ERROR, {
    message:
      `Feature „${feature}" gehört zur NexaSign Enterprise Edition und ist in ` +
      `der NexaSign-AGPL-Edition nicht verfügbar. Siehe packages/ee/FEATURES.`,
  });
