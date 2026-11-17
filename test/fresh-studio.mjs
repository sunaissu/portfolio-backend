import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { PGlite } from '@electric-sql/pglite';
import { bootstrapDatabase } from '../scripts/bootstrap-database.mjs';

const require = createRequire(import.meta.url);
require('reflect-metadata');
const { StudioService } = require('../dist/portfolio/services/studio.service.js');
const { PortfolioDataService } = require('../dist/portfolio/services/portfolio-data.service.js');
const db = new PGlite();
try {
  const database = (await db.query('SELECT current_database() AS name')).rows[0].name;
  const quotedDatabase = '"' + database.replaceAll('"', '""') + '"';
  await db.exec(`CREATE ROLE portfolio_app LOGIN;
    ALTER DATABASE ${quotedDatabase} OWNER TO portfolio_app;
    ALTER SCHEMA public OWNER TO portfolio_app;
    SET ROLE portfolio_app;`);
  const client = { query: async (sql, params) => params
    ? db.query(sql, params) : (await db.exec(sql)).at(-1) || { rows: [] } };
  await bootstrapDatabase(client, { expectedDatabase: database,
    adminEmail: 'fixture-admin@example.test', adminName: 'Fixture Admin' });
  const actor = (await db.query('SELECT id FROM admin_user')).rows[0].id;
  const adapter = connection => ({ query: async (sql, params = []) =>
    (await connection.query(sql, params.map(p =>
      p && typeof p === 'object' && !(p instanceof Date) ? JSON.stringify(p) : p))).rows });
  const manager = adapter(db);
  const source = { ...manager, manager, isInitialized: true,
    transaction: fn => db.transaction(tx => fn(adapter(tx))) };
  const parser = new PortfolioDataService({}, {}, {}, {}, { isInitialized: false }, {}, {});
  const fallback = await parser.getPortfolio();
  const portfolio = {
    normalizeDraft: value => parser.normalizeDraft(value),
    publicProjection: value => parser.publicProjection(value),
    getPortfolio: async () => fallback,
  };
  const service = new StudioService(source, portfolio, { getAll: async () => {
    throw new Error('Fresh initialization must not load fallback projects');
  } });

  const initial = await service.get(actor);
  assert.equal(initial.published, null);
  assert.equal(initial.published_at, null);
  assert.equal(initial.draft.profile.name, '');
  assert.equal(initial.draft.profile.email, '');
  assert.equal(initial.draft.profile.resumeUrl, null);
  for (const section of ['projects', 'skills', 'experience', 'education', 'todo'])
    assert.deepEqual(initial.draft[section], []);
  assert.deepEqual(initial.draft.content.articles, []);
  assert.equal((await db.query('SELECT count(*) FROM portfolio_studio')).rows[0].count, 0);

  // Autosave can run before the user's first explicit save. It must not lock
  // them out of the workspace or silently replace their recoverable edits.
  const recovery = structuredClone(initial.draft);
  recovery.profile.name = 'Unsaved first profile';
  await service.saveRecovery(actor, 0, 0, recovery);
  assert.equal((await service.get(actor)).draft.profile.name, '');
  assert.equal((await service.recovery(actor)).draft.profile.name, 'Unsaved first profile');
  await service.discardRecovery(actor, 1);

  const saved = await service.change(actor, 'save', 0, { data: initial.draft });
  assert.equal(saved.version, 1);
  assert.equal((await service.get(actor)).draft.profile.name, '');
  await assert.rejects(service.change(actor, 'approve', saved.version), error => error.status === 400);
  await assert.rejects(service.change(actor, 'publish', saved.version), /Approve the exact/);
  assert.equal((await db.query('SELECT published FROM portfolio_studio')).rows[0].published, null);

  for (const value of [123, null, ' '.repeat(201)]) {
    const invalid = structuredClone(saved.draft);
    invalid.profile.name = value;
    assert.throws(() => parser.normalizeDraft(invalid));
  }
  for (const [field, value] of [['email', 'invalid'], ['linkedin', 'javascript:alert(1)']]) {
    const invalid = structuredClone(saved.draft);
    invalid.profile[field] = value;
    assert.throws(() => parser.normalizeDraft(invalid));
  }
  assert.throws(() => parser.publicProjection(initial.draft));

  const completed = structuredClone(saved.draft);
  completed.profile = {
    id: 1, name: 'Fixture Engineer', location: 'Fixture City',
    linkedin: 'https://example.test/profile', portfolio: 'https://example.test',
    summary: 'Fixture profile summary', title: 'Software Engineer',
    email: 'fixture@example.test', resumeUrl: null,
  };
  let state = await service.change(actor, 'save', saved.version, { data: completed });
  state = await service.change(actor, 'approve', state.version);
  state = await service.change(actor, 'publish', state.version);
  assert.equal(state.published.profile.name, 'Fixture Engineer');
  assert.deepEqual(state.published.projects, []);
  assert.equal((await db.query('SELECT count(*) FROM personal_info')).rows[0].count, 0);
  const publicReader = new PortfolioDataService({}, {}, {}, {}, source, {}, {});
  const live = await publicReader.getPortfolio();
  assert.equal(live.isStale, false);
  assert.equal(live.source, 'database');
  assert.equal(live.data.profile.name, 'Fixture Engineer');

  await db.exec('DELETE FROM portfolio_studio');
  await db.query('INSERT INTO project(name, description) VALUES($1,$2)', ['Existing project', 'Keep this']);
  await assert.rejects(service.get(actor), /fresh portfolio read/);
  await db.exec('DELETE FROM project');
  await db.query('INSERT INTO portfolio_studio_recovery(actor_id, base_version, draft) VALUES($1,2,$2)',
    [actor, JSON.stringify(completed)]);
  await assert.rejects(service.get(actor), /fresh portfolio read/);
  await db.exec('DELETE FROM portfolio_studio_recovery');

  const broken = new StudioService({ manager: { query: async sql => {
    if (sql.startsWith('SELECT * FROM portfolio_studio')) return [];
    throw new Error('Database unavailable');
  } } }, portfolio, {});
  await assert.rejects(broken.get(actor), /Database unavailable/);
  console.log('Fresh Studio passed: empty private draft, save/reload, strict publication, no fallback import, reviewed first publication, and refusal for partial data, recovery drafts or query failure.');
} finally {
  await db.close();
}
