import { z } from 'zod';

const optionalGeminiKey = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().min(1).optional(),
);

const environmentSchema = z.object({
  API_HOST: z.string().min(1).default('0.0.0.0'),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  PORT: z.coerce.number().int().min(1).max(65_535).optional(),
  GEMINI_API_KEY: optionalGeminiKey,
  GEMINI_MODEL: z.string().min(1).default('gemini-3.5-flash-lite'),
});

export type ApiEnvironment = z.infer<typeof environmentSchema>;

export function loadEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): ApiEnvironment {
  return environmentSchema.parse(source);
}
