import { readProviderJson } from './response';
import { Logger } from '@nestjs/common';
import {
  AiCompletionRequest,
  AiProvider,
} from './ai-provider.interface';

export class OllamaProvider implements AiProvider {
  private readonly logger = new Logger(OllamaProvider.name);

  constructor(
    private readonly model: string,
    private readonly baseUrl: string,
  ) {}

  async complete(request: AiCompletionRequest): Promise<string> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        stream: false,
        messages: [
          { role: 'system', content: request.systemPrompt },
          ...request.messages,
        ],
        options: {
          num_predict: request.maxTokens || 1024,
        },
      }),
      signal: request.signal ?? AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      this.logger.error(`Ollama API error: ${response.status}`);
      throw Object.assign(new Error('Ollama API request failed'), { status: response.status });
    }

    const data = await readProviderJson<{ message?: { content?: unknown } }>(response);
    const text = data?.message?.content;
    if (typeof text !== 'string' || !text.trim()) {
      throw new Error('Ollama returned no content');
    }
    return text.trim();
  }
}
