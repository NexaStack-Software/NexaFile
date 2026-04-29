-- Sync-Run-Modell: User-getriggerte Sync-Läufe statt Cron-Auto-Sync
--
-- Änderungen:
--   1. Neue Tabelle SyncRun + Enum SyncRunStatus
--   2. Source.lastSyncAttemptedAt + syncLockUntil DROP — Lock kommt jetzt
--      aus laufendem SyncRun (status = RUNNING)

-- =============================================================================
-- 1. SyncRunStatus Enum
-- =============================================================================

CREATE TYPE "SyncRunStatus" AS ENUM (
  'PENDING',
  'RUNNING',
  'SUCCESS',
  'FAILED',
  'CANCELLED'
);

-- =============================================================================
-- 2. SyncRun Tabelle
-- =============================================================================

CREATE TABLE "SyncRun" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "triggeredById" INTEGER NOT NULL,
  "rangeFrom" TIMESTAMP(3) NOT NULL,
  "rangeTo" TIMESTAMP(3) NOT NULL,
  "status" "SyncRunStatus" NOT NULL DEFAULT 'PENDING',
  "mailsChecked" INTEGER NOT NULL DEFAULT 0,
  "documentsAuto" INTEGER NOT NULL DEFAULT 0,
  "documentsManual" INTEGER NOT NULL DEFAULT 0,
  "documentsIgnored" INTEGER NOT NULL DEFAULT 0,
  "documentsFailed" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),

  CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SyncRun_sourceId_startedAt_idx" ON "SyncRun"("sourceId", "startedAt" DESC);
CREATE INDEX "SyncRun_status_idx" ON "SyncRun"("status");
CREATE UNIQUE INDEX "SyncRun_one_active_per_source_idx"
  ON "SyncRun"("sourceId")
  WHERE "status" IN ('PENDING', 'RUNNING');

ALTER TABLE "SyncRun"
  ADD CONSTRAINT "SyncRun_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "Source"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SyncRun"
  ADD CONSTRAINT "SyncRun_triggeredById_fkey"
  FOREIGN KEY ("triggeredById") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- 3. Source aufräumen — Cron-Cursor und Lock-Felder raus
-- =============================================================================

DROP INDEX IF EXISTS "Source_lastSyncAttemptedAt_idx";

ALTER TABLE "Source" DROP COLUMN IF EXISTS "lastSyncAttemptedAt";
ALTER TABLE "Source" DROP COLUMN IF EXISTS "syncLockUntil";
