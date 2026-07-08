import {
  Injectable,
  Inject,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PersonalInfoService } from '../portfolio/services/personal-info.service';
import { ProjectService } from '../portfolio/services/project.service';
import { SkillService } from '../portfolio/services/skill.service';
import { ExperienceService } from '../portfolio/services/experience.service';
import type { AiProvider } from './providers/ai-provider.interface';
import { ChatRequestDto } from './dtos/chat.dto';
import {
  fallbackProfile,
  fallbackProjects,
  fallbackSkills,
  fallbackExperience,
} from './fallback-data';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @Inject('AI_PROVIDER') private readonly aiProvider: AiProvider,
    private readonly personalInfoService: PersonalInfoService,
    private readonly projectService: ProjectService,
    private readonly skillService: SkillService,
    private readonly experienceService: ExperienceService,
  ) {}

  async chat(dto: ChatRequestDto): Promise<{ reply: string }> {
    let profile, projects, skills, experience;

    try {
      [profile, projects, skills, experience] = await Promise.all([
        this.personalInfoService.getMyPortfolioInfo(),
        this.projectService.getAll(),
        this.skillService.getAll(),
        this.experienceService.getAll(),
      ]);
    } catch (err) {
      this.logger.warn(
        'Database unavailable, using fallback portfolio data',
        err instanceof Error ? err.message : err,
      );
      profile = fallbackProfile;
      projects = fallbackProjects;
      skills = fallbackSkills;
      experience = fallbackExperience;
    }

    const systemPrompt = `You are a helpful assistant on Brett Josef C. Galvez's portfolio website.
Answer questions about Brett based ONLY on the following data. Be concise and friendly.
If asked something not covered by this data, say you don't have that information.

=== PROFILE ===
${JSON.stringify(profile, null, 2)}

=== PROJECTS ===
${JSON.stringify(projects, null, 2)}

=== SKILLS ===
${JSON.stringify(skills, null, 2)}

=== EXPERIENCE ===
${JSON.stringify(experience, null, 2)}
`;

    const messages = [
      ...(dto.history || []).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: dto.message },
    ];

    try {
      const reply = await this.aiProvider.complete({
        systemPrompt,
        messages,
        maxTokens: 1024,
      });

      return { reply };
    } catch (err) {
      this.logger.error(
        'AI provider failed to generate a response',
        err instanceof Error ? err.stack : err,
      );
      throw new HttpException(
        'Failed to generate a response. Please try again later.',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
