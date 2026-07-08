import {
  Controller,
  Post,
  Body,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { ChatService } from './chat.service';
import { ChatRequestDto } from './dtos/chat.dto';

@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly chatService: ChatService) {}

  @Public()
  @Post()
  async chat(@Body() dto: ChatRequestDto) {
    try {
      return await this.chatService.chat(dto);
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }

      this.logger.error(
        'Unexpected error in chat endpoint',
        err instanceof Error ? err.stack : err,
      );
      throw new HttpException(
        'An unexpected error occurred. Please try again later.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
