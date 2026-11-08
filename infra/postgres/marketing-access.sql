-- Infrastructure isolation only. Application schema is owned by Prisma Migrate.
SELECT 'CREATE DATABASE marketing_shadow OWNER marketing'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'marketing_shadow')
\gexec
REVOKE ALL ON DATABASE marketing_shadow FROM PUBLIC;
