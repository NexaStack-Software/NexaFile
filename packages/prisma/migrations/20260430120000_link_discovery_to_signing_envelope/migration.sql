-- NexaFILE Schritt 2 -> 3: ein gefundener Beleg kann ein normales
-- Signatur-Dokument erzeugen. Der Link macht die Aktion idempotent und
-- erlaubt der UI, das bereits vorbereitete Dokument wieder zu öffnen.

ALTER TYPE "DiscoveryAuditEvent" ADD VALUE 'DISCOVERY_SIGNING_DOCUMENT_CREATED';

ALTER TABLE "DiscoveryDocument"
  ADD COLUMN "signingEnvelopeId" TEXT;

CREATE UNIQUE INDEX "DiscoveryDocument_signingEnvelopeId_key"
  ON "DiscoveryDocument"("signingEnvelopeId");

ALTER TABLE "DiscoveryDocument"
  ADD CONSTRAINT "DiscoveryDocument_signingEnvelopeId_fkey"
  FOREIGN KEY ("signingEnvelopeId") REFERENCES "Envelope"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- User-sichtbarer Suchbegriff fuer manuelle Postfach-Durchlaeufe
-- (z. B. "Rechnung", "invoice", "Beleg").
ALTER TABLE "SyncRun"
  ADD COLUMN "searchTerm" TEXT;
