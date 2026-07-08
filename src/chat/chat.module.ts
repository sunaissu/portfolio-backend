import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { GeminiProvider } from './providers/gemini.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { GroqProvider } from './providers/groq.provider';

@Module({
  imports: [PortfolioModule, ConfigModule],
  controllers: [ChatController],
  providers: [
    ChatService,
    {
      provide: 'AI_PROVIDER',
      useFactory: (configService: ConfigService) => {
        const provider = configService.get<string>('ai.provider');
        const apiKey = configService.get<string>('ai.apiKey');
        const model = configService.get<string>('ai.model')!;
        const baseUrl = configService.get<string>('ai.baseUrl')!;
        const anthropicVersion = configService.get<string>('ai.anthropicVersion')!;

        if (!apiKey) {
          throw new Error(
            'AI_API_KEY is not configured. Set it in your .env file.',
          );
        }

        switch (provider) {
          case 'gemini':
            return new GeminiProvider(apiKey, model, baseUrl);
          case 'anthropic':
            return new AnthropicProvider(apiKey, model, baseUrl, anthropicVersion);
          case 'groq':
            return new GroqProvider(apiKey, model, baseUrl);
          default:
            throw new Error(
              `Unknown AI provider: "${provider}". Supported: gemini, anthropic, groq`,
            );
        }
      },
      inject: [ConfigService],
    },
  ],
})
export class ChatModule {}
