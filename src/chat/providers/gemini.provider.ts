import { Logger } from '@nestjs/common';
import {
  AiProvider,
  AiCompletionRequest,
} from './ai-provider.interface';

export class GeminiProvider implements AiProvider {
  private readonly logger = new Logger(GeminiProvider.name);

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly baseUrl: string,
  ) {}

  async complete(request: AiCompletionRequest): Promise<string> {
    const url = `${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`;

    const contents = request.messages.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    const body = {
      system_instruction: {
        parts: [{ text: request.systemPrompt }],
      },
      contents,
      generationConfig: {
        maxOutputTokens: request.maxTokens || 1024,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(
        `Gemini API error: ${response.status} - ${errorText}`,
      );
      throw new Error('Gemini API request failed');
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      this.logger.warn('Gemini returned an empty response');
      throw new Error('Gemini returned no content');
    }

    return text;
  }
}
