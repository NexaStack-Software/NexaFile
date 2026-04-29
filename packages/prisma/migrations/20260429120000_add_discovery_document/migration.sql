-- Discovery — Schritt 1 des Lifecycles
-- Additive Migration: neue Tabellen, Enums und FKs für Discovery, Source und DiscoveryAuditLog.
-- Keine Mutation bestehender Daten außerhalb der drei Discovery-Tabellen.

-- =============================================================================
-- Enums
-- =============================================================================

CREATE TYPE "DiscoveryDocumentStatus" AS ENUM (
  'INBOX',
  'PENDING_MANUAL',
  'ACCEPTED',
  'SIGNED',
  'ARCHIVED',
  'IGNORED'
);

CREATE TYPE "SourceKind" AS ENUM (
  'IMAP'
);

CREATE TYPE "SourceSyncStatus" AS ENUM (
  'PENDING',
  'SUCCESS',
  'FAILED',
  'SUSPENDED'
);

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

-- =============================================================================
-- Source — pro User konfigurierte Discovery-Quelle (IMAP, später Cloud).
-- =============================================================================

CREATE TABLE "Source" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
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

CREATE INDEX "Source_userId_idx" ON "Source"("userId");
CREATE INDEX "Source_lastSyncAt_idx" ON "Source"("lastSyncAt");
CREATE INDEX "Source_lastSyncAttemptedAt_idx" ON "Source"("lastSyncAttemptedAt");

-- =============================================================================
-- DiscoveryDocument — Belege im Pre-Lifecycle-Eingang.
-- =============================================================================

CREATE TABLE "DiscoveryDocument" (
  "id" TEXT NOT NULL,
  "teamId" INTEGER NOT NULL,
  "uploadedById" INTEGER,
  "sourceId" TEXT,
  "title" TEXT NOT NULL,
  "correspondent" TEXT,
  "documentType" TEXT,
  "documentDate" TIMESTAMP(3),
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "DiscoveryDocumentStatus" NOT NULL DEFAULT 'INBOX',
  "providerSource" TEXT NOT NULL,
  "providerNativeId" TEXT,
  "contentType" TEXT,
  "fileSize" INTEGER,
  "tags" TEXT[],
  "detectedAmount" TEXT,
  "detectedInvoiceNumber" TEXT,
  "portalHint" TEXT,
  "messageIdHash" TEXT,
  "dataId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DiscoveryDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiscoveryDocument_dataId_key" ON "DiscoveryDocument"("dataId");
CREATE INDEX "DiscoveryDocument_teamId_status_idx" ON "DiscoveryDocument"("teamId", "status");
CREATE INDEX "DiscoveryDocument_teamId_capturedAt_idx" ON "DiscoveryDocument"("teamId", "capturedAt");
CREATE INDEX "DiscoveryDocument_teamId_uploadedById_status_idx" ON "DiscoveryDocument"("teamId", "uploadedById", "status");
CREATE INDEX "DiscoveryDocument_sourceId_idx" ON "DiscoveryDocument"("sourceId");
CREATE INDEX "DiscoveryDocument_messageIdHash_idx" ON "DiscoveryDocument"("messageIdHash");

-- =============================================================================
-- DiscoveryAuditLog — Audit-Spur für Source-Konfig und Lifecycle-Events.
-- =============================================================================

CREATE TABLE "DiscoveryAuditLog" (
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

CREATE INDEX "DiscoveryAuditLog_sourceId_idx" ON "DiscoveryAuditLog"("sourceId");
CREATE INDEX "DiscoveryAuditLog_discoveryDocumentId_idx" ON "DiscoveryAuditLog"("discoveryDocumentId");
CREATE INDEX "DiscoveryAuditLog_userId_idx" ON "DiscoveryAuditLog"("userId");
CREATE INDEX "DiscoveryAuditLog_createdAt_idx" ON "DiscoveryAuditLog"("createdAt");

-- =============================================================================
-- Foreign Keys
-- =============================================================================

ALTER TABLE "Source"
  ADD CONSTRAINT "Source_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DiscoveryDocument"
  ADD CONSTRAINT "DiscoveryDocument_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DiscoveryDocument"
  ADD CONSTRAINT "DiscoveryDocument_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DiscoveryDocument"
  ADD CONSTRAINT "DiscoveryDocument_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "Source"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DiscoveryDocument"
  ADD CONSTRAINT "DiscoveryDocument_dataId_fkey"
  FOREIGN KEY ("dataId") REFERENCES "DocumentData"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DiscoveryAuditLog"
  ADD CONSTRAINT "DiscoveryAuditLog_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "Source"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DiscoveryAuditLog"
  ADD CONSTRAINT "DiscoveryAuditLog_discoveryDocumentId_fkey"
  FOREIGN KEY ("discoveryDocumentId") REFERENCES "DiscoveryDocument"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DiscoveryAuditLog"
  ADD CONSTRAINT "DiscoveryAuditLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DiscoveryAuditLog"
  ADD CONSTRAINT "DiscoveryAuditLog_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
