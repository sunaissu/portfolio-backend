import { readProviderJson } from './response';
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
    const model = this.model.replace(/^models\//, '');
    const url = new URL(
      `${this.baseUrl.replace(/\/$/, '')}/${encodeURIComponent(model)}:generateContent`,
    );

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
        maxOutputTokens: Math.max(request.maxTokens || 1024, 4096),
        ...(model === 'gemini-3.6-flash'
          ? { thinkingConfig: { thinkingLevel: 'minimal' } }
          : {}),
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
      body: JSON.stringify(body),
      signal: request.signal ?? AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorBody = await readProviderJson<{ error?: { details?: unknown[]; status?: unknown } }>(response, 65536).catch(() => null);
      const knownReasons = new Set(['API_KEY_INVALID', 'API_KEY_SERVICE_BLOCKED', 'API_KEY_HTTP_REFERRER_BLOCKED', 'API_KEY_IP_ADDRESS_BLOCKED', 'SERVICE_DISABLED', 'BILLING_DISABLED', 'RATE_LIMIT_EXCEEDED', 'INVALID_ARGUMENT', 'FAILED_PRECONDITION', 'NOT_FOUND', 'PERMISSION_DENIED', 'UNAUTHENTICATED', 'RESOURCE_EXHAUSTED', 'UNAVAILABLE', 'INTERNAL']);
      const details: unknown[] = Array.isArray(errorBody?.error?.details) ? errorBody.error.details : [];
      const reason = response.status === 402 ? 'provider-billing-required'
        : [...details.map((detail) => detail && typeof detail === 'object' && 'reason' in detail ? detail.reason : undefined), errorBody?.error?.status]
          .find((value): value is string => typeof value === 'string' && knownReasons.has(value));
      this.logger.error(
        JSON.stringify({ event: 'ai_provider_error', status: response.status }),
      );
      throw Object.assign(new Error('Gemini API request failed'), { status: response.status, reason });
    }

    const data = await readProviderJson<{ candidates?: Array<{ content?: { parts?: Array<{ text?: unknown; thought?: unknown }> }; finishReason?: string }>; promptFeedback?: { blockReason?: string } }>(response);
    const candidate = data?.candidates?.[0];
    const parts: Array<{ text?: unknown; thought?: unknown }> = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    const text = parts.filter((part) => part && part.thought !== true && typeof part.text === 'string')
      .map((part) => part.text).join('').trim();

    if (!text) {
      this.logger.warn('Gemini returned an empty response');
      const reason = candidate?.finishReason === 'MAX_TOKENS' ? 'response-token-limit'
        : ['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII'].includes(candidate?.finishReason ?? '')
          || ['SAFETY', 'BLOCKLIST', 'PROHIBITED_CONTENT'].includes(data?.promptFeedback?.blockReason ?? '')
          ? 'response-blocked' : 'empty-response';
      throw Object.assign(new Error('Gemini returned no content'), { reason });
    }

    return text.trim();
  }
}
