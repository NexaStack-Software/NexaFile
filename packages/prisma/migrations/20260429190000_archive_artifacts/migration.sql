-- Archive-Artifacts + WORM-Lifecycle
--
-- 1. DiscoveryArtifact-Tabelle: pro Datei im Archiv-Ordner ein DB-Eintrag mit
--    sha256-Hash. GoBD-Beweisfähigkeit für Mail/Body/Anhänge.
-- 2. DiscoveryDocument: bodyText (Klartext für UI), bodyHasHtml-Hint, archivePath
--    (Filesystem-Ordner), acceptedAt + acceptedById (GoBD-Retention-Anker).

-- =============================================================================
-- 1. Enum + Tabelle
-- =============================================================================

CREATE TYPE "DiscoveryArtifactKind" AS ENUM (
  'MAIL_EML',
  'MAIL_BODY_TEXT',
  'MAIL_BODY_HTML',
  'MAIL_METADATA',
  'ATTACHMENT'
);

CREATE TABLE "DiscoveryArtifact" (
  "id" TEXT NOT NULL,
  "discoveryDocumentId" TEXT NOT NULL,
  "kind" "DiscoveryArtifactKind" NOT NULL,
  "fileName" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "sha256" VARCHAR(64) NOT NULL,
  "relativePath" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DiscoveryArtifact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiscoveryArtifact_discoveryDocumentId_kind_fileName_key"
  ON "DiscoveryArtifact"("discoveryDocumentId", "kind", "fileName");
CREATE INDEX "DiscoveryArtifact_discoveryDocumentId_idx" ON "DiscoveryArtifact"("discoveryDocumentId");
CREATE INDEX "DiscoveryArtifact_sha256_idx" ON "DiscoveryArtifact"("sha256");

ALTER TABLE "DiscoveryArtifact"
  ADD CONSTRAINT "DiscoveryArtifact_discoveryDocumentId_fkey"
  FOREIGN KEY ("discoveryDocumentId") REFERENCES "DiscoveryDocument"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- 2. DiscoveryDocument-Erweiterung
-- =============================================================================

ALTER TABLE "DiscoveryDocument" ADD COLUMN "bodyText" TEXT;
ALTER TABLE "DiscoveryDocument" ADD COLUMN "bodyHasHtml" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DiscoveryDocument" ADD COLUMN "archivePath" TEXT;
ALTER TABLE "DiscoveryDocument" ADD COLUMN "acceptedAt" TIMESTAMP(3);
ALTER TABLE "DiscoveryDocument" ADD COLUMN "acceptedById" INTEGER;

CREATE INDEX "DiscoveryDocument_acceptedAt_idx" ON "DiscoveryDocument"("acceptedAt");

ALTER TABLE "DiscoveryDocument"
  ADD CONSTRAINT "DiscoveryDocument_acceptedById_fkey"
  FOREIGN KEY ("acceptedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
