import type { PortfolioContent } from './portfolio-content';
import type { ProjectCaseStudy } from './project-case-study';
export interface PublicPersonalInfo {
  id: number;
  name: string;
  location: string;
  linkedin: string;
  portfolio: string;
  summary: string;
  title: string;
  email: string;
  resumeUrl: string | null;
}

export interface PublicProjectLink {
  id: number;
  url: string;
  type: string;
}

export interface PublicTechnology {
  id: number;
  name: string;
}

export interface PublicProject {
  caseStudy?: ProjectCaseStudy | null;
  id: number;
  name: string;
  description: string;
  links: PublicProjectLink[];
  technologies: PublicTechnology[];
  status: string | null;
  isDraft: boolean;
  isFeatured: boolean;
}

export interface PublicSkillItem {
  id: number;
  name: string;
}

export interface PublicSkill {
  id: number;
  category: string;
  items: PublicSkillItem[];
}

export interface PublicExperienceResponsibility {
  id: number;
  description: string;
  order: number;
}

export interface PublicExperienceRole {
  id: number;
  title: string;
  duration: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  responsibilities: PublicExperienceResponsibility[];
}

export interface PublicExperience {
  id: number;
  company: string;
  location: string | null;
  url: string | null;
  description: string;
  roles: PublicExperienceRole[];
}

export interface Education {
  degree: string;
  institution: string;
  year: string;
}

export interface PortfolioTask {
  task: string;
  status: 'Pending' | 'Completed';
}

export interface PortfolioData {
  content?: PortfolioContent;
  profile: PublicPersonalInfo;
  projects: PublicProject[];
  skills: PublicSkill[];
  experience: PublicExperience[];
  education: Education[];
  todo: PortfolioTask[];
}

export type PortfolioDataSource = 'database' | 'cache' | 'snapshot' | 'mixed';

export interface PortfolioDataEnvelope {
  schemaVersion: string;
  generatedAt: string;
  source: PortfolioDataSource;
  isStale: boolean;
  sectionSources: Record<Exclude<keyof PortfolioData, 'content'>, PortfolioDataSource> & { content?: PortfolioDataSource };
  data: PortfolioData;
}

export interface PortfolioHealth {
  databaseCircuit: 'closed' | 'open';
  consecutiveDatabaseFailures: number;
  lastDatabaseFailure:
    | 'unavailable'
    | 'timeout'
    | 'invalid-or-missing-data'
    | 'query-failed'
    | null;
  lastValidationError: string | null;
  cacheAgeSeconds: number | null;
  snapshotGeneratedAt: string;
  publicReadsAvailable: true;
}
