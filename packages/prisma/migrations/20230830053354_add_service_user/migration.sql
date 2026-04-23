INSERT INTO "User" ("email", "name") VALUES (
  'serviceaccount@nexasign.com',
  'Service Account'
) ON CONFLICT DO NOTHING;
