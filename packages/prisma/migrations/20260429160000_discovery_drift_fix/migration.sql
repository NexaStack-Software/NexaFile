-- Discovery-Drift-Fix
-- Zwei Korrekturen nach Welle 2 Review:
--   1. DiscoveryDocument.dataId nullable — MANUAL-Belege haben kein PDF
--   2. Source.teamId Pflicht — User wählt beim Anlegen das Ziel-Team

-- =============================================================================
-- 1. DiscoveryDocument.dataId nullable
-- =============================================================================

ALTER TABLE "DiscoveryDocument" ALTER COLUMN "dataId" DROP NOT NULL;

-- =============================================================================
-- 2. Source.teamId Pflicht
-- =============================================================================
-- Tabelle ist im Branch noch nicht produktiv genutzt (0 Records erwartet).
-- Falls Records existieren: Migration schlägt mit NOT NULL violation fehl —
-- Records dann manuell löschen oder mit einem Default-Team füllen.

ALTER TABLE "Source" ADD COLUMN "teamId" INTEGER NOT NULL;

CREATE INDEX "Source_teamId_idx" ON "Source"("teamId");

ALTER TABLE "Source"
  ADD CONSTRAINT "Source_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
