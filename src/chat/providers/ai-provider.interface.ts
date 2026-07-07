export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiCompletionRequest {
  systemPrompt: string;
  messages: AiMessage[];
  maxTokens?: number;
}

export interface AiProvider {
  complete(request: AiCompletionRequest): Promise<string>;
}
