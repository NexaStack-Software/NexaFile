-- Audit-Event fuer „User hat einzelne Mail aus IMAP nachgeladen" — Aktion
-- aus der Beleg-Detail-Seite, die ein Document, das vor Aktivierung des
-- Archive-Features importiert wurde, mit echten Files nachfuettert.
ALTER TYPE "DiscoveryAuditEvent" ADD VALUE 'IMAP_DOCUMENT_RESYNCED';
