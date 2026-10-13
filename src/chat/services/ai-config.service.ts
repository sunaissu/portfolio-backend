import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AiConfig } from '../entities/ai-config.entity';
import {
  DEFAULT_BASE_URLS,
  resolveAiModel,
} from '../../config/configuration';

export interface ResolvedAiConfig {
  provider: 'gemini' | 'anthropic' | 'groq' | 'ollama';
  apiKey: string;
  model: string;
  baseUrl: string;
  anthropicVersion: string;
}

const PROVIDER_HOSTS = {
  gemini: 'generativelanguage.googleapis.com',
  anthropic: 'api.anthropic.com',
  groq: 'api.groq.com',
} as const;

@Injectable()
export class AiConfigService {
  private readonly logger = new Logger(AiConfigService.name);

  constructor(
    @InjectRepository(AiConfig)
    private readonly aiConfigRepository: Repository<AiConfig>,
    private readonly configService: ConfigService,
  ) {}

  async getConfigs(): Promise<ResolvedAiConfig[]> {
    const configs: ResolvedAiConfig[] = [];
    const provider = this.configService.get<string>('ai.provider')!;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const dbConfig = this.configService.get<string>('ai.configSource') !== 'environment'
        && this.aiConfigRepository.manager.connection.isInitialized
        ? await Promise.race([
            this.aiConfigRepository.findOne({ where: { isActive: true } }),
            new Promise<never>((_, reject) => {
              timeout = setTimeout(
                () => reject(new Error('AI configuration read timed out')),
                3500,
              );
            }),
          ])
        : null;

      if (dbConfig) {
        const dbProvider = dbConfig.provider as ResolvedAiConfig['provider'];
        configs.push(this.validate({
          provider: dbConfig.provider,
          apiKey: dbConfig.apiKey || '',
          model: resolveAiModel(
            dbProvider,
            dbConfig.model || (dbProvider === provider
              ? this.configService.get<string>('ai.model')!
              : null),
          ),
          baseUrl:
            dbConfig.baseUrl || (dbProvider === provider
              ? this.configService.get<string>('ai.baseUrl')!
              : DEFAULT_BASE_URLS[dbProvider]),
          anthropicVersion:
            dbConfig.anthropicVersion ||
            this.configService.get<string>('ai.anthropicVersion')!,
        }));
      }
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: 'ai_config_fallback',
          failureType:
            error instanceof Error ? error.constructor.name : 'UnknownError',
        }),
      );
    } finally {
      if (timeout) clearTimeout(timeout);
    }

    const apiKey = this.configService.get<string>('ai.apiKey') || '';
    if (apiKey || provider === 'ollama') {
      try {
        const environmentConfig = this.validate({
          provider,
          apiKey,
          model: this.configService.get<string>('ai.model')!,
          baseUrl: this.configService.get<string>('ai.baseUrl')!,
          anthropicVersion: this.configService.get<string>('ai.anthropicVersion')!,
        });
        if (!configs.some((config) =>
          config.provider === environmentConfig.provider &&
          config.apiKey === environmentConfig.apiKey &&
          config.model === environmentConfig.model &&
          config.baseUrl === environmentConfig.baseUrl &&
          config.anthropicVersion === environmentConfig.anthropicVersion
        )) configs.push(environmentConfig);
      } catch {
        this.logger.warn(JSON.stringify({ event: 'ai_environment_config_invalid' }));
      }
    }
    return configs;
  }

  private validate(config: {
    provider: string;
    apiKey: string;
    model: string;
    baseUrl: string;
    anthropicVersion: string;
  }): ResolvedAiConfig {
    config = { ...config, apiKey: config.apiKey.trim(), model: config.model?.trim(), baseUrl: config.baseUrl?.trim() };
    if (!['gemini', 'anthropic', 'groq', 'ollama'].includes(config.provider)) {
      throw new Error('AI provider is unsupported');
    }
    const provider = config.provider as ResolvedAiConfig['provider'];
    if (
      !config.model ||
      config.model.length > 200 ||
      !/^[A-Za-z0-9._:/-]+$/.test(config.model)
    ) {
      throw new Error('AI model is invalid');
    }
    if (provider !== 'ollama' && (!config.apiKey || config.apiKey.length > 512)) {
      throw new Error('AI API key is invalid');
    }

    let baseUrl: URL;
    try {
      baseUrl = new URL(config.baseUrl);
    } catch {
      throw new Error('AI base URL is invalid');
    }
    if (baseUrl.username || baseUrl.password) {
      throw new Error('AI base URL credentials are not allowed');
    }
    if (provider === 'ollama') {
      if (
        baseUrl.protocol !== 'http:' ||
        !['localhost', '127.0.0.1', '[::1]'].includes(baseUrl.hostname)
      ) {
        throw new Error('Ollama must use a loopback HTTP endpoint');
      }
    } else if (
      baseUrl.protocol !== 'https:' ||
      baseUrl.hostname !== PROVIDER_HOSTS[provider]
    ) {
      throw new Error('AI base URL is not approved for the provider');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(config.anthropicVersion)) {
      throw new Error('Anthropic API version is invalid');
    }

    return {
      provider,
      apiKey: config.apiKey,
      model: config.model,
      baseUrl: baseUrl.toString().replace(/\/$/, ''),
      anthropicVersion: config.anthropicVersion,
    };
  }
}
