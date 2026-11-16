import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import pg from 'pg';

export const migrationFiles = [
  '20261110_fresh_database_baseline.sql',
  '20260929_create_portfolio_education.sql',
  '20261009_create_auth_sessions.sql',
  '20261013_project_case_studies.sql',
  '20261013_portfolio_admin_events.sql',
  '20261013_portfolio_publication.sql',
  '20261013_portfolio_inquiries.sql',
  '20261013_backend_table_permissions.sql',
  '20261014_management_studio.sql',
];

const lockId = 78413401;
const ledgerTable = 'portfolio_schema_migration';
const requiredTables = [
  'admin_user', 'admin_user_provider', 'personal_info', 'project', 'technology',
  'project_link', 'project_technologies_technology', 'experience', 'experience_role',
  'experience_responsibility', 'skill', 'skill_item', 'resume', 'ai_config',
  'portfolio_education', 'portfolio_auth_session', 'portfolio_admin_event',
  'portfolio_publication', 'portfolio_inquiry', 'portfolio_studio',
  'portfolio_studio_recovery', ledgerTable,
];

export async function loadMigrations() {
  return Promise.all(migrationFiles.map(async (name) => {
    const source = (await readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8'))
      .replace(/\r\n/g, '\n');
    return {
      name,
      checksum: createHash('sha256').update(source).digest('hex'),
      // Existing files have standalone transaction wrappers. The bootstrap owns one
      // transaction for the complete baseline, migrations, and migration ledger.
      sql: source.replace(/^\s*(?:BEGIN|COMMIT);\s*$/gm, ''),
    };
  }));
}

function adminInput(email, name) {
  if (!email) return null;
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedName = name?.trim() || normalizedEmail;
  if (normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('BOOTSTRAP_ADMIN_EMAIL must be a valid, user-approved email address.');
  }
  if (normalizedName.length > 200 || /[\r\n\0]/.test(normalizedName)) {
    throw new Error('BOOTSTRAP_ADMIN_NAME must be at most 200 characters without control lines.');
  }
  return { email: normalizedEmail, name: normalizedName };
}

/** Accepts a connected pg Client. No connection string or data is logged. */
export async function bootstrapDatabase(client, {
  expectedDatabase = 'portfolio',
  adminEmail,
  adminName,
  migrations,
} = {}) {
  const files = migrations ?? await loadMigrations();
  const admin = adminInput(adminEmail, adminName);
  const identity = (await client.query(`
    SELECT current_database() AS database, current_user AS username,
           pg_get_userbyid(d.datdba) AS owner, r.rolsuper, r.rolbypassrls,
           r.rolcreatedb, r.rolcreaterole
    FROM pg_database d JOIN pg_roles r ON r.rolname=current_user
    WHERE d.datname=current_database()
  `)).rows[0];
  if (!identity || identity.database !== expectedDatabase) {
    throw new Error('Refusing to initialize a database other than EXPECTED_DATABASE.');
  }
  if (identity.username !== identity.owner || identity.rolsuper || identity.rolbypassrls ||
      identity.rolcreatedb || identity.rolcreaterole) {
    throw new Error('Use the dedicated database owner without cluster-administrator privileges.');
  }

  await client.query('SELECT pg_advisory_lock($1)', [lockId]);
  let inTransaction = false;
  try {
    await client.query('BEGIN');
    inTransaction = true;
    await client.query('SET LOCAL search_path = public, pg_catalog');
    const ledgerExists = (await client.query(
      "SELECT to_regclass('public.portfolio_schema_migration') IS NOT NULL AS present",
    )).rows[0].present;
    let status = 'already-initialized';
    if (!ledgerExists) {
      const existing = (await client.query(`
        SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S','f')
      `)).rows;
      if (existing.length) {
        throw new Error('Refusing to initialize a nonempty database without the bootstrap ledger.');
      }
      await client.query(`CREATE TABLE ${ledgerTable} (
        name text PRIMARY KEY, checksum varchar(64) NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`);
      await client.query(`ALTER TABLE ${ledgerTable} ENABLE ROW LEVEL SECURITY`);
      await client.query(`REVOKE ALL ON TABLE ${ledgerTable} FROM PUBLIC`);
      for (const file of files) {
        await client.query(file.sql);
        await client.query(`INSERT INTO ${ledgerTable}(name,checksum) VALUES($1,$2)`, [file.name, file.checksum]);
      }
      status = 'initialized';
    } else {
      const recorded = (await client.query(`SELECT name, checksum FROM ${ledgerTable}`)).rows;
      if (recorded.length !== files.length || files.some((file) =>
        !recorded.some((entry) => entry.name === file.name && entry.checksum === file.checksum))) {
        throw new Error('Bootstrap migration history differs from this release. Review migrations explicitly.');
      }
    }

    const tables = (await client.query(`
      SELECT c.relname, pg_get_userbyid(c.relowner) AS owner, c.relforcerowsecurity
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p')
    `)).rows;
    if (requiredTables.some((name) => !tables.some((table) => table.relname === name &&
      table.owner === identity.username && !table.relforcerowsecurity))) {
      throw new Error('The application schema is incomplete or ownership/RLS settings need review.');
    }

    let adminAction = 'not-requested';
    if (admin) {
      const result = await client.query(`
        INSERT INTO admin_user(email,name,"isActive") VALUES($1,$2,true)
        ON CONFLICT(email) DO NOTHING RETURNING id
      `, [admin.email, admin.name]);
      adminAction = result.rows.length ? 'created' : 'unchanged';
    }
    await client.query('COMMIT');
    inTransaction = false;
    return { status, migrations: files.length, admin: adminAction };
  } catch (error) {
    if (inTransaction) await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [lockId]);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required in the private process environment.');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    const result = await bootstrapDatabase(client, {
      expectedDatabase: process.env.EXPECTED_DATABASE || 'portfolio',
      adminEmail: process.env.BOOTSTRAP_ADMIN_EMAIL,
      adminName: process.env.BOOTSTRAP_ADMIN_NAME,
    });
    console.log(JSON.stringify(result));
  } catch (error) {
    // pg errors can contain connection details or SQL values. Report only the code.
    if (error?.code) console.error(`Database initialization failed (${error.code}). No connection details were logged.`);
    else console.error(error instanceof Error ? error.message : 'Database initialization failed.');
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main().catch(() => {
    console.error('Database initialization could not start. Check the private configuration.');
    process.exitCode = 1;
  });
}
