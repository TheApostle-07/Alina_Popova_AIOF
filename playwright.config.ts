import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT || 3000);
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: ["**/._*"],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_SITE_URL: baseURL,
      MONGODB_URI: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/alina_local",
      RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || "rzp_test_dummy",
      RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || "dummy_secret",
      RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || "dummy_webhook_secret",
      RAZORPAY_PLAN_ID: process.env.RAZORPAY_PLAN_ID || "plan_dummy",
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "change-me-admin-password",
      SESSION_SECRET:
        process.env.SESSION_SECRET ||
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      CRON_SECRET: process.env.CRON_SECRET || "cron_dummy_secret_123456",
      CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || "demo",
      CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || "demo",
      CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || "demo"
    }
  }
});
