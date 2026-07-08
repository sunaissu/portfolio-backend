import { Logger } from '@nestjs/common';
import {
  AiProvider,
  AiCompletionRequest,
} from './ai-provider.interface';

export class GroqProvider implements AiProvider {
  private readonly logger = new Logger(GroqProvider.name);

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly baseUrl: string,
  ) {}

  async complete(request: AiCompletionRequest): Promise<string> {
    const messages = [
      { role: 'system' as const, content: request.systemPrompt },
      ...request.messages.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
    ];

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: request.maxTokens || 1024,
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(
        `Groq API error: ${response.status} - ${errorText}`,
      );
      throw new Error('Groq API request failed');
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;

    if (!text) {
      this.logger.warn('Groq returned an empty response');
      throw new Error('Groq returned no content');
    }

    return text;
  }
}
