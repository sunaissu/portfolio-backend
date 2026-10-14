import { normalizeContent, projectContent } from '../types/portfolio-content';
import { PublicationService } from './publication.service';
import { normalizeCaseStudy } from '../types/project-case-study';
import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { ExperienceService } from './experience.service';
import { PersonalInfoService } from './personal-info.service';
import { ProjectService } from './project.service';
import { SkillService } from './skill.service';
import { EducationService } from './education.service';
import {
  PortfolioData,
  PortfolioDataEnvelope,
  PortfolioHealth,
  PublicExperience,
  PublicExperienceResponsibility,
  PublicExperienceRole,
  PublicPersonalInfo,
  PublicProject,
  PublicProjectLink,
  PublicSkill,
  PublicSkillItem,
  PublicTechnology,
} from '../types/portfolio-data';

const SCHEMA_VERSION = '1.0.0';
const DATABASE_TIMEOUT_MS = 3500;
const DATABASE_ATTEMPTS = 2;
const RETRY_BASE_DELAY_MS = 75;
const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_RESET_MS = 30000;
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const CACHE_TTL_JITTER_MS = 15 * 60 * 1000;
const MAX_PROJECTS = 200;
const MAX_PROJECT_LINKS = 20;
const MAX_TECHNOLOGIES = 100;
const MAX_SKILLS = 100;
const MAX_SKILL_ITEMS = 200;
const MAX_EXPERIENCES = 100;
const MAX_EXPERIENCE_ROLES = 50;
const MAX_RESPONSIBILITIES = 100;
const MAX_EDUCATION_ITEMS = 100;
const MAX_TODO_ITEMS = 500;
const MAX_ENVELOPE_BYTES = 1024 * 1024;
const YEAR_MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
const ISO_DATE_TIME_PATTERN =
  /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d+)?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

class PortfolioPayloadError extends Error {}

class PortfolioTimeoutError extends Error {}

interface MemoryCacheEntry {
  envelope: PortfolioDataEnvelope;
  cachedAt: number;
  usableUntil: number;
}

@Injectable()
export class PortfolioDataService {
  private readonly logger = new Logger(PortfolioDataService.name);
  private readonly snapshot: PortfolioDataEnvelope;
  private lastKnownGood: MemoryCacheEntry | null = null;
  private databaseReadInFlight: Promise<PortfolioDataEnvelope> | null = null;
  private consecutiveFailures = 0;
  private circuitOpenUntil = 0;
  private lastDatabaseFailure: PortfolioHealth['lastDatabaseFailure'] = null;
  private lastValidationError: string | null = null;

  constructor(
    private readonly personalInfoService: PersonalInfoService,
    private readonly projectService: ProjectService,
    private readonly skillService: SkillService,
    private readonly experienceService: ExperienceService,
    private readonly dataSource: DataSource,
    private readonly educationService: EducationService,
    private readonly publicationService: PublicationService,
  ) {
    this.snapshot = this.loadSnapshot();
  }

  async getPortfolio(): Promise<PortfolioDataEnvelope> {
    if (!this.dataSource.isInitialized) {
      this.lastDatabaseFailure = 'unavailable';
      return this.cloneEnvelope(this.fallbackEnvelope());
    }
    if (Date.now() < this.circuitOpenUntil) {
      return this.cloneEnvelope(this.fallbackEnvelope());
    }

    if (!this.databaseReadInFlight) {
      const operation = this.readDatabaseOrFallback();
      this.databaseReadInFlight = operation.finally(() => {
        this.databaseReadInFlight = null;
      });
    }

    return this.cloneEnvelope(await this.databaseReadInFlight);
  }

  private async readManagedPublication(): Promise<PortfolioDataEnvelope|null> {
    try {
      const rows=await this.dataSource.query<Array<{published:unknown;published_at:string}>>('SELECT published, published_at FROM portfolio_studio WHERE id=1 AND published IS NOT NULL');
      if(!rows?.length)return null;
      const data=this.publicProjection(rows[0].published);
      const envelope:PortfolioDataEnvelope={schemaVersion:SCHEMA_VERSION,generatedAt:new Date(rows[0].published_at).toISOString(),source:'database',isStale:false,sectionSources:{profile:'database',projects:'database',skills:'database',experience:'database',education:'database',todo:'database',content:'database'},data};
      this.assertEnvelopeSize(envelope);return envelope;
    }catch(error){if((error as {code?:string;driverError?:{code?:string}})?.code==='42P01'||(error as {driverError?:{code?:string}})?.driverError?.code==='42P01')return null;throw error;}
  }

  getHealth(): PortfolioHealth {
    const now = Date.now();
    return {
      databaseCircuit: now < this.circuitOpenUntil ? 'open' : 'closed',
      consecutiveDatabaseFailures: this.consecutiveFailures,
      lastDatabaseFailure: this.lastDatabaseFailure,
      lastValidationError: this.lastValidationError,
      cacheAgeSeconds: this.lastKnownGood
        ? Math.max(0, Math.floor((now - this.lastKnownGood.cachedAt) / 1000))
        : null,
      snapshotGeneratedAt: this.snapshot.generatedAt,
      publicReadsAvailable: true,
    };
  }

  private async readDatabaseOrFallback(): Promise<PortfolioDataEnvelope> {
    const startedAt = Date.now();
    try {
      const managed=await this.readManagedPublication();
      if(managed){this.lastKnownGood={envelope:managed,cachedAt:Date.now(),usableUntil:Date.now()+CACHE_MAX_AGE_MS};this.consecutiveFailures=0;this.circuitOpenUntil=0;this.lastDatabaseFailure=null;this.lastValidationError=null;return managed;}
      const live = await this.retryTransient(() =>
        this.withTimeout(() =>
          Promise.all([
            this.personalInfoService.getMyPortfolioInfo(),
            this.projectService.getAll(),
            this.skillService.getAll(),
            this.experienceService.getAll(),
            this.educationService.getPublicOrNull(),
            this.publicationService.getPublicOrNull(),
          ]),
        ),
      );
      const [profile, projects, skills, experience, education, content] = live;
      if (!profile) {
        throw new PortfolioPayloadError(
          'The database portfolio has no public profile',
        );
      }

      const data: PortfolioData = {
        content: normalizeContent(content ?? this.snapshot.data.content),
        profile: this.parseProfile(profile, 'profile'),
        projects: this.parseProjects(
          projects.filter((project) => !project.isDraft),
          'projects',
        ),
        skills: this.parseSkills(skills, 'skills'),
        experience: this.parseExperience(experience, 'experience'),
        education: education === null
          ? this.snapshot.data.education.map((item) => ({ ...item }))
          : this.array(education, 'education', MAX_EDUCATION_ITEMS).map((raw, index) => {
              const item = this.record(raw, `education[${index}]`);
              return {
                degree: this.text(item.degree, `education[${index}].degree`, 200),
                institution: this.text(item.institution, `education[${index}].institution`, 200),
                year: this.text(item.year, `education[${index}].year`, 40),
              };
            }),
        todo: this.snapshot.data.todo.map((item) => ({ ...item })),
      };
      data.content = projectContent(data.content!, data.projects.map(project => project.id), data.experience.flatMap(company => company.roles.map(role => role.id)));
      const envelope: PortfolioDataEnvelope = {
        schemaVersion: SCHEMA_VERSION,
        generatedAt: new Date().toISOString(),
        source: 'mixed',
        isStale: false,
        sectionSources: {
          content: content === null ? 'snapshot' : 'database',
          profile: 'database',
          projects: 'database',
          skills: 'database',
          experience: 'database',
          education: education === null ? 'snapshot' : 'database',
          todo: 'snapshot',
        },
        data,
      };
      this.assertEnvelopeSize(envelope);

      this.lastKnownGood = {
        envelope: this.cloneEnvelope(envelope),
        cachedAt: Date.now(),
        usableUntil:
          Date.now() + CACHE_MAX_AGE_MS - this.cacheExpirationJitter(),
      };
      this.consecutiveFailures = 0;
      this.circuitOpenUntil = 0;
      this.lastDatabaseFailure = null;
      this.lastValidationError = null;
      this.logger.log(
        JSON.stringify({
          event: 'portfolio_source_selected',
          source: envelope.source,
          latencyMs: Date.now() - startedAt,
          schemaVersion: SCHEMA_VERSION,
        }),
      );
      return envelope;
    } catch (error) {
      this.lastValidationError = error instanceof PortfolioPayloadError ? error.message : null;
      this.lastDatabaseFailure =
        error instanceof PortfolioTimeoutError
          ? 'timeout'
          : error instanceof PortfolioPayloadError
            ? 'invalid-or-missing-data'
            : 'query-failed';
      this.consecutiveFailures += 1;
      if (this.consecutiveFailures >= CIRCUIT_FAILURE_THRESHOLD) {
        this.circuitOpenUntil = Date.now() + CIRCUIT_RESET_MS;
      }
      const fallback = this.fallbackEnvelope();
      this.logger.warn(
        JSON.stringify({
          event: 'portfolio_fallback_activated',
          source: fallback.source,
          latencyMs: Date.now() - startedAt,
          failureType:
            error instanceof Error ? error.constructor.name : 'UnknownError',
          failureReason: this.lastDatabaseFailure,
          consecutiveFailures: this.consecutiveFailures,
          circuitState:
            Date.now() < this.circuitOpenUntil ? 'open' : 'closed',
        }),
      );
      return fallback;
    }
  }

  private fallbackEnvelope(): PortfolioDataEnvelope {
    const now = Date.now();
    if (this.lastKnownGood && now <= this.lastKnownGood.usableUntil) {
      return this.withFallbackProvenance(
        this.lastKnownGood.envelope,
        'cache',
      );
    }
    if (this.lastKnownGood) {
      this.lastKnownGood = null;
    }
    return this.withFallbackProvenance(this.snapshot, 'snapshot');
  }

  private withFallbackProvenance(
    envelope: PortfolioDataEnvelope,
    source: 'cache' | 'snapshot',
  ): PortfolioDataEnvelope {
    return {
      ...envelope,
      source,
      isStale: true,
      sectionSources: {
        content: source,
        profile: source,
        projects: source,
        skills: source,
        experience: source,
        education: source,
        todo: source,
      },
    };
  }

  private async retryTransient<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= DATABASE_ATTEMPTS; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt === DATABASE_ATTEMPTS || !this.isTransient(error)) {
          throw error;
        }
        const jitter = Math.floor(Math.random() * RETRY_BASE_DELAY_MS);
        await new Promise<void>((resolve) =>
          setTimeout(
            resolve,
            RETRY_BASE_DELAY_MS * 2 ** (attempt - 1) + jitter,
          ),
        );
      }
    }
    throw lastError;
  }

  private isTransient(error: unknown): boolean {
    if (error instanceof PortfolioTimeoutError) return true;
    if (!(error instanceof Error)) return false;
    const candidate = error as Error & {
      code?: string;
      driverError?: { code?: string };
    };
    const code = candidate.code ?? candidate.driverError?.code;
    return (
      candidate.name === 'CannotExecuteNotConnectedError' ||
      [
        'ECONNREFUSED',
        'ECONNRESET',
        'ETIMEDOUT',
        'EAI_AGAIN',
        '53300',
        '57P01',
        '57P02',
        '57P03',
        '40001',
        '40P01',
      ].includes(code ?? '')
    );
  }

  private async withTimeout<T>(operation: () => Promise<T>): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const expired = new Promise<never>((_, reject) => {
      timeout = setTimeout(
        () => reject(new PortfolioTimeoutError('Database request timed out')),
        DATABASE_TIMEOUT_MS,
      );
    });
    try {
      return await Promise.race([operation(), expired]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  private cacheExpirationJitter(): number {
    return Math.floor(Math.random() * CACHE_TTL_JITTER_MS);
  }

  private loadSnapshot(): PortfolioDataEnvelope {
    const path = join(__dirname, '..', 'data', 'portfolio.snapshot.json');
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    const record = this.record(parsed, 'snapshot');
    if (record.schemaVersion !== SCHEMA_VERSION) {
      throw new PortfolioPayloadError('Snapshot schema version is unsupported');
    }
    const generatedAt = this.isoDate(record.generatedAt, 'generatedAt');
    if (record.source !== 'snapshot') {
      throw new PortfolioPayloadError('Snapshot source is invalid');
    }
    if (record.isStale !== true) {
      throw new PortfolioPayloadError('Snapshot stale state is invalid');
    }
    const sectionSources = this.record(
      record.sectionSources,
      'snapshot.sectionSources',
    );
    const snapshotSections: Array<keyof PortfolioData> = [
      'profile',
      'projects',
      'skills',
      'experience',
      'education',
      'todo',
    ];
    if (
      snapshotSections.some((section) => sectionSources[section] !== 'snapshot')
    ) {
      throw new PortfolioPayloadError('Snapshot section sources are invalid');
    }
    const data = this.parsePortfolioData(record.data, 'data');
    const envelope: PortfolioDataEnvelope = {
      schemaVersion: SCHEMA_VERSION,
      generatedAt,
      source: 'snapshot',
      isStale: true,
      sectionSources: {
        content: 'snapshot',
        profile: 'snapshot',
        projects: 'snapshot',
        skills: 'snapshot',
        experience: 'snapshot',
        education: 'snapshot',
        todo: 'snapshot',
      },
      data,
    };
    this.assertEnvelopeSize(envelope);
    return envelope;
  }

  normalizeDraft(value: unknown): PortfolioData {
    const data=this.parsePortfolioData(value, 'draft', true);
    const unique=(items:Array<{id:number}>,name:string)=>{if(new Set(items.map(item=>item.id)).size!==items.length)throw new Error('Duplicate IDs in '+name);};
    unique(data.projects,'projects');unique(data.skills,'skills');unique(data.experience,'experience');for(const project of data.projects){unique(project.links,'project links');unique(project.technologies,'project technologies');}for(const skill of data.skills)unique(skill.items,'skill items');for(const company of data.experience){unique(company.roles,'roles');for(const role of company.roles)unique(role.responsibilities,'responsibilities');}
    if(Buffer.byteLength(JSON.stringify(data), 'utf8')>250000)throw new Error('Draft exceeds 250,000 bytes.');
    return data;
  }

  publicProjection(value: unknown): PortfolioData {
    const data=this.parsePortfolioData(value, 'publication');
    data.content=projectContent(data.content!,data.projects.map(p=>p.id),data.experience.flatMap(e=>e.roles.map(r=>r.id)));
    return data;
  }

  private parsePortfolioData(value: unknown, path: string, retainDrafts=false): PortfolioData {
    const data = this.record(value, path);
    return {
      content: normalizeContent(data.content),
      profile: this.parseProfile(data.profile, `${path}.profile`),
      projects: this.parseProjects(data.projects, `${path}.projects`, retainDrafts),
      skills: this.parseSkills(data.skills, `${path}.skills`),
      experience: this.parseExperience(data.experience, `${path}.experience`),
      education: this.array(
        data.education,
        `${path}.education`,
        MAX_EDUCATION_ITEMS,
      ).map(
        (value, index) => {
          const item = this.record(value, `${path}.education[${index}]`);
          return {
            degree: this.text(
              item.degree,
              `${path}.education[${index}].degree`,
              200,
            ),
            institution: this.text(
              item.institution,
              `${path}.education[${index}].institution`,
              200,
            ),
            year: this.text(
              item.year,
              `${path}.education[${index}].year`,
              40,
            ),
          };
        },
      ),
      todo: this.array(data.todo, `${path}.todo`, MAX_TODO_ITEMS).map(
        (value, index) => {
          const item = this.record(value, `${path}.todo[${index}]`);
          if (item.status !== 'Pending' && item.status !== 'Completed') {
            throw new PortfolioPayloadError(
              `${path}.todo[${index}].status is invalid`,
            );
          }
          return {
            task: this.text(
              item.task,
              `${path}.todo[${index}].task`,
              10000,
            ),
            status: item.status,
          };
        },
      ),
    };
  }

  private parseProfile(value: unknown, path: string): PublicPersonalInfo {
    const item = this.record(value, path);
    const email = this.text(item.email, `${path}.email`, 320);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new PortfolioPayloadError(`${path}.email is invalid`);
    }
    return {
      id: this.id(item.id, `${path}.id`),
      name: this.text(item.name, `${path}.name`, 200),
      location: this.text(item.location, `${path}.location`, 200),
      linkedin: this.webUrl(item.linkedin, `${path}.linkedin`),
      portfolio: this.webUrl(item.portfolio, `${path}.portfolio`),
      summary: this.text(item.summary, `${path}.summary`, 10000),
      title: this.text(item.title, `${path}.title`, 200),
      email,
      resumeUrl: this.optionalUrl(item.resumeUrl, `${path}.resumeUrl`, true),
    };
  }

  private parseProjects(value: unknown, path: string, retainDrafts=false): PublicProject[] {
    const projects = this.array(value, path, MAX_PROJECTS).map((raw, index) => {
      const itemPath = `${path}[${index}]`;
      const item = this.record(raw, itemPath);
      return {
        id: this.id(item.id, `${itemPath}.id`),
        name: this.text(item.name, `${itemPath}.name`, 200),
        description: this.text(
          item.description,
          `${itemPath}.description`,
          10000,
        ),
        links: this.parseProjectLinks(item.links, `${itemPath}.links`),
        technologies: this.parseTechnologies(
          item.technologies,
          `${itemPath}.technologies`,
        ),
        status: this.optionalText(item.status, `${itemPath}.status`, 80),
        caseStudy: normalizeCaseStudy(item.caseStudy),
        isDraft: this.boolean(item.isDraft, `${itemPath}.isDraft`),
        isFeatured: this.boolean(item.isFeatured, `${itemPath}.isFeatured`),
      };
    });
    if(retainDrafts)return projects;
    const published = projects.filter(project => !project.isDraft), ids = new Set(published.map(project => project.id));
    return published.map(project => ({ ...project, caseStudy: project.caseStudy ? { ...project.caseStudy, dependencies: project.caseStudy.dependencies.filter(id => id !== project.id && ids.has(id)) } : null }));
  }

  private parseProjectLinks(
    value: unknown,
    path: string,
  ): PublicProjectLink[] {
    return this.array(value, path, MAX_PROJECT_LINKS).map((raw, index) => {
      const itemPath = `${path}[${index}]`;
      const item = this.record(raw, itemPath);
      return {
        id: this.id(item.id, `${itemPath}.id`),
        url: this.webUrl(item.url, `${itemPath}.url`),
        type: this.text(item.type, `${itemPath}.type`, 40),
      };
    });
  }

  private parseTechnologies(
    value: unknown,
    path: string,
  ): PublicTechnology[] {
    return this.array(value, path, MAX_TECHNOLOGIES).map((raw, index) => {
      const itemPath = `${path}[${index}]`;
      const item = this.record(raw, itemPath);
      return {
        id: this.id(item.id, `${itemPath}.id`),
        name: this.text(item.name, `${itemPath}.name`, 200),
      };
    });
  }

  private parseSkills(value: unknown, path: string): PublicSkill[] {
    return this.array(value, path, MAX_SKILLS).map((raw, index) => {
      const itemPath = `${path}[${index}]`;
      const item = this.record(raw, itemPath);
      return {
        id: this.id(item.id, `${itemPath}.id`),
        category: this.text(item.category, `${itemPath}.category`, 200),
        items: this.parseSkillItems(item.items, `${itemPath}.items`),
      };
    });
  }

  private parseSkillItems(value: unknown, path: string): PublicSkillItem[] {
    return this.array(value, path, MAX_SKILL_ITEMS).map((raw, index) => {
      const itemPath = `${path}[${index}]`;
      const item = this.record(raw, itemPath);
      return {
        id: this.id(item.id, `${itemPath}.id`),
        name: this.text(item.name, `${itemPath}.name`, 200),
      };
    });
  }

  private parseExperience(value: unknown, path: string): PublicExperience[] {
    return this.array(value, path, MAX_EXPERIENCES).map((raw, index) => {
      const itemPath = `${path}[${index}]`;
      const item = this.record(raw, itemPath);
      return {
        id: this.id(item.id, `${itemPath}.id`),
        company: this.text(item.company, `${itemPath}.company`, 200),
        location: this.optionalText(item.location, `${itemPath}.location`, 200),
        url: this.optionalUrl(item.url, `${itemPath}.url`),
        description: this.text(
          item.description,
          `${itemPath}.description`,
          10000,
        ),
        roles: this.parseExperienceRoles(item.roles, `${itemPath}.roles`),
      };
    });
  }

  private parseExperienceRoles(
    value: unknown,
    path: string,
  ): PublicExperienceRole[] {
    return this.array(value, path, MAX_EXPERIENCE_ROLES).map((raw, index) => {
      const itemPath = `${path}[${index}]`;
      const item = this.record(raw, itemPath);
      return {
        id: this.id(item.id, `${itemPath}.id`),
        title: this.text(item.title, `${itemPath}.title`, 200),
        duration: this.optionalText(item.duration, `${itemPath}.duration`, 100),
        startDate: this.optionalYearMonth(
          item.startDate,
          `${itemPath}.startDate`,
        ),
        endDate: this.optionalYearMonth(item.endDate, `${itemPath}.endDate`),
        isCurrent: this.boolean(item.isCurrent, `${itemPath}.isCurrent`),
        responsibilities: this.parseResponsibilities(
          item.responsibilities,
          `${itemPath}.responsibilities`,
        ),
      };
    });
  }

  private parseResponsibilities(
    value: unknown,
    path: string,
  ): PublicExperienceResponsibility[] {
    return this.array(value, path, MAX_RESPONSIBILITIES)
      .map((raw, index) => {
        const itemPath = `${path}[${index}]`;
        const item = this.record(raw, itemPath);
        return {
          id: this.id(item.id, `${itemPath}.id`),
          description: this.text(
            item.description,
            `${itemPath}.description`,
            10000,
          ),
          order: this.nonNegativeInteger(
            item.order,
            `${itemPath}.order`,
            10000,
          ),
        };
      })
      .sort((left, right) => left.order - right.order);
  }

  private record(value: unknown, path: string): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new PortfolioPayloadError(`${path} must be an object`);
    }
    return value as Record<string, unknown>;
  }

  private array(value: unknown, path: string, maxSize: number): unknown[] {
    if (!Array.isArray(value) || value.length > maxSize) {
      throw new PortfolioPayloadError(`${path} must be a bounded array`);
    }
    return value;
  }

  private id(value: unknown, path: string): number {
    if (!Number.isSafeInteger(value) || (value as number) <= 0) {
      throw new PortfolioPayloadError(`${path} must be a positive integer`);
    }
    return value as number;
  }

  private nonNegativeInteger(
    value: unknown,
    path: string,
    max: number,
  ): number {
    if (
      !Number.isSafeInteger(value) ||
      (value as number) < 0 ||
      (value as number) > max
    ) {
      throw new PortfolioPayloadError(
        `${path} must be a non-negative integer`,
      );
    }
    return value as number;
  }

  private text(value: unknown, path: string, maxLength = 200): string {
    if (typeof value !== 'string') {
      throw new PortfolioPayloadError(`${path} must be non-empty text`);
    }
    const normalized = value.trim();
    if (!normalized || normalized.length > maxLength) {
      throw new PortfolioPayloadError(`${path} must be non-empty text`);
    }
    return normalized;
  }

  private optionalText(
    value: unknown,
    path: string,
    maxLength = 200,
  ): string | null {
    if (value == null || (typeof value === 'string' && !value.trim())) return null;
    return this.text(value, path, maxLength);
  }

  private optionalYearMonth(value: unknown, path: string): string | null {
    if (value == null || (typeof value === 'string' && !value.trim())) return null;
    const normalized = this.text(value, path, 100);
    if (YEAR_MONTH_PATTERN.test(normalized)) return normalized;
    const legacy = /^(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{4})$/i.exec(normalized);
    if (legacy) {
      const month = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(legacy[1].slice(0, 3).toLowerCase()) + 1;
      return `${legacy[2]}-${String(month).padStart(2, '0')}`;
    }
    throw new PortfolioPayloadError(`${path} must use YYYY-MM`);
  }

  private boolean(value: unknown, path: string): boolean {
    if (typeof value !== 'boolean') {
      throw new PortfolioPayloadError(`${path} must be a boolean`);
    }
    return value;
  }

  private webUrl(value: unknown, path: string): string {
    const url = this.text(value, path, 2048);
    if (url.includes('\\') || /\s/.test(url)) {
      throw new PortfolioPayloadError(`${path} must be a valid URL`);
    }
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new PortfolioPayloadError(`${path} must be a valid URL`);
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new PortfolioPayloadError(`${path} must use HTTP or HTTPS`);
    }
    if (parsed.username || parsed.password) {
      throw new PortfolioPayloadError(`${path} must not include credentials`);
    }
    return url;
  }

  private optionalUrl(
    value: unknown,
    path: string,
    allowRelative = false,
  ): string | null {
    if (value === null || value === undefined || value === '') return null;
    const url = this.text(value, path, 2048);
    if (allowRelative && url.startsWith('/')) {
      if (url.startsWith('//') || url.includes('\\') || /\s/.test(url)) {
        throw new PortfolioPayloadError(
          `${path} must be a safe root-relative URL`,
        );
      }
      return url;
    }
    return this.webUrl(url, path);
  }

  private isoDate(value: unknown, path: string): string {
    const date = this.text(value, path, 64);
    const match = ISO_DATE_TIME_PATTERN.exec(date);
    if (!match || !Number.isFinite(Date.parse(date))) {
      throw new PortfolioPayloadError(`${path} must be an ISO date`);
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    if (day > daysInMonth) {
      throw new PortfolioPayloadError(`${path} must be an ISO date`);
    }
    return date;
  }

  private cloneEnvelope(envelope: PortfolioDataEnvelope): PortfolioDataEnvelope {
    return JSON.parse(JSON.stringify(envelope)) as PortfolioDataEnvelope;
  }

  private assertEnvelopeSize(envelope: PortfolioDataEnvelope): void {
    if (Buffer.byteLength(JSON.stringify(envelope), 'utf8') > MAX_ENVELOPE_BYTES) {
      throw new PortfolioPayloadError('Portfolio envelope is too large');
    }
  }
}
