import nodemailer from "nodemailer";
import { BRAND_NAME } from "@/lib/constants";
import { getEnv } from "@/lib/env";

function canUseSmtp(env: ReturnType<typeof getEnv>) {
  return Boolean(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS);
}

function createTransporter(env: ReturnType<typeof getEnv>) {
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    }
  });
}

function toAccountUrl(siteUrl: string) {
  return `${siteUrl.replace(/\/+$/, "")}/account`;
}

function toSiteBaseUrl(siteUrl: string) {
  return siteUrl.replace(/\/+$/, "");
}

function normalizeOtp(rawOtp: string) {
  return rawOtp.replace(/[^A-Za-z0-9]/g, "").slice(0, 8);
}

function formatOtpForDisplay(otp: string) {
  return otp.split("").join(" ");
}

function formatExpiryForDisplay(expiresAt: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata"
  }).format(expiresAt);
}

function renderMembershipOtpText(params: {
  brandName: string;
  otp: string;
  expiresMinutes: number;
  expiresAt: Date;
  accountUrl: string;
  supportUrl: string;
  termsUrl: string;
  privacyUrl: string;
}) {
  const expiresAtLabel = formatExpiryForDisplay(params.expiresAt);

  return [
    "Your verification code",
    "",
    `Code: ${params.otp}`,
    `Expires in: ${params.expiresMinutes} minutes`,
    `Expires at: ${expiresAtLabel} (IST)`,
    "",
    `Use this code on your account page: ${params.accountUrl}`,
    "",
    "If this code has expired, request a new code from your account page.",
    "If you did not request this code, you can ignore this email.",
    "",
    "Need help?",
    `Support: ${params.supportUrl}`,
    `Terms: ${params.termsUrl}`,
    `Privacy: ${params.privacyUrl}`
  ].join("\n");
}

type MembershipEmailTheme = "dark" | "light" | "auto";
type ResolvedMembershipEmailTheme = "dark" | "light";

function resolveMembershipEmailTheme(theme?: MembershipEmailTheme): ResolvedMembershipEmailTheme {
  if (theme === "light") {
    return "light";
  }
  return "dark";
}

function getMembershipEmailColors(theme: ResolvedMembershipEmailTheme) {
  if (theme === "light") {
    return {
      bodyBg: "#F5F7FF",
      shellBg: "#EEF1FA",
      outerBorder: "#D8DEEE",
      cardBg: "#FFFFFF",
      cardBorder: "#D8DEEE",
      title: "#0E1018",
      muted: "#55607A",
      accentChipBg: "rgba(230,75,140,0.12)",
      accentChipBorder: "rgba(230,75,140,0.35)",
      accentChipText: "#C7256F",
      otpCardBg: "linear-gradient(180deg,rgba(230,75,140,0.08),rgba(14,16,24,0.04))",
      otpText: "#111827",
      stepBorder: "#D8DEEE",
      linkMuted: "#55607A",
      footerText: "#6E7690",
      divider: "#C8D0E4",
      ctaText: "#FFFFFF"
    } as const;
  }

  return {
    bodyBg: "#07080C",
    shellBg: "#07080C",
    outerBorder: "#1C2030",
    cardBg: "#0E1018",
    cardBorder: "#1C2030",
    title: "#F5F7FF",
    muted: "#B6BCCF",
    accentChipBg: "rgba(230,75,140,0.14)",
    accentChipBorder: "rgba(230,75,140,0.42)",
    accentChipText: "#FF8ABA",
    otpCardBg: "linear-gradient(180deg,rgba(255,255,255,0.03),rgba(0,0,0,0.16))",
    otpText: "#FFFFFF",
    stepBorder: "#1C2030",
    linkMuted: "#B6BCCF",
    footerText: "#8D94AA",
    divider: "#1C2030",
    ctaText: "#FFFFFF"
  } as const;
}

function renderMembershipOtpHtml(params: {
  brandName: string;
  otp: string;
  expiresMinutes: number;
  expiresAt: Date;
  accountUrl: string;
  supportUrl: string;
  termsUrl: string;
  privacyUrl: string;
  siteBaseUrl: string;
  theme?: MembershipEmailTheme;
}) {
  const otpDisplay = formatOtpForDisplay(params.otp);
  const expiresAtLabel = formatExpiryForDisplay(params.expiresAt);
  const year = new Date().getUTCFullYear();
  const resolvedTheme = resolveMembershipEmailTheme(params.theme);
  const colors = getMembershipEmailColors(resolvedTheme);
  const scheme = resolvedTheme === "dark" ? "dark" : "light";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="${scheme}" />
    <meta name="supported-color-schemes" content="${scheme}" />
    <title>Your verification code</title>
  </head>
  <body style="margin:0;padding:0;background:${colors.bodyBg};font-family:Poppins,Segoe UI,Roboto,Arial,sans-serif;color:${colors.title};">
    <div style="display:none;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">
      Your verification code is ${params.otp}. Expires at ${expiresAtLabel} IST.
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${colors.shellBg};padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:620px;border:1px solid ${colors.outerBorder};border-radius:24px;background:${colors.shellBg};overflow:hidden;">
            <tr>
              <td style="padding:18px;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid ${colors.cardBorder};border-radius:18px;background:${colors.cardBg};overflow:hidden;">
                  <tr>
                    <td style="padding:22px 22px 0 22px;text-align:center;">
                      <div style="display:inline-block;padding:7px 11px;border-radius:999px;background:${colors.accentChipBg};border:1px solid ${colors.accentChipBorder};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${colors.accentChipText};font-weight:600;">
                        Private membership security
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:16px 22px 0 22px;text-align:center;">
                      <h1 style="margin:0 0 8px 0;font-size:26px;line-height:1.2;color:${colors.title};">Your verification code</h1>
                      <p style="margin:0;font-size:14px;line-height:1.55;color:${colors.muted};">
                        Use this one-time code to sign in to your ${params.brandName} account.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:18px 22px 0 22px;">
                      <div style="border:1px solid ${colors.cardBorder};border-radius:14px;background:${colors.otpCardBg};padding:18px 16px;text-align:center;">
                        <div style="font-size:12px;color:${colors.muted};letter-spacing:1px;text-transform:uppercase;white-space:nowrap;">Your verification code</div>
                        <div style="margin-top:10px;display:inline-block;white-space:nowrap;font-family:'SFMono-Regular',Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;font-size:30px;letter-spacing:6px;line-height:1.1;font-weight:700;color:${colors.otpText};">
                          ${otpDisplay}
                        </div>
                        <div style="margin-top:10px;font-size:13px;color:#22C55E;font-weight:600;">
                          Expires in ${params.expiresMinutes} minutes
                        </div>
                        <div style="margin-top:5px;font-size:12px;color:${colors.muted};">
                          Expires at ${expiresAtLabel} IST
                        </div>
                        <div style="margin-top:5px;font-size:12px;color:#EF4444;">
                          If expired, request a new code.
                        </div>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:16px 22px 0 22px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="text-align:center;">
                        <tr>
                          <td style="padding:10px 0;border-bottom:1px solid ${colors.stepBorder};font-size:13px;color:${colors.muted};">
                            1. Open your account page
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:10px 0;border-bottom:1px solid ${colors.stepBorder};font-size:13px;color:${colors.muted};">
                            2. Enter the code exactly as shown
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:10px 0;font-size:13px;color:${colors.muted};">
                            3. Access is restored instantly after verification
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:18px 22px 0 22px;text-align:center;">
                      <a href="${params.accountUrl}" style="display:inline-block;background:#E64B8C;color:${colors.ctaText};text-decoration:none;font-size:14px;font-weight:700;padding:12px 18px;border-radius:12px;">
                        Open Account And Verify
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:18px 22px 22px 22px;">
                      <div style="border-top:1px solid ${colors.divider};padding-top:14px;font-size:12px;line-height:1.6;color:${colors.footerText};text-align:center;">
                        If you did not request this code, you can safely ignore this email. For your protection, this code can only be used once.
                      </div>
                      <div style="border-top:1px solid ${colors.divider};margin-top:14px;padding-top:14px;text-align:center;">
                        <div style="font-size:12px;line-height:1.5;color:${colors.muted};">
                          Need help with access? We are here to assist.
                        </div>
                        <div style="margin-top:8px;">
                          <a href="${params.supportUrl}" style="color:#E64B8C;text-decoration:none;font-size:12px;font-weight:600;">Support</a>
                          <span style="color:${colors.footerText};padding:0 8px;">|</span>
                          <a href="${params.termsUrl}" style="color:${colors.linkMuted};text-decoration:none;font-size:12px;">Terms</a>
                          <span style="color:${colors.footerText};padding:0 8px;">|</span>
                          <a href="${params.privacyUrl}" style="color:${colors.linkMuted};text-decoration:none;font-size:12px;">Privacy</a>
                        </div>
                        <div style="margin-top:8px;font-size:11px;color:${colors.footerText};">
                          &copy; ${year} ${params.brandName}. All rights reserved.
                        </div>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          <div style="padding-top:12px;font-size:11px;color:${colors.footerText};">
            <a href="${params.siteBaseUrl}" style="color:${colors.footerText};text-decoration:none;">
              ${params.brandName}
            </a> - Secured access notifications
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendSupportEmail(params: {
  topic: string;
  message: string;
  email?: string;
  phone?: string;
}) {
  const env = getEnv();
  if (!canUseSmtp(env) || !env.SUPPORT_TO_EMAIL) {
    return { skipped: true };
  }

  const transporter = createTransporter(env);

  await transporter.sendMail({
    from: env.SMTP_USER,
    to: env.SUPPORT_TO_EMAIL,
    subject: `[Support] ${params.topic}`,
    text: `Topic: ${params.topic}\nEmail: ${params.email || "n/a"}\nPhone: ${params.phone || "n/a"}\n\n${params.message}`
  });

  return { skipped: false };
}

export async function sendMembershipOtpEmail(params: {
  to: string;
  otp: string;
  expiresMinutes: number;
  expiresAt: Date;
  theme?: MembershipEmailTheme;
}) {
  const env = getEnv();
  if (!canUseSmtp(env)) {
    return { skipped: true };
  }

  const otp = normalizeOtp(params.otp);
  const siteBaseUrl = toSiteBaseUrl(env.NEXT_PUBLIC_SITE_URL);
  const accountUrl = toAccountUrl(env.NEXT_PUBLIC_SITE_URL);
  const supportUrl = `${siteBaseUrl}/support`;
  const termsUrl = `${siteBaseUrl}/terms`;
  const privacyUrl = `${siteBaseUrl}/privacy`;
  const transporter = createTransporter(env);

  await transporter.sendMail({
    from: `"${BRAND_NAME} Membership" <${env.SMTP_USER}>`,
    to: params.to,
    subject: "Your Alina membership verification code",
    text: renderMembershipOtpText({
      brandName: BRAND_NAME,
      otp,
      expiresMinutes: params.expiresMinutes,
      expiresAt: params.expiresAt,
      accountUrl,
      supportUrl,
      termsUrl,
      privacyUrl
    }),
    html: renderMembershipOtpHtml({
      brandName: BRAND_NAME,
      otp,
      expiresMinutes: params.expiresMinutes,
      expiresAt: params.expiresAt,
      accountUrl,
      supportUrl,
      termsUrl,
      privacyUrl,
      siteBaseUrl,
      theme: params.theme
    })
  });

  return { skipped: false };
}
