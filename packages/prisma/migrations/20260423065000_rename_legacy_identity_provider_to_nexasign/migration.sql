DO $$
DECLARE
  legacy_value text;
BEGIN
  SELECT e.enumlabel
    INTO legacy_value
  FROM pg_enum e
  JOIN pg_type t ON t.oid = e.enumtypid
  WHERE t.typname = 'IdentityProvider'
    AND e.enumlabel NOT IN ('GOOGLE', 'OIDC', 'NEXASIGN')
  LIMIT 1;

  IF legacy_value IS NOT NULL THEN
    EXECUTE format('ALTER TYPE "IdentityProvider" RENAME VALUE %L TO ''NEXASIGN''', legacy_value);
  END IF;
END $$;
