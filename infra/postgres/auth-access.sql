-- Infrastructure provisioning only. Application tables are managed by Prisma Migrate.
SELECT 'CREATE DATABASE auth_shadow OWNER auth'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'auth_shadow')
\gexec
REVOKE ALL ON DATABASE auth_shadow FROM PUBLIC;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mcp_readonly') THEN
    CREATE ROLE mcp_readonly NOLOGIN;
  END IF;
END
$$;
GRANT CONNECT ON DATABASE auth_db TO mcp_readonly;
\connect auth_db
GRANT USAGE ON SCHEMA public TO mcp_readonly;
ALTER DEFAULT PRIVILEGES FOR ROLE auth IN SCHEMA public GRANT SELECT ON TABLES TO mcp_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO mcp_readonly;
