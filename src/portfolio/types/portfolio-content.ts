export interface PortfolioContent {
  notices: Array<{id:string;message:string;startsOn:string;endsOn:string;severity:'info'|'warning'}>;
  articles: Array<{
    id: string;
    title: string;
    summary: string;
    body: string;
    date: string;
    locale: string;
    projectIds: number[];
  }>;
  faq: Array<{
    id: string;
    question: string;
    answer: string;
    projectIds: number[];
    roleIds: number[];
  }>;
  testimonials: Array<{
    id: string;
    quote: string;
    name: string;
    relationship: string;
    sourceUrl: string;
    consentDate: string;
  }>;
  availability: null | {
    status: 'available' | 'limited' | 'unavailable';
    workTypes: string[];
    updatedOn: string;
    timezone: string;
    slots: Array<{ id: string; startsAt: string; endsAt: string }>;
  };
  locales: Array<{
    locale: string;
    label: string;
    title: string;
    summary: string;
    projects: Array<{ id: number; name: string; description: string }>;
  }>;
  resumes: Array<{
    id: string;
    title: string;
    locale: string;
    projectIds: number[];
  }>;
  evidence: Array<{ skill: string; projectIds: number[]; roleIds: number[] }>;
  tours: Array<{
    id: string;
    title: string;
    introduction: string;
    projectIds: number[];
  }>;
}
export const emptyContent = (): PortfolioContent => ({
  notices: [],
  articles: [],
  faq: [],
  testimonials: [],
  availability: null,
  locales: [],
  resumes: [],
  evidence: [],
  tours: [],
});

/** Identical contract in the backend, public client and authenticated editor. Plain text only. */
export function normalizeContent(value: unknown): PortfolioContent {
  if (value == null) return emptyContent();
  const record = (value: unknown, keys: string[]) => {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.keys(value).some((key) => !keys.includes(key))
    )
      throw new Error('Publication contains an unknown field.');
    return value as Record<string, unknown>;
  };
  const text = (value: unknown, max: number, required = true): string => {
    if (value == null && !required) return '';
    if (
      typeof value !== 'string' ||
      value.length > max ||
      (required && !value.trim()) ||
      Array.from(value).some(
        (char) =>
          (char.charCodeAt(0) < 32 && !['\n', '\r', '\t'].includes(char)) ||
          char.charCodeAt(0) === 127,
      )
    )
      throw new Error(
        `Publication text must be ${required ? 'nonempty and ' : ''}at most ${max} characters.`,
      );
    return value.trim();
  };
  const list = (value: unknown, max: number): unknown[] => {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > max)
      throw new Error(`Publication lists allow at most ${max} entries.`);
    return value;
  };
  const number = (value: unknown) => {
    if (!Number.isSafeInteger(value) || Number(value) < 1)
      throw new Error('References must use positive IDs.');
    return Number(value);
  };
  const unique = <T>(items: T[], key: (item: T) => string | number) => {
    if (new Set(items.map(key)).size !== items.length)
      throw new Error('Publication contains duplicate IDs.');
    return items;
  };
  const ids = (value: unknown) =>
    unique(list(value, 30).map(number), (item) => item);
  const slug = (value: unknown) => {
    const result = text(value, 60);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result))
      throw new Error('Use a lowercase ID with letters, numbers and hyphens.');
    return result;
  };
  const locale = (value: unknown) => {
    const result = text(value, 35);
    try {
      if (!/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(result)) throw new Error();
      return Intl.getCanonicalLocales(result)[0];
    } catch {
      throw new Error('Use a valid language tag, such as en or fil.');
    }
  };
  const date = (value: unknown) => {
    const result = text(value, 10);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(result) ||
      !Number.isFinite(Date.parse(result)) ||
      new Date(result).toISOString().slice(0, 10) !== result
    )
      throw new Error('Use a real YYYY-MM-DD date.');
    return result;
  };
  const instant = (value: unknown) => {
    const result = text(value, 24);
    if (
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(result) ||
      !Number.isFinite(Date.parse(result))
    )
      throw new Error('Use a UTC date and time ending in Z.');
    const normalized = new Date(result).toISOString();
    if (
      normalized !==
      (result.length === 20 ? result.replace('Z', '.000Z') : result)
    )
      throw new Error('Use a real UTC date and time.');
    return normalized;
  };
  const url = (value: unknown) => {
    const raw = text(value, 2048);
    try {
      const parsed = new URL(raw);
      if (
        parsed.protocol !== 'https:' ||
        parsed.username ||
        parsed.password ||
        /\s/.test(raw)
      )
        throw new Error();
      return parsed.href;
    } catch {
      throw new Error('Use an HTTPS URL without credentials.');
    }
  };
  const input = record(value, [
    'notices',
    'articles',
    'faq',
    'testimonials',
    'availability',
    'locales',
    'resumes',
    'evidence',
    'tours',
  ]);
  let availability: PortfolioContent['availability'] = null;
  if (input.availability != null) {
    const item = record(input.availability, [
      'status',
      'workTypes',
      'updatedOn',
      'timezone',
      'slots',
    ]);
    if (!['available', 'limited', 'unavailable'].includes(String(item.status)))
      throw new Error('Choose an availability status.');
    const timezone = text(item.timezone, 100);
    try {
      new Intl.DateTimeFormat('en', { timeZone: timezone }).format();
    } catch {
      throw new Error('Use a valid IANA timezone.');
    }
    const slots = unique(
      list(item.slots, 30).map((value) => {
        const slot = record(value, ['id', 'startsAt', 'endsAt']);
        const startsAt = instant(slot.startsAt),
          endsAt = instant(slot.endsAt);
        if (
          Date.parse(endsAt) <= Date.parse(startsAt) ||
          Date.parse(endsAt) - Date.parse(startsAt) > 4 * 3600000
        )
          throw new Error(
            'Meeting slots must last between one second and four hours.',
          );
        return { id: slug(slot.id), startsAt, endsAt };
      }),
      (slot) => slot.id,
    );
    for (const [index, slot] of slots.entries())
      if (
        slots.some(
          (other, i) =>
            i !== index &&
            other.startsAt < slot.endsAt &&
            slot.startsAt < other.endsAt,
        )
      )
        throw new Error('Meeting slots must not overlap.');
    availability = {
      status: item.status as NonNullable<
        PortfolioContent['availability']
      >['status'],
      workTypes: list(item.workTypes, 12).map((value) => text(value, 100)),
      updatedOn: date(item.updatedOn),
      timezone,
      slots,
    };
  }
  const result: PortfolioContent = {
    articles: unique(
      list(input.articles, 30).map((value) => {
        const item = record(value, [
          'id',
          'title',
          'summary',
          'body',
          'date',
          'locale',
          'projectIds',
        ]);
        return {
          id: slug(item.id),
          title: text(item.title, 200),
          summary: text(item.summary, 500),
          body: text(item.body, 12000),
          date: date(item.date),
          locale: locale(item.locale),
          projectIds: ids(item.projectIds),
        };
      }),
      (item) => item.id,
    ),
    faq: unique(
      list(input.faq, 30).map((value) => {
        const item = record(value, [
          'id',
          'question',
          'answer',
          'projectIds',
          'roleIds',
        ]);
        const projectIds = ids(item.projectIds),
          roleIds = ids(item.roleIds);
        if (!projectIds.length && !roleIds.length)
          throw new Error(
            'FAQ answers require public project or experience evidence.',
          );
        return {
          id: slug(item.id),
          question: text(item.question, 300),
          answer: text(item.answer, 2000),
          projectIds,
          roleIds,
        };
      }),
      (item) => item.id,
    ),
    testimonials: unique(
      list(input.testimonials, 20).map((value) => {
        const item = record(value, [
          'id',
          'quote',
          'name',
          'relationship',
          'sourceUrl',
          'consentDate',
        ]);
        return {
          id: slug(item.id),
          quote: text(item.quote, 1500),
          name: text(item.name, 150),
          relationship: text(item.relationship, 200),
          sourceUrl: url(item.sourceUrl),
          consentDate: date(item.consentDate),
        };
      }),
      (item) => item.id,
    ),
    notices: unique(list(input.notices,5).map(value=>{const item=record(value,['id','message','startsOn','endsOn','severity']);const startsOn=date(item.startsOn),endsOn=date(item.endsOn);if(endsOn<startsOn||!['info','warning'].includes(String(item.severity)))throw new Error('Use a valid notice interval and severity.');return {id:slug(item.id),message:text(item.message,500),startsOn,endsOn,severity:item.severity as 'info'|'warning'};}),item=>item.id),
    availability,
    locales: unique(
      list(input.locales, 8).map((value) => {
        const item = record(value, [
          'locale',
          'label',
          'title',
          'summary',
          'projects',
        ]);
        return {
          locale: locale(item.locale),
          label: text(item.label, 80),
          title: text(item.title, 200),
          summary: text(item.summary, 4000),
          projects: unique(
            list(item.projects, 100).map((value) => {
              const project = record(value, ['id', 'name', 'description']);
              return {
                id: number(project.id),
                name: text(project.name, 200),
                description: text(project.description, 4000),
              };
            }),
            (project) => project.id,
          ),
        };
      }),
      (item) => item.locale,
    ),
    resumes: unique(
      list(input.resumes, 12).map((value) => {
        const item = record(value, ['id', 'title', 'locale', 'projectIds']);
        return {
          id: slug(item.id),
          title: text(item.title, 150),
          locale: locale(item.locale),
          projectIds: ids(item.projectIds),
        };
      }),
      (item) => item.id,
    ),
    evidence: unique(
      list(input.evidence, 100).map((value) => {
        const item = record(value, ['skill', 'projectIds', 'roleIds']);
        return {
          skill: text(item.skill, 100),
          projectIds: ids(item.projectIds),
          roleIds: ids(item.roleIds),
        };
      }),
      (item) => item.skill.toLowerCase(),
    ),
    tours: unique(
      list(input.tours, 12).map((value) => {
        const item = record(value, [
          'id',
          'title',
          'introduction',
          'projectIds',
        ]);
        return {
          id: slug(item.id),
          title: text(item.title, 150),
          introduction: text(item.introduction, 1500),
          projectIds: ids(item.projectIds),
        };
      }),
      (item) => item.id,
    ),
  };
  if (
    result.resumes.some(
      (resume) =>
        resume.locale !== 'en' &&
        !result.locales.some((item) => item.locale === resume.locale),
    )
  )
    throw new Error('Resume languages require reviewed localized content.');
  if (new TextEncoder().encode(JSON.stringify(result)).length > 48000)
    throw new Error('Publication exceeds 48,000 bytes.');
  return result;
}

/** Only references that are still public survive projection. */
export function projectContent(
  value: PortfolioContent,
  projects: number[],
  roles: number[],
): PortfolioContent {
  const p = (ids: number[]) => ids.filter((id) => projects.includes(id)),
    r = (ids: number[]) => ids.filter((id) => roles.includes(id));
  return {
    ...value,
    articles: value.articles.map((item) => ({
      ...item,
      projectIds: p(item.projectIds),
    })),
    faq: value.faq
      .map((item) => ({
        ...item,
        projectIds: p(item.projectIds),
        roleIds: r(item.roleIds),
      }))
      .filter((item) => item.projectIds.length || item.roleIds.length),
    evidence: value.evidence.map((item) => ({
      ...item,
      projectIds: p(item.projectIds),
      roleIds: r(item.roleIds),
    })),
    tours: value.tours.map((item) => ({
      ...item,
      projectIds: p(item.projectIds),
    })),
    resumes: value.resumes.map((item) => ({
      ...item,
      projectIds: p(item.projectIds),
    })),
    locales: value.locales.map((item) => ({
      ...item,
      projects: item.projects.filter((project) =>
        projects.includes(project.id),
      ),
    })),
  };
}

export function findFaq(
  question: string,
  content: PortfolioContent | undefined,
) {
  const query = question.toLowerCase(),
    words = [...new Set(query.match(/[\p{L}\p{N}]{3,}/gu) ?? [])];
  const matches = (content?.faq ?? [])
    .map((item) => ({
      item,
      score: query.includes(item.question.toLowerCase())
        ? 1000
        : words.filter((word) => item.question.toLowerCase().includes(word))
            .length,
    }))
    .filter((item) => item.score >= 2)
    .sort((a, b) => b.score - a.score);
  return matches.length &&
    (matches.length === 1 || matches[0].score > matches[1].score)
    ? matches[0].item
    : undefined;
}
