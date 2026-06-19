import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PersonalInfo } from './models/personal-info.model';
import { Project } from './models/project.model';
import { Skill } from './models/skill.model';
import { Experience } from './models/experience.model';
import { ExperienceRole } from './models/experience-role.model';
import { Technology } from './models/technology.model';
import { ProjectLink } from './models/project-link.model';
import { SkillItem } from './models/skill-item.model';

import { PersonalInfoController } from './controllers/personal-info.controller';
import { PersonalInfoService } from './services/personal-info.service';
import { PersonalInfoRepository } from './repositories/personal-info.repository';
import { ProjectController } from './controllers/project.controller';
import { ProjectService } from './services/project.service';
import { ProjectRepository } from './repositories/project.repository';
import { SkillController } from './controllers/skill.controller';
import { SkillService } from './services/skill.service';
import { SkillRepository } from './repositories/skill.repository';
import { ExperienceController } from './controllers/experience.controller';
import { ExperienceService } from './services/experience.service';
import { ExperienceRepository } from './repositories/experience.repository';
import { ExperienceRoleController } from './controllers/experience-role.controller';
import { ExperienceRoleService } from './services/experience-role.service';
import { ExperienceRoleRepository } from './repositories/experience-role.repository';
import { TechnologyController } from './controllers/technology.controller';
import { TechnologyService } from './services/technology.service';
import { TechnologyRepository } from './repositories/technology.repository';
import { ProjectLinkController } from './controllers/project-link.controller';
import { ProjectLinkService } from './services/project-link.service';
import { ProjectLinkRepository } from './repositories/project-link.repository';
import { SkillItemController } from './controllers/skill-item.controller';
import { SkillItemService } from './services/skill-item.service';
import { SkillItemRepository } from './repositories/skill-item.repository';
import { ExperienceResponsibility } from './models/experience-responsibility.model';
import { ExperienceResponsibilityController } from './controllers/experience-responsibility.controller';
import { ExperienceResponsibilityService } from './services/experience-responsibility.service';
import { ExperienceResponsibilityRepository } from './repositories/experience-responsibility.repository';
import { ConfigController } from './controllers/config.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PersonalInfo,
      Project,
      Skill,
      Experience,
      ExperienceRole,
      Technology,
      ProjectLink,
      SkillItem,
      ExperienceResponsibility,
    ]),
  ],
  controllers: [
    PersonalInfoController,
    ProjectController,
    SkillController,
    ExperienceController,
    ExperienceRoleController,
    TechnologyController,
    ProjectLinkController,
    SkillItemController,
    ExperienceResponsibilityController,
    ConfigController,
  ],
  providers: [
    PersonalInfoService,
    PersonalInfoRepository,
    ProjectService,
    ProjectRepository,
    SkillService,
    SkillRepository,
    ExperienceService,
    ExperienceRepository,
    ExperienceRoleService,
    ExperienceRoleRepository,
    TechnologyService,
    TechnologyRepository,
    ProjectLinkService,
    ProjectLinkRepository,
    SkillItemService,
    SkillItemRepository,
    ExperienceResponsibilityService,
    ExperienceResponsibilityRepository,
  ],
  exports: [
    PersonalInfoService,
    PersonalInfoRepository,
    ProjectService,
    ProjectRepository,
    SkillService,
    SkillRepository,
    ExperienceService,
    ExperienceRepository,
    ExperienceRoleService,
    ExperienceRoleRepository,
    TechnologyService,
    TechnologyRepository,
    ProjectLinkService,
    ProjectLinkRepository,
    SkillItemService,
    SkillItemRepository,
    ExperienceResponsibilityService,
    ExperienceResponsibilityRepository,
  ],
})
export class PortfolioModule {}
