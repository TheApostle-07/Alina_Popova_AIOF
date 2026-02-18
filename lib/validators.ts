import { z } from "zod";
import { CONTENT_STATES, CONTENT_TYPES } from "@/lib/constants";

export const checkoutCreateSchema = z.object({
  email: z.string().email(),
  phone: z.string().min(8).max(20),
  idempotencyKey: z.string().min(8).max(128),
  acceptPolicies: z.literal(true)
}).strict();

export const restoreSchema = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().min(8).max(20).optional()
  })
  .strict()
  .refine((data) => Boolean(data.email || data.phone), {
    message: "Email or phone is required"
  });

export const restoreRequestOtpSchema = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().min(8).max(20).optional(),
    theme: z.enum(["dark", "light", "auto"]).optional()
  })
  .strict()
  .refine((data) => Boolean(data.email || data.phone), {
    message: "Email or phone is required"
  });

export const restoreVerifySchema = z.object({
  challengeId: z.string().min(12).max(120),
  otp: z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/, "OTP must be 6 digits")
}).strict();

export const supportSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(8).max(20).optional(),
  topic: z.string().min(4).max(100),
  message: z.string().min(10).max(1200)
}).strict();

export const trackEventSchema = z.object({
  event: z.enum([
    "page_view",
    "checkout_start",
    "checkout_success",
    "cta_click",
    "heatmap_click",
    "scroll_depth",
    "page_exit",
    "restore_request",
    "restore_success"
  ]),
  path: z.string().min(1).max(200).optional(),
  sessionId: z.string().min(8).max(80).optional(),
  referrer: z.string().min(1).max(140).optional(),
  device: z.enum(["mobile", "tablet", "desktop", "unknown"]).optional(),
  x: z.number().min(0).max(1).optional(),
  y: z.number().min(0).max(1).optional(),
  scrollDepth: z.number().min(0).max(100).optional(),
  dwellMs: z.number().int().min(0).max(1000 * 60 * 30).optional(),
  label: z.string().min(1).max(120).optional()
}).strict();

export const contentCreateSchema = z.object({
  type: z.enum(CONTENT_TYPES),
  title: z.string().min(2).max(140),
  tags: z.array(z.string().min(1).max(30)).max(10).default([]),
  status: z.enum(CONTENT_STATES).default("draft"),
  publishAt: z.string().datetime().optional(),
  previewEligible: z.boolean().default(true),
  previewUrl: z.string().url(),
  mediaAssetId: z.string().min(3).max(200)
}).strict();

export const contentUpdateSchema = contentCreateSchema.partial();

export const adminLoginSchema = z.object({
  password: z.string().min(1)
}).strict();

export const memberProfileUpdateSchema = z.object({
  displayName: z.string().trim().min(3).max(28)
}).strict();

export const memberDonateSchema = z.object({
  amount: z.coerce.number().int().min(1).max(500000),
  note: z.string().trim().max(180).optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional()
}).strict();

export const memberDonateVerifySchema = z.object({
  orderId: z.string().trim().min(10).max(120),
  paymentId: z.string().trim().min(10).max(120),
  signature: z.string().trim().min(20).max(200)
}).strict();

export const membershipStatusQuerySchema = z
  .object({
    subscriptionId: z.string().trim().min(6).max(120).optional(),
    attemptId: z.string().trim().min(6).max(120).optional(),
    paymentId: z.string().trim().min(6).max(120).optional()
  })
  .strict();

export const feedQuerySchema = z
  .object({
    cursor: z.string().trim().min(12).max(60).optional(),
    q: z.string().trim().max(80).optional(),
    page: z.coerce.number().int().min(1).max(10_000).optional(),
    pageSize: z.coerce.number().int().min(1).max(50).optional(),
    type: z.enum(["image", "video"]).optional()
  })
  .strict();

export const mediaSignQuerySchema = z
  .object({
    assetId: z.string().trim().min(3).max(200),
    type: z.enum(["image", "video"]).optional()
  })
  .strict();

export const adminContentQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10_000).optional(),
    pageSize: z.coerce.number().int().min(1).max(50).optional(),
    status: z.enum(["draft", "scheduled", "published"]).optional(),
    type: z.enum(["image", "video"]).optional(),
    cursor: z.string().trim().min(12).max(60).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional()
  })
  .strict();

export const adminMembersQuerySchema = z
  .object({
    query: z.string().trim().max(80).optional(),
    page: z.coerce.number().int().min(1).max(10_000).optional(),
    pageSize: z.coerce.number().int().min(1).max(50).optional(),
    cursor: z.string().trim().min(12).max(60).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional()
  })
  .strict();

export const adminMetricsQuerySchema = z
  .object({
    days: z.coerce.number().int().min(7).max(120).optional()
  })
  .strict();

export const memberProfileQuerySchema = z
  .object({
    suggestName: z.enum(["0", "1"]).optional(),
    hint: z.string().trim().max(40).optional(),
    checkName: z.string().trim().max(40).optional()
  })
  .strict();

export const memberLeaderboardQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(1000).optional(),
    pageSize: z.coerce.number().int().min(5).max(50).optional(),
    q: z.string().trim().max(80).optional()
  })
  .strict();
