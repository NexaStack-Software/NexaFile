// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors

/**
 * Discovery-Schicht: Datenstrukturen für „Dokumente finden".
 *
 * Diese Typen sind backend-agnostisch. Ein Reader übersetzt zwischen seinem
 * nativen Datenmodell und diesen Typen, damit das UI den Reader nicht kennt.
 *
 * Discovery ist nur Lesen. Schreiben (Source-Sync, Upload) lebt in
 * `packages/lib/server-only/sources/` und `packages/lib/server-only/intake/`.
 */

export type DiscoveryDocumentStatus =
  | 'inbox' // Neu eingegangen, noch nicht gesichtet
  | 'pending-manual' // Hinweis erkannt, Beleg muss manuell beschafft werden
  | 'processed'; // Bereits verarbeitet (übernommen, signiert, archiviert oder ignoriert)

export type DiscoveryDocument = {
  /** Stabile, readerunabhängige ID */
  id: string;
  /** Reader-interne ID, falls für Detail-Aufrufe nötig */
  nativeId: string;
  /** Anzeigentitel des Dokuments */
  title: string;
  /** Korrespondent/Aussteller, falls erkannt */
  correspondent: string | null;
  /** Inhaltlicher Typ (z.B. „Rechnung", „Vertrag") */
  documentType: string | null;
  /** Tags vom Backend */
  tags: string[];
  /** Datum, das auf dem Dokument selbst steht (Belegdatum), falls erkannt */
  documentDate: Date | null;
  /** Wann es im Discovery-Backend aufgetaucht ist */
  capturedAt: Date;
  /** Lifecycle-Status aus Sicht des NexaSign-Nutzers */
  status: DiscoveryDocumentStatus;
};

export type DiscoveryFilter = {
  query?: string;
  status?: DiscoveryDocumentStatus;
  correspondent?: string;
  documentDateFrom?: Date;
  documentDateTo?: Date;
};

export type DiscoveryPage = {
  documents: DiscoveryDocument[];
  total: number;
  nextCursor: string | null;
};

/**
 * Ausführungs-Kontext aus der Session. Reader, die Multi-Tenancy unterstützen
 * (DB-Reader für lokale Uploads + IMAP-Sync), nutzen teamId/userId. Externe
 * Reader (Paperless) ignorieren das Feld.
 */
export type DiscoveryContext = {
  teamId?: number;
  userId?: number;
};

export type DiscoveryReader = {
  /** Lesbarer Name für Logging/Diagnose, nie dem Nutzer angezeigt */
  readonly id: string;

  findDocuments(
    filter: DiscoveryFilter,
    cursor?: string | null,
    ctx?: DiscoveryContext,
  ): Promise<DiscoveryPage>;

  getDocument(id: string, ctx?: DiscoveryContext): Promise<DiscoveryDocument | null>;

  getDocumentContent(id: string, ctx?: DiscoveryContext): Promise<Uint8Array | null>;
};
