import "server-only";

const int = (v: string | undefined, fallback: number): number => {
  const n = v === undefined ? NaN : Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

/**
 * Environment-driven settings, read lazily so tests can change process.env.
 * Secrets never reach the client: this module is server-only.
 */
export function getConfig() {
  const production = process.env.NODE_ENV === "production";
  const mockRequested = process.env.MOCK_BACKEND === "1";
  // The in-memory backend has no real auth, so it is refused in production builds unless explicitly allowed (e2e).
  const mockBackend = mockRequested && (!production || process.env.MOCK_BACKEND_ALLOW_PRODUCTION === "1");
  const mongoUri = process.env.MONGODB_URI ?? "";
  const backend = mockBackend ? "mock" : mongoUri ? "mongo" : process.env.NEXT_PUBLIC_SUPABASE_URL ? "supabase" : "none";
  return {
    /** Which persistence layer is active: in-memory mock, MongoDB, Supabase, or none configured. */
    backend: backend as "mock" | "mongo" | "supabase" | "none",
    mongoUri,
    mongoDb: process.env.MONGODB_DB ?? "coach",
    /** Signs the guest cookie in MongoDB mode. Set a long random value. */
    authSecret: process.env.AUTH_SECRET ?? "",
    mockBackend,
    mockLlm: process.env.LLM_PROVIDER === "mock" || (mockBackend && !process.env.LLM_API_KEY),
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    llmApiKey: process.env.LLM_API_KEY ?? "",
    /** "anthropic" or "gemini"; guessed from the key when LLM_PROVIDER is not set (sk-ant-... is Anthropic, AQ./AIza... is Google). */
    llmProvider: ((): "anthropic" | "gemini" => {
      const p = (process.env.LLM_PROVIDER ?? "").toLowerCase();
      if (p === "gemini" || p === "anthropic") return p;
      return /^(AQ.|AIza)/.test(process.env.LLM_API_KEY ?? "") ? "gemini" : "anthropic";
    })(),
    llmModel: process.env.LLM_MODEL ?? "",
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "",
    freeLibraryLimit: int(process.env.FREE_LIBRARY_LIMIT, 20),
    dailyGenerationLimit: int(process.env.DAILY_GENERATION_LIMIT, 20),
    dailyShareLimit: int(process.env.DAILY_SHARE_LIMIT, 30),
    /** Templates start as "pending"; this lets them be used in generated sessions until a coach reviews them. */
    allowPendingTemplates: process.env.ALLOW_PENDING_TEMPLATES !== "0",
  };
}

export type AppConfig = ReturnType<typeof getConfig>;
