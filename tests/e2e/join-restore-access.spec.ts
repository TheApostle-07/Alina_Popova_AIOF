import { expect, test } from "@playwright/test";

test.describe("membership flow", () => {
  test("join -> success -> restore OTP -> access route", async ({ page }) => {
    await page.addInitScript(() => {
      class FakeRazorpay {
        private readonly options: Record<string, any>;

        constructor(options: Record<string, any>) {
          this.options = options;
        }

        open() {
          setTimeout(() => {
            this.options.handler?.({
              razorpay_payment_id: "pay_test_123",
              razorpay_subscription_id: "sub_test_123",
              razorpay_signature: "sig_test_123"
            });
          }, 30);
        }
      }

      (window as typeof window & { Razorpay?: unknown }).Razorpay = FakeRazorpay;
    });

    await page.route("**/api/track", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: { tracked: true } })
      });
    });

    await page.route("**/api/checkout/create-subscription", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            keyId: "rzp_test_dummy",
            subscriptionId: "sub_test_123",
            checkoutAttemptId: "attempt_test_123",
            prefill: {
              email: "member@example.com",
              phone: "+919999999999"
            }
          }
        })
      });
    });

    await page.route("**/api/membership/status**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            status: "ACTIVE",
            message: "Membership confirmed"
          }
        })
      });
    });

    await page.route("**/api/membership/request-otp", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            sent: true,
            challengeId: "challenge_test_123",
            destination: "your registered email",
            expiresInSeconds: 300,
            expiresAt: new Date(Date.now() + 300_000).toISOString(),
            devOtp: "123456"
          }
        })
      });
    });

    await page.route("**/api/membership/restore", async (route) => {
      await route.fulfill({
        status: 200,
        headers: {
          "content-type": "application/json",
          "set-cookie": "alina_member_session=e2e_mock_session; Path=/; HttpOnly; SameSite=Lax"
        },
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            status: "ACTIVE",
            message: "Access restored"
          }
        })
      });
    });

    await page.goto("/age?next=/join");
    await page.getByRole("button", { name: "I am 18+ and continue" }).click();
    await expect(page).toHaveURL(/\/join/);

    await expect(page.getByRole("button", { name: "Join Membership" })).toBeVisible();
    await page.getByRole("button", { name: "Join Membership" }).click();

    await page.getByLabel("Email").fill("member@example.com");
    await page.getByLabel("Phone").fill("+919999999999");
    await page.getByRole("button", { name: /Unlock ₹\d+\/month/i }).click();

    await expect(page).toHaveURL(/\/success/);
    await expect(page.getByRole("heading", { name: "Verify OTP to unlock" })).toBeVisible();

    await page.getByRole("button", { name: "Send verification code" }).click();
    await expect(page.getByText("Code sent to")).toBeVisible();

    const otp = ["1", "2", "3", "4", "5", "6"];
    for (let index = 0; index < otp.length; index += 1) {
      await page.getByLabel(`OTP digit ${index + 1}`).fill(otp[index]);
    }

    await expect(page.getByText("Code verified. Signing you in...")).toBeVisible();
    await expect(page).toHaveURL(/\/access/);
  });
});
