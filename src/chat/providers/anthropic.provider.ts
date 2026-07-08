import { Logger } from '@nestjs/common';
import {
  AiProvider,
  AiCompletionRequest,
} from './ai-provider.interface';

export class AnthropicProvider implements AiProvider {
  private readonly logger = new Logger(AnthropicProvider.name);

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly baseUrl: string,
    private readonly anthropicVersion: string,
  ) {}

  async complete(request: AiCompletionRequest): Promise<string> {
    const messages = request.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': this.anthropicVersion,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: request.maxTokens || 1024,
        system: request.systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(
        `Anthropic API error: ${response.status} - ${errorText}`,
      );
      throw new Error('Anthropic API request failed');
    }

    const data = await response.json();
    const text = data?.content?.[0]?.text;

    if (!text) {
      this.logger.warn('Anthropic returned an empty response');
      throw new Error('Anthropic returned no content');
    }

    return text;
  }
}
