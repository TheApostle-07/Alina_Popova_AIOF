import { z } from "zod";

const emptyToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => {
    if (typeof value === "string" && value.trim() === "") {
      return undefined;
    }
    return value;
  }, schema);

const envSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().trim().url().default("http://localhost:3000"),
  MONGODB_URI: z.string().trim().min(1),
  RAZORPAY_KEY_ID: z.string().trim().min(1),
  RAZORPAY_KEY_SECRET: z.string().trim().min(1),
  RAZORPAY_WEBHOOK_SECRET: z.string().trim().min(1),
  RAZORPAY_PLAN_ID: z.string().trim().min(1),
  ADMIN_PASSWORD: z.string().trim().min(8),
  SESSION_SECRET: z.string().trim().min(32),
  CRON_SECRET: z.string().trim().min(16),
  CLOUDINARY_CLOUD_NAME: z.string().trim().min(1),
  CLOUDINARY_API_KEY: z.string().trim().min(1),
  CLOUDINARY_API_SECRET: z.string().trim().min(1),
  UPSTASH_REDIS_REST_URL: emptyToUndefined(z.string().trim().url().optional()),
  UPSTASH_REDIS_REST_TOKEN: emptyToUndefined(z.string().trim().min(20).optional()),
  ADMIN_IP_ALLOWLIST: emptyToUndefined(z.string().trim().optional()),
  NO_GO_ZONE_URL: emptyToUndefined(z.string().trim().url().optional()),
  SMTP_HOST: emptyToUndefined(z.string().trim().optional()),
  SMTP_PORT: emptyToUndefined(z.coerce.number().int().min(1).max(65535).optional()),
  SMTP_USER: emptyToUndefined(z.string().trim().optional()),
  SMTP_PASS: emptyToUndefined(z.string().trim().optional()),
  SUPPORT_TO_EMAIL: emptyToUndefined(z.string().trim().email().optional())
});

let cachedEnv: z.infer<typeof envSchema> | null = null;

export function getEnv() {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const messages = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment: ${messages}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

export function getOptionalSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}
