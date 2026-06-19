import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { PersonalInfoService } from '../services/personal-info.service';
import { ProjectService } from '../services/project.service';
import { SkillService } from '../services/skill.service';
import { ExperienceService } from '../services/experience.service';

@Controller('config')
export class ConfigController {
  constructor(
    private readonly personalInfoService: PersonalInfoService,
    private readonly projectService: ProjectService,
    private readonly skillService: SkillService,
    private readonly experienceService: ExperienceService,
    private readonly logger = new Logger(ConfigController.name),
  ) {}

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
      this.logger.error('Database query failed', error.stack);
      throw new HttpException(
        'Failed to fetch frontend config',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
