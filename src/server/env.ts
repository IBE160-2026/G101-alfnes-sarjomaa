import "server-only";
import { z } from "zod";

export const envSchema = z.object({
  DATABASE_URL: z.string().default("pglite://.data/local"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  APP_BASE_URL: z.url({ protocol: /^https?$/ }).optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  JUDGE_PROVIDER: z.enum(["openrouter", "replay", "mock"]).optional(),
  JUDGE_MODEL: z.string().default("deepseek/deepseek-v4.1-flash"),
  DEMO_MODE: z.literal("1").optional(),
  REGISTRATION_CODE: z.string().optional(),
  CRON_SECRET: z.string().optional(),
});

export type Env = ReturnType<typeof parseEnv>;

export function parseEnv(source: Record<string, string | undefined>) {
  const cleaned: Record<string, string> = {};
  for (const key of Object.keys(envSchema.shape)) {
    const value = source[key];
    if (value !== undefined && value !== "") cleaned[key] = value;
  }
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    // Names keys only: values may be secrets.
    const keys = [
      ...new Set(result.error.issues.map((issue) => String(issue.path[0]))),
    ];
    throw new Error(`Invalid environment variables: ${keys.join(", ")}`);
  }
  const data = result.data;
  return {
    ...data,
    APP_BASE_URL: data.APP_BASE_URL ?? `http://localhost:${data.PORT}`,
    JUDGE_PROVIDER:
      data.JUDGE_PROVIDER ??
      (data.OPENROUTER_API_KEY ? "openrouter" : "replay"),
    DEMO_MODE: data.DEMO_MODE === "1",
  };
}

export const env = parseEnv(process.env);
