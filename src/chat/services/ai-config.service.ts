import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AiConfig } from '../entities/ai-config.entity';

export interface ResolvedAiConfig {
  provider: string;
  apiKey: string;
  model: string;
  baseUrl: string;
  anthropicVersion: string;
}

@Injectable()
export class AiConfigService {
  private readonly logger = new Logger(AiConfigService.name);

  constructor(
    @InjectRepository(AiConfig)
    private readonly aiConfigRepository: Repository<AiConfig>,
    private readonly configService: ConfigService,
  ) {}

  async getActiveConfig(): Promise<ResolvedAiConfig> {
    try {
      const dbConfig = await this.aiConfigRepository.findOne({
        where: { isActive: true },
      });

      if (dbConfig) {
        return {
          provider: dbConfig.provider,
          apiKey: dbConfig.apiKey,
          model: dbConfig.model || this.configService.get<string>('ai.model')!,
          baseUrl:
            dbConfig.baseUrl || this.configService.get<string>('ai.baseUrl')!,
          anthropicVersion:
            dbConfig.anthropicVersion ||
            this.configService.get<string>('ai.anthropicVersion')!,
        };
      }
    } catch (error) {
      this.logger.warn(
        'Database unavailable or ai configuration query failed. Falling back to environment variable configuration.',
        error instanceof Error ? error.message : String(error),
      );
    }

    const apiKey = this.configService.get<string>('ai.apiKey');

    if (!apiKey) {
      throw new Error(
        'AI_API_KEY is not configured and no active DB config was found.',
      );
    }

    return {
      provider: this.configService.get<string>('ai.provider')!,
      apiKey,
      model: this.configService.get<string>('ai.model')!,
      baseUrl: this.configService.get<string>('ai.baseUrl')!,
      anthropicVersion: this.configService.get<string>('ai.anthropicVersion')!,
    };
  }
}
