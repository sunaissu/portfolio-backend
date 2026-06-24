import { Controller, Get, Logger } from '@nestjs/common';
import { Public } from '../../auth/decorators/public.decorator';
import { PersonalInfoService } from '../services/personal-info.service';
import { handleControllerError } from '../../common/utils/error.util';
import { ProjectService } from '../services/project.service';
import { SkillService } from '../services/skill.service';
import { ExperienceService } from '../services/experience.service';

@Controller('config')
export class ConfigController {
  private readonly logger = new Logger(ConfigController.name);

  constructor(
    private readonly personalInfoService: PersonalInfoService,
    private readonly projectService: ProjectService,
    private readonly skillService: SkillService,
    private readonly experienceService: ExperienceService,
  ) {}

  @Public()
  @Get()
  async getFrontendConfig() {
    try {
      const [profile, projects, skills, experience] = await Promise.all([
        this.personalInfoService.getMyPortfolioInfo(),
        this.projectService.getAll(),
        this.skillService.getAll(),
        this.experienceService.getAll(),
      ]);

      return { profile, projects, skills, experience };
    } catch (error) {
      handleControllerError(
        this.logger,
        'Database query failed',
        error,
        'Failed to fetch frontend config',
      );
    }
  }
}
