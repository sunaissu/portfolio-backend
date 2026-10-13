import { ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { normalizeCaseStudy } from '../types/project-case-study';

@ValidatorConstraint({ name: 'projectCaseStudy', async: false })
export class ProjectCaseStudyValidator implements ValidatorConstraintInterface {
  validate(value: unknown) { try { normalizeCaseStudy(value); return true; } catch { return false; } }
  defaultMessage() { return 'Invalid case study. Use bounded text, HTTPS media/evidence links, valid dates and numeric dependency IDs.'; }
}
