import { readProviderJson } from './response';
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
    const isGptOss = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b'].includes(this.model);
    const messages = [
      { role: 'system' as const, content: request.systemPrompt },
      ...request.messages.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
    ];

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      redirect: 'error',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        max_completion_tokens: isGptOss
          ? Math.max(request.maxTokens || 1024, 4096)
          : request.maxTokens || 1024,
        ...(isGptOss ? { reasoning_effort: 'low', include_reasoning: false } : {}),
        messages,
      }),
      signal: request.signal ?? AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      this.logger.error(
        JSON.stringify({ event: 'ai_provider_error', status: response.status }),
      );
      throw Object.assign(new Error('Groq API request failed'), { status: response.status });
    }

    const data = await readProviderJson<{ choices?: Array<{ message?: { content?: unknown } }> }>(response);
    const text = data?.choices?.[0]?.message?.content;

    if (typeof text !== 'string' || !text.trim()) {
      this.logger.warn('Groq returned an empty response');
      throw new Error('Groq returned no content');
    }

    return text.trim();
  }
}
