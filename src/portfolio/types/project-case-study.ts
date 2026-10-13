export interface ProjectCaseStudy {
  kind: string; role: string; problem: string; scope: string;
  decisions: Array<{ title: string; choice: string; tradeoff: string }>;
  outcomes: Array<{ claim: string; evidenceUrl: string }>;
  gallery: Array<{ type: 'image' | 'video'; url: string; caption: string; alternative: string }>;
  walkthrough: Array<{ title: string; body: string }>;
  milestones: Array<{ date: string; title: string; description: string }>;
  dependencies: number[];
}

/** Shared public contract. No HTML, executable embeds, private fields or credentials. */
export function normalizeCaseStudy(value: unknown): ProjectCaseStudy | null {
  if (value == null) return null;
  const object = (value: unknown, keys: string[]) => {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) throw new Error('Case study contains an unknown field.');
    return value as Record<string, unknown>;
  };
  const text = (value: unknown, max: number, required = false) => {
    if (value == null && !required) return '';
    if (typeof value !== 'string' || value.length > max || required && !value.trim() || Array.from(value).some(char => char.charCodeAt(0) < 32 && !['\n', '\r', '\t'].includes(char))) throw new Error(`Case study text must be ${required ? 'nonempty and ' : ''}at most ${max} characters.`);
    return value.trim();
  };
  const list = (value: unknown, max: number): unknown[] => { if (value === undefined) return []; if (!Array.isArray(value) || value.length > max) throw new Error(`Case study lists allow at most ${max} entries.`); return value; };
  const url = (value: unknown) => { const raw = text(value, 2048, true); let parsed: URL; try { parsed = new URL(raw); } catch { throw new Error('Use an HTTPS URL.'); } if (parsed.protocol !== 'https:' || parsed.username || parsed.password || /\s/.test(raw)) throw new Error('Use an HTTPS URL without credentials.'); return parsed.href; };
  const item = object(value, ['kind', 'role', 'problem', 'scope', 'decisions', 'outcomes', 'gallery', 'walkthrough', 'milestones', 'dependencies']);
  const result: ProjectCaseStudy = {
    kind: text(item.kind, 80), role: text(item.role, 200), problem: text(item.problem, 4000), scope: text(item.scope, 4000),
    decisions: list(item.decisions, 12).map(value => { const row = object(value, ['title', 'choice', 'tradeoff']); return { title: text(row.title, 200, true), choice: text(row.choice, 2000, true), tradeoff: text(row.tradeoff, 2000) }; }),
    outcomes: list(item.outcomes, 12).map(value => { const row = object(value, ['claim', 'evidenceUrl']); return { claim: text(row.claim, 1500, true), evidenceUrl: url(row.evidenceUrl) }; }),
    gallery: list(item.gallery, 12).map(value => { const row = object(value, ['type', 'url', 'caption', 'alternative']); if (row.type !== 'image' && row.type !== 'video') throw new Error('Media must be an image or video.'); return { type: row.type, url: url(row.url), caption: text(row.caption, 1000, true), alternative: text(row.alternative, 4000, true) }; }),
    walkthrough: list(item.walkthrough, 12).map(value => { const row = object(value, ['title', 'body']); return { title: text(row.title, 200, true), body: text(row.body, 2000, true) }; }),
    milestones: list(item.milestones, 30).map(value => { const row = object(value, ['date', 'title', 'description']), date = text(row.date, 10, true); if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error('Use a valid milestone date in YYYY-MM-DD format.'); return { date, title: text(row.title, 200, true), description: text(row.description, 2000) }; }),
    dependencies: list(item.dependencies, 30).map(value => { if (!Number.isSafeInteger(value) || Number(value) < 1) throw new Error('Dependencies must be published project IDs.'); return Number(value); }),
  };
  if (new Set(result.dependencies).size !== result.dependencies.length) throw new Error('A dependency may only appear once.');
  if (new TextEncoder().encode(JSON.stringify(result)).length > 24000) throw new Error('The case study exceeds 24,000 bytes.');
  return result;
}
