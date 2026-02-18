import { type ClassValue, clsx } from "clsx";
import { format } from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeEmail(email?: string | null) {
  return email ? email.trim().toLowerCase() : "";
}

export function normalizePhone(phone?: string | null) {
  if (!phone) {
    return "";
  }

  const stripped = phone.replace(/[^0-9+]/g, "");
  if (stripped.startsWith("+")) {
    return stripped;
  }

  if (stripped.length === 10) {
    return `+91${stripped}`;
  }

  return stripped;
}

export function toDateFromUnixSeconds(value?: number | null) {
  if (!value) {
    return null;
  }

  return new Date(value * 1000);
}

export function formatIST(date: Date | string | null | undefined) {
  if (!date) {
    return "-";
  }

  const value = typeof date === "string" ? new Date(date) : date;
  return format(value, "dd MMM yyyy, hh:mm a");
}

export function getDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}
