import { getOptionalSiteUrl } from "@/lib/env";

const RAZORPAY_ORIGINS = ["https://checkout.razorpay.com", "https://api.razorpay.com"];
const CLOUDINARY_ORIGINS = ["https://res.cloudinary.com"];

export function getAllowedOrigin() {
  const site = getOptionalSiteUrl();
  return new URL(site).origin;
}

function buildCsp() {
  const isProd = process.env.NODE_ENV === "production";
  const upgrade = isProd ? "upgrade-insecure-requests;" : "";
  const scriptUnsafeEval = isProd ? "" : " 'unsafe-eval'";

  return [
    "default-src 'self';",
    "base-uri 'self';",
    "frame-ancestors 'none';",
    "object-src 'none';",
    "form-action 'self' https://api.razorpay.com https://checkout.razorpay.com;",
    `script-src 'self' 'unsafe-inline'${scriptUnsafeEval} https://checkout.razorpay.com;`,
    "style-src 'self' 'unsafe-inline';",
    "font-src 'self' data:;",
    `img-src 'self' data: blob: ${RAZORPAY_ORIGINS.join(" ")} ${CLOUDINARY_ORIGINS.join(" ")};`,
    `media-src 'self' blob: ${CLOUDINARY_ORIGINS.join(" ")};`,
    `connect-src 'self' ${RAZORPAY_ORIGINS.join(" ")} ${CLOUDINARY_ORIGINS.join(" ")};`,
    `frame-src ${RAZORPAY_ORIGINS.join(" ")};`,
    "worker-src 'self' blob:;",
    "manifest-src 'self';",
    upgrade
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

const CSP_VALUE = buildCsp();

export function applySecurityHeaders(headers: Headers) {
  if (process.env.NODE_ENV === "production") {
    headers.set("Content-Security-Policy", CSP_VALUE);
  }
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Permissions-Policy",
    "accelerometer=(), autoplay=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=(self), usb=(), interest-cohort=()"
  );
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-site");
  headers.set("Cross-Origin-Embedder-Policy", "unsafe-none");
  headers.set("X-DNS-Prefetch-Control", "off");

  if (process.env.NODE_ENV === "production") {
    headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
}

export function applyApiCorsHeaders(headers: Headers, requestOrigin: string | null) {
  const allowedOrigin = getAllowedOrigin();
  headers.set("Vary", "Origin");
  headers.set("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-Id, X-Cron-Secret");
  headers.set("Access-Control-Allow-Credentials", "true");

  if (requestOrigin && requestOrigin === allowedOrigin) {
    headers.set("Access-Control-Allow-Origin", allowedOrigin);
  }
}
