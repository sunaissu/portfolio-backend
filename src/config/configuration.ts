const DEFAULT_MODELS: Record<string, string> = {
  gemini: 'gemini-2.0-flash',
  anthropic: 'claude-3-5-sonnet-20240620',
  groq: 'llama-3.1-8b-instant',
};

const DEFAULT_BASE_URLS: Record<string, string> = {
  gemini: 'https://generativelanguage.googleapis.com/v1beta/models',
  anthropic: 'https://api.anthropic.com/v1/messages',
  groq: 'https://api.groq.com/openai/v1/chat/completions',
};

export default () => {
  const aiProvider = process.env.AI_PROVIDER || 'gemini';
  
  return {
  environment: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10),
  clientUrl: process.env.CLIENT_URL,
  allowedOrigins: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : [process.env.CLIENT_URL],
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
  ai: {
    provider: aiProvider,
    apiKey: process.env.AI_API_KEY,
    model: process.env.AI_MODEL || DEFAULT_MODELS[aiProvider] || DEFAULT_MODELS['gemini'],
    baseUrl: process.env.AI_BASE_URL || DEFAULT_BASE_URLS[aiProvider] || DEFAULT_BASE_URLS['gemini'],
    anthropicVersion: process.env.AI_ANTHROPIC_VERSION || '2023-06-01',
  },
};
};
