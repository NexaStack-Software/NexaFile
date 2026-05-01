// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors
import { prisma } from '@nexasign/prisma';

import { putFileServerSide } from '../../universal/upload/put-file.server';
import { createDocumentData } from '../document-data/create-document-data';

export type UploadIntakeDocumentInput = {
  teamId: number;
  userId: number;
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
};

/**
 * Manueller Datei-Upload — schreibt direkt in `DiscoveryDocument` mit
 * `providerSource: 'local'`. Lebt im Intake-Pfad (Schritt 2 des Lifecycles
 * „Dokumente erstellen/ablegen"), nicht in Discovery (Schritt 1 = „Finden").
 *
 * Für Welle 1 ist diese Funktion nur als geparkte Endstelle aufgehoben — die
 * UI darunter wird in einem späteren Schritt aufgebaut. Backend ist bereits
 * funktionsfähig.
 */
export const uploadIntakeDocument = async (input: UploadIntakeDocumentInput) => {
  const { teamId, userId, fileName, contentType, bytes } = input;

  const filename = fileName || 'dokument.pdf';
  const file = {
    name: filename,
    type: contentType || 'application/pdf',
    arrayBuffer: async () =>
      Promise.resolve(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)),
  };

  const documentData = await putFileServerSide(file);
  const dataRecord = await createDocumentData({
    type: documentData.type,
    data: documentData.data,
  });

  const titleFromFile = filename.replace(/\.[^.]+$/, '');

  return prisma.discoveryDocument.create({
    data: {
      teamId,
      uploadedById: userId,
      title: titleFromFile || filename,
      capturedAt: new Date(),
      status: 'INBOX',
      providerSource: 'local',
      contentType,
      fileSize: bytes.byteLength,
      tags: [],
      dataId: dataRecord.id,
    },
  });
};
