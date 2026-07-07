import { Controller, Post, Body, Logger } from '@nestjs/common';
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
    return this.chatService.chat(dto);
  }
}
