declare namespace NodeJS {
  export interface ProcessEnv {
    NODE_ENV?: string;
    PORT: string;
    DATABASE_URL: string;
    JWT_SECRET: string;
    JWT_REFRESH_SECRET: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    GOOGLE_CALLBACK_URL: string;
    CLIENT_URL: string;
    ALLOWED_ORIGINS?: string;
    SUPABASE_URL?: string;
    SUPABASE_KEY?: string;
    AI_PROVIDER?: string;
    AI_CONFIG_SOURCE?: 'database-first' | 'environment';
    AI_API_KEY?: string;
    AI_MODEL?: string;
    AI_BASE_URL?: string;
    AI_ANTHROPIC_VERSION?: string;
  }
}
