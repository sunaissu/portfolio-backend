import {
  Controller,
  Post,
  Body,
  Logger,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { ChatService } from './chat.service';
import { ChatRequestDto } from './dtos/chat.dto';
import { ChatRateLimitGuard } from './guards/chat-rate-limit.guard';

@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly chatService: ChatService) {}

  @Public()
  @Post()
  @UseGuards(ChatRateLimitGuard)
  async chat(@Body() dto: ChatRequestDto) {
    try {
      return await this.chatService.chat(dto);
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }

      this.logger.error(
        JSON.stringify({
          event: 'chat_request_failed',
          failureType:
            err instanceof Error ? err.constructor.name : 'UnknownError',
        }),
      );
      throw new HttpException(
        'An unexpected error occurred. Please try again later.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
