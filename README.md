# Portfolio backend

NestJS and PostgreSQL service for the public portfolio, authenticated dashboard, public-data assistant, and private inquiry inbox. Public responses use an explicit projection. Drafts, administrator records, credentials, inquiry messages, and audit records are not part of that projection.

## Setup and deployment

Install with npm install and compile with npm run build. Development uses npm run start:dev; production uses npm run start:prod. Port 4000 is the default. Configure the database, Google sign-in, cookie origins, storage, and optional AI provider privately. No credentials belong in the frontend or snapshots.

Before deploying the matching frontend/dashboard release, apply these SQL migrations to the intended database in order:

1. migrations/20260929_create_portfolio_education.sql
2. migrations/20261009_create_auth_sessions.sql
3. migrations/20261013_project_case_studies.sql
4. migrations/20261013_portfolio_admin_events.sql
5. migrations/20261013_portfolio_publication.sql
6. migrations/20261013_portfolio_inquiries.sql
7. migrations/20261013_backend_table_permissions.sql

These are additive migrations for an existing portfolio database. They do not create all legacy application tables. The backend connection must use the table owner or a dedicated server role with the required privileges and BYPASSRLS. Browser database roles anon/authenticated have no direct access to application tables, including ai_config. The public portfolio reads through the backend instead. Review other database roles and inherited privileges in the intended deployment. These migrations were tested in disposable PostgreSQL, not applied to production.

Production requires distinct JWT_SECRET and JWT_REFRESH_SECRET values of at least 32 bytes and an HTTPS CLIENT_URL in ALLOWED_ORIGINS. Add both portfolio and dashboard origins. Cookies require the actual deployment's HTTPS and same-site configuration. Sign-in uses a signed browser-bound Google state and verified Google email. Sessions are stored in PostgreSQL; refresh rotation is conditional and logout revokes the session. Old tokens without session IDs require sign-in again.

All admin endpoints require the global authenticated-session guard. Unsafe admin requests also require an allowed Origin and matching CSRF header/cookie. Database failures fail closed for authentication and mutations. Do not expose PostgreSQL or service-role credentials to the browser.

## Content implementation

The versioned /api/v1/config response reads live data, then a bounded in-memory last-good cache, then the intentional server snapshot. Responses report per-section provenance and staleness. The cache does not survive restart. Education uses its database table when installed; tasks remain snapshot content. Static snapshots are public backup data, not an editable record.

Projects have an optional caseStudy object, capped at 24,000 UTF-8 bytes. It contains type, role, problem, scope, decisions/tradeoffs, outcome evidence URLs, accessible media metadata, walkthrough steps, dated milestones, and published project dependencies. New projects default to draft. Project/profile writes require the revision from the admin read endpoint. Reordering authored lists changes the revision; unordered SQL relation retrieval does not.

The optional content section holds reviewed articles, FAQ answers, references, availability/meeting slots, translations, resume variants, skill evidence, and curated tours. Its canonical validator is src/portfolio/types/portfolio-content.ts. The frontend and dashboard mirror that contract. It rejects unknown fields, malformed dates, unsafe URLs, duplicate IDs, invalid languages/timezones, overlapping slots, missing FAQ evidence, and payloads over 48,000 UTF-8 bytes.

Authenticated publication endpoints:

| Method and path | Operation |
| --- | --- |
| GET /api/v1/admin/publication | Read draft, current publication, revision, and saved-version metadata. |
| PUT /api/v1/admin/publication | Save content with its expected integer version. |
| POST /api/v1/admin/publication/publish | Publish the saved draft with version and confirmed: true. |
| POST /api/v1/admin/publication/unpublish | Remove the current publication with version and explicit confirmation. |
| POST /api/v1/admin/publication/restore | Restore restoreVersion as a draft, with current version and explicit confirmation. |

Saving and restoring do not publish. Twenty previous saved drafts are retained. Publishing validates references against current public project and experience IDs and requires a real recorded consent date for each quotation. Database transactions serialize edits and reject stale versions. Publication/inbox mutations record the authenticated actor, action, entity ID, version, and time in the same transaction. Audit rows contain no message bodies, reply addresses, credentials, or receipt tokens.

GET /api/v1/feed returns an Atom feed from public articles and project releases. It escapes text as XML and uses per-entry links. Feed format follows [RFC 4287](https://www.rfc-editor.org/rfc/rfc4287).

Previously published content can remain in external caches and downloads. Unpublishing cannot recall those copies. Never publish private source material as a temporary draft.

## Private inquiries and meetings

POST /api/v1/inquiries accepts a UUID request ID, a 32-byte random base64url receipt, name, reply email, topic, message, explicit consent, and optional slot/timezone. The server stores receipt and request hashes. Identical retries return the existing receipt; changed content under the same ID is rejected. Only status, expiry, and the requested meeting time are returned publicly.

POST /api/v1/inquiries/status requires the request ID and receipt in the JSON body. Tokens never go in query strings. There is no public inbox listing or public message readback. Anonymous requests require an allowed Origin and JSON content type. Per-process limits allow five submissions and 60 status checks per IP/hour, with a 2,000-request global hourly cap. The database caps retained inquiries at 2,000. Multiple server instances still share meeting locks and the inbox cap; use trusted edge limits if deploying several instances. Do not enable broad proxy trust or trust client-supplied forwarded IP headers.

Requests expire after 30 days and cannot be read or changed after expiry. The running service removes expired rows hourly and during inbox/submit operations. Infrastructure backups have their own operator-managed retention.

Meeting slots are authored in UTC and displayed in the selected IANA timezone. Only future slots within the next 21 days accept requests. Received requests do not reserve a time. Admin confirmation locks the inquiry transaction and rejects overlaps with any other confirmed meeting.

The authenticated inbox uses GET /api/v1/admin/inquiries?page=0, PATCH /api/v1/admin/inquiries/:id, and DELETE /api/v1/admin/inquiries/:id. Updates/deletion require the loaded version and confirmed: true. Valid states are received, reviewed, confirmed, declined, and closed. No email is sent automatically. The dashboard provides a manual reply link; the private receipt reports the current state.

## Assistant and network boundaries

The assistant receives only the public projection. Its reference context includes exact project, experience, and FAQ paths. If a provider fails, the service returns a labeled public-data lookup; the frontend can perform the same lookup without the backend. Responses are bounded while streaming, redirects are rejected, and provider bodies/credentials are excluded from diagnostics.

AI_PROVIDER selects a supported provider; AI_MODEL can explicitly select an available model. AI_CONFIG_SOURCE selects database-first or environment configuration. Cloud provider URLs are constrained to their approved endpoints; local Ollama must use loopback. No paid provider request was made in this review.

The default Anthropic model is claude-sonnet-5-5. The previous claude-3-5-sonnet-20240620 default was retired according to [Anthropic's deprecation documentation](https://platform.claude.com/docs/en/about-claude/model-deprecations). Explicit model settings remain unchanged. Recheck provider availability when deploying.

## Validation

- npm run build
- npm test -- --runInBand
- npm run test:migrations
- npm audit --omit=dev

The migration check creates disposable PostgreSQL through PGlite, including browser roles with permissive defaults, then verifies that the migrations remove their table access. Unit tests cover authentication, revision conflicts, publication validation, receipt privacy/idempotency, meeting collisions, rate/origin checks, and streamed response bounds. Browser tests live in ../portfolio and use fixture APIs.

The dashboard policy currently limits its changes to source review. No dashboard build, browser check, real OAuth sign-in, real SMTP delivery, production database migration, or paid provider call is claimed by these checks.

## Atomic management studio

Apply migrations/20261014_management_studio.sql after the authentication, audit and inquiry migrations. This change has been exercised against a disposable PostgreSQL-compatible PGlite database; no production migration was run. Studio tables and recovery documents are server-only with RLS and no anonymous/authenticated grants.

Authenticated /api/v1/admin/studio endpoints manage a versioned draft containing every portfolio section. Save does not publish. Explicit revision-bound approval precedes publication; public API, inquiry availability and meeting validation read only that approved release. Changes use a transaction and advisory lock. Public projection excludes draft projects and private management metadata.

History retains 20 drafts within 4 MiB; trash retains 100 records within 150 KB. Recovery copies are private per administrator and expire after seven days. Snapshots are explicit approved-public recovery copies in the database, not deployment filesystem writes. Review comments, settings, translation digests and audit records remain private. Imported records receive field/record errors before saving. Private management and authentication responses prohibit caching.

Session endpoints list only the current administrator's newest 100 active sessions, support browser labels, selected revocation, and revocation of all other owned sessions. Labels are not hardware identities. Inquiry notes and reply timestamps are private; visitor receipts use an explicit field projection.

Manual link review checks six URLs per batch, up to 120. It accepts public HTTPS on port 443, rejects private/reserved addresses, pins the validated DNS address, sends HEAD only, follows no redirects, and limits time/concurrency. A HEAD rejection is not proof that a page is unavailable.

Optional public notices have bounded plain text and inclusive UTC date windows. They become eligible to display only after the document is approved and published. Resume assets are publicly reachable immediately after upload; 20 files may be retained. Automatic pruning is disabled, and deletion is serialized with release/recovery writes and rejected for referenced files. Storage deletion itself still depends on the configured provider.

Checks: npm run build, npm test -- --runInBand, npm run test:migrations, npm run test:studio. Dashboard execution is separately prohibited by that repository's AGENTS.md.
