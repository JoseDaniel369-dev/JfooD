import { z } from 'zod';

const optionalGeminiKey = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().min(1).optional(),
);

/** A blank variable ("PORT=") counts as not set: coercing it would give 0. */
const blankIsUnset = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const environmentSchema = z.object({
  API_HOST: z.string().min(1).default('0.0.0.0'),
  API_PORT: z.preprocess(blankIsUnset, z.coerce.number().int().min(1).max(65_535).default(3000)),
  PORT: z.preprocess(blankIsUnset, z.coerce.number().int().min(1).max(65_535).optional()),
  GEMINI_API_KEY: optionalGeminiKey,
  GEMINI_MODEL: z.string().min(1).default('gemini-3.5-flash-lite'),
  /** Max /recognize calls forwarded to Gemini per UTC day, for all users. */
  RECOGNIZE_DAILY_LIMIT: z.preprocess(blankIsUnset, z.coerce.number().int().min(1).max(100_000).default(300)),
  /** Max Gemini calls per client IP and UTC day, so one client cannot drain the global budget. */
  RECOGNIZE_DAILY_LIMIT_PER_IP: z.preprocess(
    blankIsUnset,
    z.coerce.number().int().min(1).max(100_000).default(40),
  ),
  /**
   * Shared secret the app sends in `x-app-token`. Optional: when unset the
   * recognition routes stay open. It ships inside the APK, so it only keeps
   * casual traffic out; the real caps are the rate limit and the daily budgets.
   */
  APP_TOKEN: optionalGeminiKey,
  /**
   * Reverse proxies between the client and this server. Rate limiting needs the
   * real client IP, not the proxy's. Defaults to 1 on Render (which sets RENDER).
   */
  TRUST_PROXY_HOPS: z.preprocess(blankIsUnset, z.coerce.number().int().min(0).max(5).optional()),
  RENDER: z.string().optional(),
});

export type ApiEnvironment = z.infer<typeof environmentSchema>;

/** Number of proxy hops to trust (0 = connect directly, e.g. local development). */
export function resolveTrustProxyHops(environment: ApiEnvironment): number {
  return environment.TRUST_PROXY_HOPS ?? (environment.RENDER ? 1 : 0);
}

export function loadEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): ApiEnvironment {
  return environmentSchema.parse(source);
}
