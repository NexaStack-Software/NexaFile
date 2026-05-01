-- Discovery-Drift-Fix
-- Korrigiert fruehe NexaFILE-Beta-Installationen, bei denen die Discovery-
-- Basismigration schon als angewendet markiert wurde, aber noch nicht den
-- finalen V1-Stand enthielt oder nur teilweise angewendet war.

-- =============================================================================
-- 1. Fehlende Enums aus fruehen/teilweise angewendeten Beta-Migrationen
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE "SourceKind" AS ENUM ('IMAP');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SourceSyncStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'SUSPENDED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "DiscoveryAuditEvent" AS ENUM (
    'IMAP_ACCOUNT_CREATED',
    'IMAP_ACCOUNT_DELETED',
    'IMAP_ACCOUNT_UPDATED',
    'IMAP_SYNC_STARTED',
    'IMAP_SYNC_COMPLETED',
    'IMAP_SYNC_LOGIN_FAILED',
    'IMAP_SYNC_TLS_INSECURE',
    'IMAP_DOCUMENT_IMPORTED',
    'DISCOVERY_DOCUMENT_ACCEPTED',
    'DISCOVERY_DOCUMENT_IGNORED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- 2. Fehlende Tabellen aus fruehen/teilweise angewendeten Beta-Migrationen
-- =============================================================================

CREATE TABLE IF NOT EXISTS "Source" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "teamId" INTEGER NOT NULL,
  "kind" "SourceKind" NOT NULL,
  "label" TEXT NOT NULL,
  "encryptedConfig" TEXT NOT NULL,
  "encryptedConfigKeyVersion" TEXT NOT NULL DEFAULT 'v1',
  "lastSyncAt" TIMESTAMP(3),
  "lastSyncAttemptedAt" TIMESTAMP(3),
  "lastSyncStatus" "SourceSyncStatus" NOT NULL DEFAULT 'PENDING',
  "lastSyncError" TEXT,
  "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
  "syncLockUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DiscoveryAuditLog" (
  "id" TEXT NOT NULL,
  "event" "DiscoveryAuditEvent" NOT NULL,
  "sourceId" TEXT,
  "discoveryDocumentId" TEXT,
  "userId" INTEGER,
  "teamId" INTEGER,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DiscoveryAuditLog_pkey" PRIMARY KEY ("id")
);

-- =============================================================================
-- 3. Spalten auf finalen V1-Stand bringen
-- =============================================================================

ALTER TABLE "Source" ADD COLUMN IF NOT EXISTS "teamId" INTEGER;

-- Source wurde vor V1 nicht produktiv genutzt. Falls jemand trotzdem Beta-Daten
-- hat, ist ein leerer Stand reproduzierbarer als eine nicht migrierbare DB.
DELETE FROM "Source" WHERE "teamId" IS NULL;

ALTER TABLE "Source" ALTER COLUMN "teamId" SET NOT NULL;

ALTER TABLE "DiscoveryDocument" ADD COLUMN IF NOT EXISTS "sourceId" TEXT;
ALTER TABLE "DiscoveryDocument" ADD COLUMN IF NOT EXISTS "detectedAmount" TEXT;
ALTER TABLE "DiscoveryDocument" ADD COLUMN IF NOT EXISTS "detectedInvoiceNumber" TEXT;
ALTER TABLE "DiscoveryDocument" ADD COLUMN IF NOT EXISTS "portalHint" TEXT;
ALTER TABLE "DiscoveryDocument" ADD COLUMN IF NOT EXISTS "messageIdHash" TEXT;
ALTER TABLE "DiscoveryDocument" ALTER COLUMN "dataId" DROP NOT NULL;

-- =============================================================================
-- 4. Indizes
-- =============================================================================

CREATE INDEX IF NOT EXISTS "Source_userId_idx" ON "Source"("userId");
CREATE INDEX IF NOT EXISTS "Source_teamId_idx" ON "Source"("teamId");
CREATE INDEX IF NOT EXISTS "Source_lastSyncAt_idx" ON "Source"("lastSyncAt");
CREATE INDEX IF NOT EXISTS "Source_lastSyncAttemptedAt_idx" ON "Source"("lastSyncAttemptedAt");

CREATE INDEX IF NOT EXISTS "DiscoveryDocument_teamId_uploadedById_status_idx" ON "DiscoveryDocument"("teamId", "uploadedById", "status");
CREATE INDEX IF NOT EXISTS "DiscoveryDocument_sourceId_idx" ON "DiscoveryDocument"("sourceId");
CREATE INDEX IF NOT EXISTS "DiscoveryDocument_messageIdHash_idx" ON "DiscoveryDocument"("messageIdHash");

CREATE INDEX IF NOT EXISTS "DiscoveryAuditLog_sourceId_idx" ON "DiscoveryAuditLog"("sourceId");
CREATE INDEX IF NOT EXISTS "DiscoveryAuditLog_discoveryDocumentId_idx" ON "DiscoveryAuditLog"("discoveryDocumentId");
CREATE INDEX IF NOT EXISTS "DiscoveryAuditLog_userId_idx" ON "DiscoveryAuditLog"("userId");
CREATE INDEX IF NOT EXISTS "DiscoveryAuditLog_createdAt_idx" ON "DiscoveryAuditLog"("createdAt");

-- =============================================================================
-- 5. Foreign Keys idempotent anlegen
-- =============================================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Source_userId_fkey') THEN
    ALTER TABLE "Source" ADD CONSTRAINT "Source_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Source_teamId_fkey') THEN
    ALTER TABLE "Source" ADD CONSTRAINT "Source_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "Team"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DiscoveryDocument_sourceId_fkey') THEN
    ALTER TABLE "DiscoveryDocument" ADD CONSTRAINT "DiscoveryDocument_sourceId_fkey"
      FOREIGN KEY ("sourceId") REFERENCES "Source"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DiscoveryAuditLog_sourceId_fkey') THEN
    ALTER TABLE "DiscoveryAuditLog" ADD CONSTRAINT "DiscoveryAuditLog_sourceId_fkey"
      FOREIGN KEY ("sourceId") REFERENCES "Source"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DiscoveryAuditLog_discoveryDocumentId_fkey') THEN
    ALTER TABLE "DiscoveryAuditLog" ADD CONSTRAINT "DiscoveryAuditLog_discoveryDocumentId_fkey"
      FOREIGN KEY ("discoveryDocumentId") REFERENCES "DiscoveryDocument"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DiscoveryAuditLog_userId_fkey') THEN
    ALTER TABLE "DiscoveryAuditLog" ADD CONSTRAINT "DiscoveryAuditLog_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DiscoveryAuditLog_teamId_fkey') THEN
    ALTER TABLE "DiscoveryAuditLog" ADD CONSTRAINT "DiscoveryAuditLog_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "Team"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
