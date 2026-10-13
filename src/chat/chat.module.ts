import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { AiConfigService } from './services/ai-config.service';
import { AiConfig } from './entities/ai-config.entity';
import { ChatRateLimitGuard } from './guards/chat-rate-limit.guard';

@Module({
  imports: [
    PortfolioModule,
    ConfigModule,
    TypeOrmModule.forFeature([AiConfig]),
  ],
  controllers: [ChatController],
  providers: [ChatService, AiConfigService, ChatRateLimitGuard],
  exports: [AiConfigService],
})
export class ChatModule {}
