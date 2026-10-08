import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.url(),
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:5173")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  // Signs session cookies. Generate with: openssl rand -base64 48
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  // Number of reverse proxies in front of the API (Nginx = 1), so rate limits see the real client IP.
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
});

const parsed = envSchema
  .refine((e) => e.NODE_ENV !== "production" || !e.SESSION_SECRET.startsWith("change-me"), {
    path: ["SESSION_SECRET"],
    message: "Replace the example SESSION_SECRET before running in production",
  })
  .safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
