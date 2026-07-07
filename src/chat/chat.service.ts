import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PersonalInfoService } from '../portfolio/services/personal-info.service';
import { ProjectService } from '../portfolio/services/project.service';
import { SkillService } from '../portfolio/services/skill.service';
import { ExperienceService } from '../portfolio/services/experience.service';
import { ChatRequestDto } from './dtos/chat.dto';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly personalInfoService: PersonalInfoService,
    private readonly projectService: ProjectService,
    private readonly skillService: SkillService,
    private readonly experienceService: ExperienceService,
  ) {}

  async chat(dto: ChatRequestDto): Promise<{ reply: string }> {
    const [profile, projects, skills, experience] = await Promise.all([
      this.personalInfoService.getMyPortfolioInfo(),
      this.projectService.getAll(),
      this.skillService.getAll(),
      this.experienceService.getAll(),
    ]);

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

    const apiKey = this.configService.get<string>('anthropic.apiKey');
    if (!apiKey) {
      this.logger.error('Anthropic API key is not configured');
      throw new Error('Anthropic API key is not configured');
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          ...(dto.history || []).map((m) => ({
            role: m.role,
            content: m.content,
          })),
          { role: 'user', content: dto.message },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Anthropic API error: ${response.status} - ${errorText}`);
      throw new Error('Failed to communicate with the chat service');
    }

    const data = await response.json();
    return {
      reply:
        data.content?.[0]?.text || 'Sorry, I could not generate a response.',
    };
  }
}
