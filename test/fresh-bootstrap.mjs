import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { DataSource } from 'typeorm';
import { bootstrapDatabase, loadMigrations } from '../scripts/bootstrap-database.mjs';

const require = createRequire(import.meta.url);
require('reflect-metadata');

async function verifyEntityColumns(db) {
  const models = new URL('../dist/portfolio/models/', import.meta.url);
  const entities = [];
  for (const name of await readdir(models)) {
    if (name.endsWith('.model.js')) entities.push(...Object.values(require(fileURLToPath(new URL(name, models)))));
  }
  entities.push(require('../dist/chat/entities/ai-config.entity.js').AiConfig);
  const source = new DataSource({ type: 'postgres', entities, synchronize: false });
  // Build metadata only. No connection is opened and no schema synchronization runs.
  await source.buildMetadatas();
  for (const table of source.entityMetadatas) {
    const actual = (await db.query(`
      SELECT a.attname AS name, a.attnotnull AS not_null, format_type(a.atttypid,a.atttypmod) AS type
      FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=$1 AND a.attnum>0 AND NOT a.attisdropped
    `, [table.tableName])).rows;
    for (const column of table.columns) {
      const match = actual.find((item) => item.name === column.databaseName);
      assert.ok(match, `Missing column ${table.tableName}.${column.databaseName}`);
      assert.equal(match.not_null, !column.isNullable, `${table.tableName}.${column.databaseName} nullability`);
      assert.equal(match.type.replace(/\(\d+(?:,\d+)?\)/g, ''), source.driver.normalizeType(column),
        `${table.tableName}.${column.databaseName} type`);
    }
  }
}

async function newDatabase() {
  const db = new PGlite();
  const database = (await db.query('SELECT current_database() AS name')).rows[0].name;
  const quotedDatabase = '"' + database.replaceAll('"', '""') + '"';
  await db.exec(`CREATE ROLE portfolio_app LOGIN;
    ALTER DATABASE ${quotedDatabase} OWNER TO portfolio_app;
    ALTER SCHEMA public OWNER TO portfolio_app;
    SET ROLE portfolio_app;`);
  const client = {
    query: async (sql, params) => params
      ? db.query(sql, params)
      : (await db.exec(sql)).at(-1) || { rows: [] },
  };
  return { db, client, options: { expectedDatabase: database } };
}

const successful = await newDatabase();
try {
  const { db, client, options } = successful;
  assert.equal((await bootstrapDatabase(client, options)).status, 'initialized');
  await verifyEntityColumns(db);
  assert.equal((await db.query('SELECT count(*) AS count FROM personal_info')).rows[0].count, 0);
  assert.equal((await db.query('SELECT count(*) AS count FROM project')).rows[0].count, 0);
  assert.equal((await db.query('SELECT count(*) AS count FROM admin_user')).rows[0].count, 0);
  const admin = { ...options, adminEmail: 'fixture-admin@example.test', adminName: 'Fixture Admin' };
  assert.equal((await bootstrapDatabase(client, admin)).admin, 'created');
  await db.query('UPDATE admin_user SET "isActive"=false, name=$1', ['Preserved name']);
  assert.equal((await bootstrapDatabase(client, admin)).admin, 'unchanged');
  assert.deepEqual((await db.query('SELECT name,"isActive" FROM admin_user')).rows,
    [{ name: 'Preserved name', isActive: false }]);
  const history = await loadMigrations();
  await assert.rejects(bootstrapDatabase(client, { ...options, migrations: [
    { ...history[0], checksum: '0'.repeat(64) }, ...history.slice(1),
  ] }), /history differs/);
  await assert.rejects(bootstrapDatabase(client, { expectedDatabase: 'incorrect_database' }), /EXPECTED_DATABASE/);
  await db.exec('RESET ROLE; CREATE ROLE unrelated_application; SET ROLE unrelated_application;');
  for (const table of ['admin_user', 'ai_config', 'portfolio_auth_session', 'portfolio_studio', 'portfolio_schema_migration']) {
    await assert.rejects(db.query(`SELECT * FROM ${table}`), /permission denied/);
  }
} finally {
  await successful.db.close();
}

const occupied = await newDatabase();
try {
  await occupied.db.exec('CREATE TABLE existing_data(value integer); INSERT INTO existing_data VALUES(42);');
  await assert.rejects(bootstrapDatabase(occupied.client, occupied.options), /nonempty database/);
  assert.equal((await occupied.db.query('SELECT value FROM existing_data')).rows[0].value, 42);
  assert.equal((await occupied.db.query("SELECT to_regclass('portfolio_schema_migration') AS ledger")).rows[0].ledger, null);
} finally {
  await occupied.db.close();
}

const failing = await newDatabase();
try {
  const migrations = await loadMigrations();
  await assert.rejects(bootstrapDatabase(failing.client, { ...failing.options, migrations: [
    ...migrations,
    { name: 'deliberate-failure.sql', checksum: 'fixture', sql: 'SELECT missing_column FROM admin_user' },
  ] }), /does not exist/);
  assert.equal((await failing.db.query("SELECT to_regclass('admin_user') AS table_name")).rows[0].table_name, null);
  assert.equal((await bootstrapDatabase(failing.client, failing.options)).status, 'initialized');
} finally {
  await failing.db.close();
}

console.log('Fresh bootstrap passed: entity-compatible columns, empty schema, no seeded content, repeat-run preservation, restricted roles, nonempty refusal, checksum refusal, and complete rollback.');
