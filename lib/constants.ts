export const AGE_COOKIE_NAME = "alina_age_verified";
export const AGE_DECLINED_COOKIE_NAME = "alina_age_declined";
export const MEMBER_COOKIE_NAME = "alina_member_session";
export const ADMIN_COOKIE_NAME = "alina_admin_session";
export const LAST_SUBSCRIPTION_COOKIE = "alina_last_subscription";
export const LAST_CHECKOUT_ATTEMPT_COOKIE = "alina_last_checkout_attempt";

export const MEMBERSHIP_PRICE_INR = 499;
export const IMAGE_BLUR_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIzMCIgdmlld0JveD0iMCAwIDI0IDMwIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwIiB5MT0iMCIgeDI9IjEiIHkyPSIxIj48c3RvcCBzdG9wLWNvbG9yPSIjMkExNDIyIi8+PHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjMTIxNTI2Ii8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjMwIiBmaWxsPSJ1cmwoI2cpIi8+PC9zdmc+";
export const BRAND_NAME = "Alina Popova";
export const VIP_BOOKING_ALERT_EMAIL = "rufusbright595@gmail.com";
export const MEMBER_SESSION_DAYS = 7;
export const ADMIN_SESSION_HOURS = 12;

export const MEMBERSHIP_STATES = [
  "PENDING",
  "ACTIVE",
  "PAST_DUE",
  "CANCELLED",
  "EXPIRED",
  "DISPUTED"
] as const;

export const CONTENT_STATES = ["draft", "scheduled", "published"] as const;
export const CONTENT_TYPES = ["image", "video"] as const;
export const VIP_SLOT_DURATIONS = [10, 20, 30, 45, 60] as const;
export const VIP_AUCTION_STATUSES = [
  "DRAFT",
  "SCHEDULED",
  "LIVE",
  "ENDED",
  "CANCELLED",
  "SETTLED"
] as const;

export const VIP_BASE_BID_BY_DURATION: Record<(typeof VIP_SLOT_DURATIONS)[number], number> = {
  10: 999,
  20: 1999,
  30: 2999,
  45: 4499,
  60: 5999
};

export type MembershipState = (typeof MEMBERSHIP_STATES)[number];
export type ContentState = (typeof CONTENT_STATES)[number];
export type ContentType = (typeof CONTENT_TYPES)[number];
export type VipSlotDuration = (typeof VIP_SLOT_DURATIONS)[number];
export type VipAuctionStatus = (typeof VIP_AUCTION_STATUSES)[number];
