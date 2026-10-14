import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
    CREATE TABLE admin_user(id integer PRIMARY KEY);
    CREATE TABLE ai_config(id integer PRIMARY KEY, "apiKey" text);
    CREATE TABLE project(id integer PRIMARY KEY, "isDraft" boolean NOT NULL DEFAULT false);
    INSERT INTO admin_user VALUES (1);
    INSERT INTO ai_config VALUES (1, 'fixture-credential-never-exported');`);
  const migrations = ['20260929_create_portfolio_education.sql', '20261009_create_auth_sessions.sql', '20261013_project_case_studies.sql', '20261013_portfolio_admin_events.sql', '20261013_portfolio_publication.sql', '20261013_portfolio_inquiries.sql', '20261013_backend_table_permissions.sql', '20261014_management_studio.sql'];
  for (const migration of migrations) await db.exec(await readFile(new URL(`../migrations/${migration}`, import.meta.url), 'utf8'));
  // Reapplying the additive migration set must not destroy saved rows.
  for (const migration of migrations) await db.exec(await readFile(new URL(`../migrations/${migration}`, import.meta.url), 'utf8'));
  await db.exec('INSERT INTO project(id) VALUES (1)');
  assert.equal((await db.query('SELECT "isDraft" FROM project WHERE id = 1')).rows[0].isDraft, true);
  await db.query('INSERT INTO portfolio_publication(id, draft) VALUES (1, $1)', [JSON.stringify({ articles: [] })]);
  const inquiryId = randomUUID();
  await db.query('INSERT INTO portfolio_inquiry(id, "receiptHash", "requestHash", name, email, topic, message, "createdAt", "expiresAt") VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW()+INTERVAL \'30 days\')', [inquiryId, 'a'.repeat(64), 'b'.repeat(64), 'Fixture sender', 'fixture@example.test', 'Fixture topic', 'Private fixture message']);
  await db.query('INSERT INTO portfolio_admin_event(id, actor_id, action, entity_id, version) VALUES ($1,1,$2,$3,1)', [randomUUID(), 'publication.save', 'publication']);
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`SET ROLE ${role}`);
    for (const table of ['ai_config', 'project', 'portfolio_education', 'portfolio_auth_session', 'portfolio_publication', 'portfolio_inquiry', 'portfolio_admin_event', 'portfolio_studio', 'portfolio_studio_recovery']) {
      await assert.rejects(db.query(`SELECT * FROM ${table}`), /permission denied/);
      await assert.rejects(db.query(`DELETE FROM ${table}`), /permission denied/);
    }
    await db.exec('RESET ROLE');
  }
  await db.transaction(async tx => {
    await tx.query('SELECT pg_advisory_xact_lock(78413293)');
    const row = (await tx.query('SELECT version FROM portfolio_publication WHERE id=1 FOR UPDATE')).rows[0];
    assert.equal(row.version, 1);
    await tx.query('UPDATE portfolio_publication SET version=version+1 WHERE id=1 AND version=$1', [row.version]);
  });
  const stale = await db.query('UPDATE portfolio_publication SET version=version+1 WHERE id=1 AND version=1 RETURNING version');
  assert.equal(stale.rows.length, 0);
  await db.exec(`UPDATE portfolio_inquiry SET "expiresAt"=NOW()-INTERVAL '1 second'; DELETE FROM portfolio_inquiry WHERE "expiresAt"<=NOW()`);
  assert.equal((await db.query('SELECT count(*) FROM portfolio_inquiry')).rows[0].count, 0);
  assert.equal((await db.query('SELECT count(*) FROM portfolio_admin_event')).rows[0].count, 1);
  console.log('Disposable PostgreSQL passed: additive migrations, draft default, private role permissions, publication revision lock, inquiry expiry, and durable audit rows.');
} catch (error) { console.error(error.message); process.exitCode = 1; } finally { await db.close(); }
