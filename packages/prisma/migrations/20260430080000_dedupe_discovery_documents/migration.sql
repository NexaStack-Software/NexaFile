-- Dedupe DiscoveryDocument rows pro (sourceId, messageIdHash) und schliesse die
-- Race-Lücke per echtem Unique-Constraint.
--
-- Ursache: Der App-seitige Idempotenz-Check in
-- packages/lib/server-only/sources/imap/imap-source-adapter.ts macht ein
-- findFirst() VOR dem create(). Bei parallel laufenden Sync-Runs (oder einem
-- abgebrochenen + neu gestarteten Run) sehen beide den Datensatz noch nicht,
-- beide schreiben — und in der UI tauchen Belege doppelt auf.
--
-- Diese Migration:
--   1) Konsolidiert die existierenden Duplikate: per (sourceId, messageIdHash)
--      bleibt genau eine Zeile uebrig — bevorzugt die bereits Akzeptierte
--      (acceptedAt IS NOT NULL), sonst die mit der frühesten createdAt.
--   2) Re-targeted Audit-Logs der zu loeschenden Duplikate auf den verbleibenden
--      Datensatz, damit kein History-Eintrag verloren geht.
--   3) Loescht die ueberzaehligen Zeilen. DiscoveryArtifact cascadiert
--      automatisch (onDelete Cascade), DocumentData bleibt orphaned und kann
--      separat geprunet werden.
--   4) Setzt den fehlenden Unique-Constraint, damit zukuenftige Race-Inserts
--      hart auf P2002 laufen.
--
-- Die Operationen laufen in einer Transaktion via Prisma-Migration-Wrapper.

-- 1) Identifiziere Duplikate, waehle den "Keeper" pro Gruppe.
WITH ranked AS (
  SELECT
    id,
    "sourceId",
    "messageIdHash",
    "acceptedAt",
    "createdAt",
    ROW_NUMBER() OVER (
      PARTITION BY "sourceId", "messageIdHash"
      -- Akzeptierte zuerst (NULLS LAST), dann aelteste
      ORDER BY ("acceptedAt" IS NOT NULL) DESC, "createdAt" ASC, id ASC
    ) AS rnk
  FROM "DiscoveryDocument"
  WHERE "messageIdHash" IS NOT NULL AND "sourceId" IS NOT NULL
),
keepers AS (
  SELECT "sourceId", "messageIdHash", id AS keeper_id
  FROM ranked
  WHERE rnk = 1
),
losers AS (
  SELECT r.id AS loser_id, k.keeper_id
  FROM ranked r
  JOIN keepers k ON k."sourceId" = r."sourceId" AND k."messageIdHash" = r."messageIdHash"
  WHERE r.rnk > 1
)

-- 2) Audit-Logs der Duplikate auf den Keeper umhaengen.
UPDATE "DiscoveryAuditLog" al
SET "discoveryDocumentId" = l.keeper_id
FROM losers l
WHERE al."discoveryDocumentId" = l.loser_id;

-- 3) Duplikate loeschen. DiscoveryArtifact cascadiert (onDelete Cascade in Prisma).
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "sourceId", "messageIdHash"
      ORDER BY ("acceptedAt" IS NOT NULL) DESC, "createdAt" ASC, id ASC
    ) AS rnk
  FROM "DiscoveryDocument"
  WHERE "messageIdHash" IS NOT NULL AND "sourceId" IS NOT NULL
)
DELETE FROM "DiscoveryDocument"
WHERE id IN (SELECT id FROM ranked WHERE rnk > 1);

-- 4) Unique-Constraint setzen: ab jetzt schlaegt der zweite Insert hart fehl
-- (Prisma P2002), kein silent dup mehr. NULL-Werte bleiben erlaubt — der
-- Constraint greift nur, wenn beide Felder gesetzt sind, was Postgres auch
-- per Default-Verhalten so handhabt (zwei NULL gelten nicht als gleich).
CREATE UNIQUE INDEX "DiscoveryDocument_sourceId_messageIdHash_key"
  ON "DiscoveryDocument"("sourceId", "messageIdHash")
  WHERE "sourceId" IS NOT NULL AND "messageIdHash" IS NOT NULL;
