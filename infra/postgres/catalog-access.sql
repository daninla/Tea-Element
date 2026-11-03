-- Infrastructure provisioning. Prisma Migrate owns all application tables.
SELECT 'CREATE DATABASE catalog_shadow OWNER catalog'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'catalog_shadow')
\gexec
REVOKE ALL ON DATABASE catalog_shadow FROM PUBLIC;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mcp_readonly') THEN
    CREATE ROLE mcp_readonly NOLOGIN;
  END IF;
END
$$;
GRANT CONNECT ON DATABASE catalog_db TO mcp_readonly;
\connect catalog_db
GRANT USAGE ON SCHEMA public TO mcp_readonly;
ALTER DEFAULT PRIVILEGES FOR ROLE catalog IN SCHEMA public GRANT SELECT ON TABLES TO mcp_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO mcp_readonly;
