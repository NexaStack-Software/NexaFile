-- Backfill fuer Discovery-Belege, die vor der GoBD-Brueckenlogik bereits
-- archiviert oder in ein Signatur-Dokument uebernommen wurden, aber noch
-- keinen acceptedAt-Retention-Start hatten.

WITH candidates AS (
  SELECT
    id,
    "teamId",
    "uploadedById",
    status,
    "signingEnvelopeId",
    COALESCE("updatedAt", "capturedAt", "createdAt", NOW()) AS retention_start
  FROM "DiscoveryDocument"
  WHERE "acceptedAt" IS NULL
    AND (
      status IN ('ACCEPTED', 'SIGNED', 'ARCHIVED')
      OR "signingEnvelopeId" IS NOT NULL
    )
),
updated AS (
  UPDATE "DiscoveryDocument" d
  SET
    "acceptedAt" = c.retention_start,
    "acceptedById" = COALESCE(d."acceptedById", c."uploadedById"),
    status = CASE
      WHEN d.status = 'ARCHIVED' THEN d.status
      WHEN d."signingEnvelopeId" IS NOT NULL THEN 'SIGNED'
      ELSE d.status
    END
  FROM candidates c
  WHERE d.id = c.id
  RETURNING
    d.id,
    d."teamId",
    d."uploadedById",
    d.status,
    d."providerSource",
    d."signingEnvelopeId",
    c.retention_start
)
INSERT INTO "DiscoveryAuditLog" (
  id,
  event,
  "discoveryDocumentId",
  "userId",
  "teamId",
  metadata,
  "createdAt"
)
SELECT
  'disc_audit_backfill_' || id,
  'DISCOVERY_DOCUMENT_ACCEPTED',
  id,
  "uploadedById",
  "teamId",
  jsonb_build_object(
    'action', CASE WHEN "signingEnvelopeId" IS NOT NULL THEN 'create-signing-document' ELSE 'archive' END,
    'providerSource', "providerSource",
    'signingEnvelopeId', "signingEnvelopeId",
    'retentionStarted', true,
    'backfilled', true
  ),
  retention_start
FROM updated;
