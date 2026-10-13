import { Controller, Get } from '@nestjs/common';
import { ExperienceResponsibilityService } from '../services/experience-responsibility.service';
import { ExperienceRoleService } from '../services/experience-role.service';
import { ExperienceService } from '../services/experience.service';
import { PersonalInfoService } from '../services/personal-info.service';
import { ProjectLinkService } from '../services/project-link.service';
import { ProjectService } from '../services/project.service';
import { SkillItemService } from '../services/skill-item.service';
import { SkillService } from '../services/skill.service';
import { TechnologyService } from '../services/technology.service';

@Controller('admin')
export class AdminPortfolioController {
  constructor(
    private readonly personalInfoService: PersonalInfoService,
    private readonly projectService: ProjectService,
    private readonly projectLinkService: ProjectLinkService,
    private readonly technologyService: TechnologyService,
    private readonly skillService: SkillService,
    private readonly skillItemService: SkillItemService,
    private readonly experienceService: ExperienceService,
    private readonly experienceRoleService: ExperienceRoleService,
    private readonly responsibilityService: ExperienceResponsibilityService,
  ) {}

  @Get('personal-info')
  personalInfo() {
    return this.personalInfoService.getMyPortfolioInfo();
  }

  @Get('resumes')
  resumes() {
    return this.personalInfoService.getResumes();
  }

  @Get('projects')
  projects() {
    return this.projectService.getAll();
  }

  @Get('project-links')
  projectLinks() {
    return this.projectLinkService.getAll();
  }

  @Get('technologies')
  technologies() {
    return this.technologyService.getAll();
  }

  @Get('skills')
  skills() {
    return this.skillService.getAll();
  }

  @Get('skill-items')
  skillItems() {
    return this.skillItemService.getAll();
  }

  @Get('experiences')
  experiences() {
    return this.experienceService.getAll();
  }

  @Get('experience-roles')
  experienceRoles() {
    return this.experienceRoleService.getAll();
  }

  @Get('experience-responsibilities')
  experienceResponsibilities() {
    return this.responsibilityService.getAll();
  }
}
