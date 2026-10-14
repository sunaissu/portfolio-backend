import {StudioService} from './services/studio.service';
import {StudioController} from './controllers/studio.controller';
import { Inquiry } from './models/inquiry.model';
import { InquiryService } from './services/inquiry.service';
import { InquiryRateGuard } from './services/inquiry-rate.guard';
import { InquiryController, InquiryAdminController } from './controllers/inquiry.controller';
import { FeedController } from './controllers/feed.controller';
import { Publication } from './models/publication.model';
import { PublicationService } from './services/publication.service';
import { PublicationController } from './controllers/publication.controller';
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
import { ExperienceResponsibility } from './models/experience-responsibility.model';
import { AdminUser } from './models/admin-user.model';
import { AdminUserProvider } from './models/admin-user-provider.model';
import { Resume } from './models/resume.model';
import { EducationRecord } from './models/education-record.model';
import { EducationService } from './services/education.service';
import { EducationController } from './controllers/education.controller';

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
import { ExperienceResponsibilityController } from './controllers/experience-responsibility.controller';
import { ExperienceResponsibilityService } from './services/experience-responsibility.service';
import { ExperienceResponsibilityRepository } from './repositories/experience-responsibility.repository';
import { ConfigController } from './controllers/config.controller';
import { AdminUserService } from './services/admin-user.service';
import { AdminUserRepository } from './repositories/admin-user.repository';
import { AdminUserProviderService } from './services/admin-user-provider.service';
import { AdminUserProviderRepository } from './repositories/admin-user-provider.repository';
import { PortfolioDataService } from './services/portfolio-data.service';
import { AdminPortfolioController } from './controllers/admin-portfolio.controller';

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
      AdminUser,
      AdminUserProvider,
      Resume,
      EducationRecord,
      Publication,
      Inquiry,
    ]),
  ],
  controllers: [
    StudioController,
    EducationController,
    PublicationController,
    InquiryController,
    InquiryAdminController,
    FeedController,
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
    AdminPortfolioController,
  ],
  providers: [
    StudioService,
    EducationService,
    PublicationService,
    InquiryService,
    InquiryRateGuard,
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
    AdminUserService,
    AdminUserRepository,
    AdminUserProviderService,
    AdminUserProviderRepository,
    PortfolioDataService,
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
    AdminUserService,
    AdminUserRepository,
    AdminUserProviderService,
    AdminUserProviderRepository,
    PortfolioDataService,
  ],
})
export class PortfolioModule {}
