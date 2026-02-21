import nodemailer from "nodemailer";
import { BRAND_NAME, VIP_BOOKING_ALERT_EMAIL } from "@/lib/constants";
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

function toVipUrl(siteUrl: string) {
  return `${siteUrl.replace(/\/+$/, "")}/vip`;
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

function formatVipCallSchedule(callStartsAt: Date, durationMinutes: number) {
  const callEndsAt = new Date(callStartsAt.getTime() + durationMinutes * 60 * 1000);
  const format = (value: Date) =>
    new Intl.DateTimeFormat("en-IN", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "Asia/Kolkata"
    }).format(value);

  return {
    startsAt: format(callStartsAt),
    endsAt: format(callEndsAt)
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
  if (theme === "light" || theme === "dark") {
    return theme;
  }

  try {
    const hourLabel = new Intl.DateTimeFormat("en-IN", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Kolkata"
    }).format(new Date());
    const hour = Number(hourLabel);
    if (Number.isFinite(hour) && hour >= 7 && hour < 19) {
      return "light";
    }
  } catch {
    // Ignore and use dark fallback.
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

function renderVipWinnerText(params: {
  recipientLabel: string;
  slotTitle: string;
  durationMinutes: number;
  startsAtLabel: string;
  endsAtLabel: string;
  winningBidAmount: number;
  meetingJoinUrl?: string | null;
  vipUrl: string;
  supportUrl: string;
}) {
  return [
    `Hi ${params.recipientLabel},`,
    "",
    "Your VIP call slot is confirmed.",
    "",
    `Slot: ${params.slotTitle}`,
    `Duration: ${params.durationMinutes} minutes`,
    `Call starts: ${params.startsAtLabel} (IST)`,
    `Call ends: ${params.endsAtLabel} (IST)`,
    `Winning bid: INR ${params.winningBidAmount}`,
    "",
    params.meetingJoinUrl
      ? `Meeting link: ${params.meetingJoinUrl}`
      : "Meeting link will be shared from admin shortly.",
    "",
    "Rules reminder:",
    "- Scheduled call slot only",
    "- No private chat promises",
    "- Please join on time",
    "",
    `VIP area: ${params.vipUrl}`,
    `Support: ${params.supportUrl}`
  ].join("\n");
}

function renderVipWinnerHtml(params: {
  recipientLabel: string;
  slotTitle: string;
  durationMinutes: number;
  startsAtLabel: string;
  endsAtLabel: string;
  winningBidAmount: number;
  meetingJoinUrl?: string | null;
  vipUrl: string;
  supportUrl: string;
}) {
  const safeRecipientLabel = escapeHtml(params.recipientLabel);
  const safeSlotTitle = escapeHtml(params.slotTitle);
  const safeStartsAt = escapeHtml(params.startsAtLabel);
  const safeEndsAt = escapeHtml(params.endsAtLabel);
  const safeVipUrl = escapeHtml(params.vipUrl);
  const safeSupportUrl = escapeHtml(params.supportUrl);
  const safeMeetingJoinUrl = params.meetingJoinUrl ? escapeHtml(params.meetingJoinUrl) : null;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
    <title>VIP slot booked</title>
  </head>
  <body style="margin:0;padding:0;background:#07080C;font-family:Poppins,Segoe UI,Roboto,Arial,sans-serif;color:#F5F7FF;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:620px;border:1px solid #1C2030;border-radius:20px;background:#0E1018;">
            <tr>
              <td style="padding:24px;">
                <div style="display:inline-block;padding:6px 10px;border-radius:999px;border:1px solid rgba(230,75,140,0.4);background:rgba(230,75,140,0.14);font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#FF8ABA;">
                  VIP Call Booking Confirmed
                </div>
                <h1 style="margin:14px 0 8px 0;font-size:26px;line-height:1.2;color:#F5F7FF;">Hi ${safeRecipientLabel}, your slot is booked.</h1>
                <p style="margin:0 0 16px 0;color:#B6BCCF;font-size:14px;line-height:1.6;">
                  This confirms your winning VIP slot with Alina. Please keep this email for schedule reference.
                </p>
                <div style="border:1px solid #1C2030;border-radius:14px;background:#07080C;padding:14px 16px;">
                  <p style="margin:0 0 8px 0;color:#F5F7FF;font-weight:600;">${safeSlotTitle}</p>
                  <p style="margin:0;color:#B6BCCF;font-size:13px;line-height:1.7;">
                    Duration: ${params.durationMinutes} minutes<br />
                    Starts: ${safeStartsAt} (IST)<br />
                    Ends: ${safeEndsAt} (IST)<br />
                    Winning bid: INR ${params.winningBidAmount}
                  </p>
                </div>
                ${
                  safeMeetingJoinUrl
                    ? `<p style="margin:14px 0 0 0;"><a href="${safeMeetingJoinUrl}" style="display:inline-block;background:#E64B8C;color:#FFFFFF;text-decoration:none;padding:10px 14px;border-radius:10px;font-size:14px;font-weight:700;">Open Meeting Link</a></p>`
                    : `<p style="margin:14px 0 0 0;color:#F59E0B;font-size:13px;">Meeting link will be shared shortly by admin.</p>`
                }
                <p style="margin:14px 0 0 0;color:#B6BCCF;font-size:12px;line-height:1.7;">
                  Scheduled call slot only. No private chat promises.
                </p>
                <p style="margin:14px 0 0 0;font-size:12px;color:#8D94AA;">
                  <a href="${safeVipUrl}" style="color:#E64B8C;text-decoration:none;">VIP Area</a> |
                  <a href="${safeSupportUrl}" style="color:#B6BCCF;text-decoration:none;">Support</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderVipAdminText(params: {
  slotTitle: string;
  durationMinutes: number;
  startsAtLabel: string;
  endsAtLabel: string;
  winningBidAmount: number;
  auctionId: string;
  winnerLabel: string;
  winnerEmail?: string | null;
  winnerPhone?: string | null;
  meetingJoinUrl?: string | null;
  vipUrl: string;
}) {
  return [
    "VIP slot booked.",
    "",
    `Slot: ${params.slotTitle}`,
    `Auction ID: ${params.auctionId}`,
    `Duration: ${params.durationMinutes} minutes`,
    `Call starts: ${params.startsAtLabel} (IST)`,
    `Call ends: ${params.endsAtLabel} (IST)`,
    `Winning bid: INR ${params.winningBidAmount}`,
    "",
    `Winner: ${params.winnerLabel}`,
    `Winner email: ${params.winnerEmail || "n/a"}`,
    `Winner phone: ${params.winnerPhone || "n/a"}`,
    `Meeting link: ${params.meetingJoinUrl || "not provided"}`,
    "",
    `VIP board: ${params.vipUrl}`
  ].join("\n");
}

function renderVipAdminHtml(params: {
  slotTitle: string;
  durationMinutes: number;
  startsAtLabel: string;
  endsAtLabel: string;
  winningBidAmount: number;
  auctionId: string;
  winnerLabel: string;
  winnerEmail?: string | null;
  winnerPhone?: string | null;
  meetingJoinUrl?: string | null;
  vipUrl: string;
}) {
  const safeSlotTitle = escapeHtml(params.slotTitle);
  const safeStartsAt = escapeHtml(params.startsAtLabel);
  const safeEndsAt = escapeHtml(params.endsAtLabel);
  const safeAuctionId = escapeHtml(params.auctionId);
  const safeWinnerLabel = escapeHtml(params.winnerLabel);
  const safeWinnerEmail = escapeHtml(params.winnerEmail || "n/a");
  const safeWinnerPhone = escapeHtml(params.winnerPhone || "n/a");
  const safeMeetingJoinUrl = escapeHtml(params.meetingJoinUrl || "not provided");
  const safeVipUrl = escapeHtml(params.vipUrl);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>VIP slot booked</title>
  </head>
  <body style="margin:0;padding:20px;background:#07080C;color:#F5F7FF;font-family:Poppins,Segoe UI,Roboto,Arial,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:700px;border:1px solid #1C2030;border-radius:14px;background:#0E1018;">
      <tr>
        <td style="padding:20px;">
          <h1 style="margin:0 0 12px 0;font-size:22px;">VIP slot booked</h1>
          <p style="margin:0 0 14px 0;color:#B6BCCF;font-size:14px;">A winner has been finalized for the slot.</p>
          <p style="margin:0 0 6px 0;font-size:13px;color:#B6BCCF;">Slot: <span style="color:#F5F7FF;">${safeSlotTitle}</span></p>
          <p style="margin:0 0 6px 0;font-size:13px;color:#B6BCCF;">Auction ID: <span style="color:#F5F7FF;">${safeAuctionId}</span></p>
          <p style="margin:0 0 6px 0;font-size:13px;color:#B6BCCF;">Duration: <span style="color:#F5F7FF;">${params.durationMinutes} minutes</span></p>
          <p style="margin:0 0 6px 0;font-size:13px;color:#B6BCCF;">Starts: <span style="color:#F5F7FF;">${safeStartsAt} (IST)</span></p>
          <p style="margin:0 0 6px 0;font-size:13px;color:#B6BCCF;">Ends: <span style="color:#F5F7FF;">${safeEndsAt} (IST)</span></p>
          <p style="margin:0 0 6px 0;font-size:13px;color:#B6BCCF;">Winning bid: <span style="color:#F5F7FF;">INR ${params.winningBidAmount}</span></p>
          <hr style="border:none;border-top:1px solid #1C2030;margin:14px 0;" />
          <p style="margin:0 0 6px 0;font-size:13px;color:#B6BCCF;">Winner: <span style="color:#F5F7FF;">${safeWinnerLabel}</span></p>
          <p style="margin:0 0 6px 0;font-size:13px;color:#B6BCCF;">Winner email: <span style="color:#F5F7FF;">${safeWinnerEmail}</span></p>
          <p style="margin:0 0 6px 0;font-size:13px;color:#B6BCCF;">Winner phone: <span style="color:#F5F7FF;">${safeWinnerPhone}</span></p>
          <p style="margin:0 0 6px 0;font-size:13px;color:#B6BCCF;">Meeting link: <span style="color:#F5F7FF;">${safeMeetingJoinUrl}</span></p>
          <p style="margin:14px 0 0 0;font-size:13px;"><a href="${safeVipUrl}" style="color:#E64B8C;text-decoration:none;">Open VIP board</a></p>
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

export async function sendVipSlotBookedEmails(params: {
  auctionId: string;
  slotTitle: string;
  durationMinutes: number;
  callStartsAt: Date;
  winningBidAmount: number;
  recipientLabel: string;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  meetingJoinUrl?: string | null;
  sendWinner?: boolean;
  sendAdmin?: boolean;
}) {
  const env = getEnv();
  if (!canUseSmtp(env)) {
    return {
      skipped: true,
      winnerSent: false,
      adminSent: false
    };
  }

  const transporter = createTransporter(env);
  const siteBaseUrl = toSiteBaseUrl(env.NEXT_PUBLIC_SITE_URL);
  const vipUrl = toVipUrl(env.NEXT_PUBLIC_SITE_URL);
  const supportUrl = `${siteBaseUrl}/support`;
  const schedule = formatVipCallSchedule(params.callStartsAt, params.durationMinutes);

  let winnerSent = false;
  let adminSent = false;

  if (params.sendWinner !== false && params.recipientEmail) {
    await transporter.sendMail({
      from: `"${BRAND_NAME} VIP" <${env.SMTP_USER}>`,
      to: params.recipientEmail,
      subject: "Your VIP call slot is booked",
      text: renderVipWinnerText({
        recipientLabel: params.recipientLabel,
        slotTitle: params.slotTitle,
        durationMinutes: params.durationMinutes,
        startsAtLabel: schedule.startsAt,
        endsAtLabel: schedule.endsAt,
        winningBidAmount: params.winningBidAmount,
        meetingJoinUrl: params.meetingJoinUrl,
        vipUrl,
        supportUrl
      }),
      html: renderVipWinnerHtml({
        recipientLabel: params.recipientLabel,
        slotTitle: params.slotTitle,
        durationMinutes: params.durationMinutes,
        startsAtLabel: schedule.startsAt,
        endsAtLabel: schedule.endsAt,
        winningBidAmount: params.winningBidAmount,
        meetingJoinUrl: params.meetingJoinUrl,
        vipUrl,
        supportUrl
      })
    });
    winnerSent = true;
  }

  if (params.sendAdmin !== false) {
    await transporter.sendMail({
      from: `"${BRAND_NAME} VIP Alerts" <${env.SMTP_USER}>`,
      to: VIP_BOOKING_ALERT_EMAIL,
      subject: `[VIP Booked] ${params.slotTitle}`,
      text: renderVipAdminText({
        slotTitle: params.slotTitle,
        durationMinutes: params.durationMinutes,
        startsAtLabel: schedule.startsAt,
        endsAtLabel: schedule.endsAt,
        winningBidAmount: params.winningBidAmount,
        auctionId: params.auctionId,
        winnerLabel: params.recipientLabel,
        winnerEmail: params.recipientEmail,
        winnerPhone: params.recipientPhone,
        meetingJoinUrl: params.meetingJoinUrl,
        vipUrl
      }),
      html: renderVipAdminHtml({
        slotTitle: params.slotTitle,
        durationMinutes: params.durationMinutes,
        startsAtLabel: schedule.startsAt,
        endsAtLabel: schedule.endsAt,
        winningBidAmount: params.winningBidAmount,
        auctionId: params.auctionId,
        winnerLabel: params.recipientLabel,
        winnerEmail: params.recipientEmail,
        winnerPhone: params.recipientPhone,
        meetingJoinUrl: params.meetingJoinUrl,
        vipUrl
      })
    });
    adminSent = true;
  }

  return {
    skipped: false,
    winnerSent,
    adminSent
  };
}
