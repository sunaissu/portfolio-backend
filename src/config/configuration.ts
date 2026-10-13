const SUPPORTED_AI_PROVIDERS = [
  'gemini',
  'anthropic',
  'groq',
  'ollama',
] as const;

export type AiProviderName = (typeof SUPPORTED_AI_PROVIDERS)[number];

export const DEFAULT_MODELS: Record<AiProviderName, string> = {
  gemini: 'gemini-3.6-flash',
  anthropic: 'claude-sonnet-5-5',
  groq: 'llama-3.1-8b-instant',
  ollama: 'gemma3:4b',
};

export const DEFAULT_BASE_URLS: Record<AiProviderName, string> = {
  gemini: 'https://generativelanguage.googleapis.com/v1beta/models',
  anthropic: 'https://api.anthropic.com/v1/messages',
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  ollama: 'http://localhost:11434/api/chat',
};

export function resolveAiModel(
  provider: AiProviderName,
  value?: string | null,
): string {
  const model = value?.trim();
  return model || DEFAULT_MODELS[provider];
}

function aiProvider(value: string | undefined): AiProviderName {
  const provider = value?.trim().toLowerCase() || 'gemini';
  if (!SUPPORTED_AI_PROVIDERS.includes(provider as AiProviderName)) {
    throw new Error('AI_PROVIDER is not supported');
  }
  return provider as AiProviderName;
}

function port(value: string | undefined): number {
  const raw = value?.trim() ?? '4000';
  const parsed = /^\d+$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  return parsed;
}

function origins(value: string | undefined, clientUrl: string | undefined) {
  const configured = value?.split(',') ?? (clientUrl ? [clientUrl] : []);
  return [...new Set(configured.map((entry) => entry.trim()).filter(Boolean))].map(
    (entry) => {
      let parsed: URL;
      try {
        parsed = new URL(entry);
      } catch {
        throw new Error('ALLOWED_ORIGINS contains an invalid URL');
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('ALLOWED_ORIGINS must use HTTP or HTTPS');
      }
      if (
        parsed.username ||
        parsed.password ||
        (parsed.pathname !== '/' && parsed.pathname !== '') ||
        parsed.search ||
        parsed.hash
      ) {
        throw new Error('ALLOWED_ORIGINS entries must be origins without paths');
      }
      return parsed.origin;
    },
  );
}

export default () => {
  const provider = aiProvider(process.env.AI_PROVIDER);
  const configSource = process.env.AI_CONFIG_SOURCE?.trim() || 'database-first';
  if (!['database-first', 'environment'].includes(configSource)) {
    throw new Error('AI_CONFIG_SOURCE must be database-first or environment');
  }
  const clientUrl = process.env.CLIENT_URL?.trim();
  if (process.env.NODE_ENV === 'production') {
    const accessSecret = process.env.JWT_SECRET;
    const refreshSecret = process.env.JWT_REFRESH_SECRET;
    if (!accessSecret || !refreshSecret || Buffer.byteLength(accessSecret) < 32 ||
        Buffer.byteLength(refreshSecret) < 32 || accessSecret === refreshSecret) {
      throw new Error('Production requires distinct JWT secrets of at least 32 bytes');
    }
    const allowed = origins(process.env.ALLOWED_ORIGINS, clientUrl);
    if (!clientUrl || !allowed.length || allowed.some((origin) => !origin.startsWith('https://')) ||
        !allowed.includes(new URL(clientUrl).origin)) {
      throw new Error('Production requires an HTTPS client URL in ALLOWED_ORIGINS');
    }
  }
  return {
    environment: process.env.NODE_ENV || 'development',
    port: port(process.env.PORT),
    clientUrl,
    allowedOrigins: origins(process.env.ALLOWED_ORIGINS, clientUrl),
    database: {
      url: process.env.DATABASE_URL,
    },
    jwt: {
      secret: process.env.JWT_SECRET,
      refreshSecret: process.env.JWT_REFRESH_SECRET,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackUrl: process.env.GOOGLE_CALLBACK_URL,
    },
    storage: {
      url: process.env.SUPABASE_URL,
      key: process.env.SUPABASE_KEY,
    },
    ai: {
      provider,
      configSource,
      apiKey: process.env.AI_API_KEY,
      model: resolveAiModel(provider, process.env.AI_MODEL),
      baseUrl: process.env.AI_BASE_URL || DEFAULT_BASE_URLS[provider],
      anthropicVersion: process.env.AI_ANTHROPIC_VERSION || '2023-06-01',
    },
  };
};
