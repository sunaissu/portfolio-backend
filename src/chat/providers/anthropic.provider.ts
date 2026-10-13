import { readProviderJson } from './response';
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
      redirect: 'error',
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
      signal: request.signal ?? AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      this.logger.error(
        JSON.stringify({ event: 'ai_provider_error', status: response.status }),
      );
      throw Object.assign(new Error('Anthropic API request failed'), { status: response.status });
    }

    const data = await readProviderJson<{ content?: Array<{ text?: unknown }> }>(response);
    const text = data?.content?.[0]?.text;

    if (typeof text !== 'string' || !text.trim()) {
      this.logger.warn('Anthropic returned an empty response');
      throw new Error('Anthropic returned no content');
    }

    return text.trim();
  }
}
