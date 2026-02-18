"use client";

import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn, MailCheck, PencilLine, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type RestoreStatus =
  | "ACTIVE"
  | "PENDING"
  | "PAST_DUE"
  | "CANCELLED"
  | "EXPIRED"
  | "DISPUTED"
  | "NONE"
  | "OTP_INVALID"
  | "OTP_LOCKED"
  | "OTP_EXPIRED"
  | "OTP_USED"
  | "OTP_INVALID_OR_EXPIRED";

type RestoreFormProps = {
  title?: string;
  description?: string;
  requestPath?: string;
  successPath?: string;
  defaultEmail?: string;
  defaultPhone?: string;
  onRestored?: () => void;
};

type FeedbackTone = "neutral" | "success" | "error" | "info";

function formatCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function isValidEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhoneNumber(value: string) {
  const digitsOnly = value.replace(/\D/g, "");
  const hasSafeCharacters = /^[+0-9\s-]+$/.test(value);
  return hasSafeCharacters && digitsOnly.length >= 8 && digitsOnly.length <= 15;
}

function resolveUiThemeForEmail(): "dark" | "light" {
  try {
    const stored = window.localStorage.getItem("alina_theme");
    if (stored === "dark" || stored === "light") {
      return stored;
    }
  } catch {
    // Ignore localStorage read failures.
  }

  const rootTheme = document.documentElement.dataset.theme;
  if (rootTheme === "dark" || rootTheme === "light") {
    return rootTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function RestoreForm({
  title = "Sign in to your account",
  description = "Enter checkout email or phone, then verify OTP to restore access.",
  requestPath = "/account",
  successPath = "/account",
  defaultEmail = "",
  defaultPhone = "",
  onRestored
}: RestoreFormProps = {}) {
  const router = useRouter();
  const [email, setEmail] = useState(defaultEmail);
  const [phone, setPhone] = useState(defaultPhone);
  const [otp, setOtp] = useState("");
  const [loadingRequest, setLoadingRequest] = useState(false);
  const [loadingVerify, setLoadingVerify] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<FeedbackTone>("neutral");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [destination, setDestination] = useState<string | null>(null);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);
  const [expiresAtMs, setExpiresAtMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpInlineError, setOtpInlineError] = useState<string | null>(null);
  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const autoVerifyKeyRef = useRef<string | null>(null);

  const emailTrimmed = email.trim();
  const phoneTrimmed = phone.trim();
  const hasEmail = emailTrimmed.length > 0;
  const hasPhone = phoneTrimmed.length > 0;
  const isEmailValid = !hasEmail || isValidEmailAddress(emailTrimmed);
  const isPhoneValid = !hasPhone || isValidPhoneNumber(phoneTrimmed);
  const canRequest = Boolean((hasEmail || hasPhone) && isEmailValid && isPhoneValid && !loadingRequest);
  const step = challengeId ? 2 : 1;

  const secondsLeft = expiresAtMs ? Math.max(0, Math.ceil((expiresAtMs - nowMs) / 1000)) : 0;
  const isOtpExpired = Boolean(challengeId && expiresAtMs && secondsLeft <= 0);
  const otpDigits = useMemo(() => Array.from({ length: 6 }, (_, index) => otp[index] ?? ""), [otp]);
  const canVerify = Boolean(challengeId && otp.trim().length === 6 && !isOtpExpired && !loadingVerify);

  const emailFeedback = hasEmail
    ? isEmailValid
      ? { tone: "success" as const, text: "Valid email format." }
      : { tone: "error" as const, text: "Enter a valid email (example@domain.com)." }
    : { tone: "neutral" as const, text: "Optional if phone is provided." };

  const phoneFeedback = hasPhone
    ? isPhoneValid
      ? { tone: "success" as const, text: "Valid phone format." }
      : { tone: "error" as const, text: "Enter a valid phone number (8-15 digits)." }
    : { tone: "neutral" as const, text: "Optional if email is provided." };

  const otpFeedback = isOtpExpired
    ? { tone: "error" as const, text: "This code has expired. Request a new code." }
    : otpInlineError
      ? { tone: "error" as const, text: "Invalid or incomplete code." }
      : otpVerified
        ? { tone: "success" as const, text: "Code verified." }
        : loadingVerify
          ? { tone: "info" as const, text: "Checking code..." }
          : { tone: "neutral" as const, text: "Enter all 6 digits." };

  useEffect(() => {
    if (!challengeId || !expiresAtMs) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [challengeId, expiresAtMs]);

  useEffect(() => {
    if (!challengeId) {
      return;
    }
    window.setTimeout(() => otpInputRefs.current[0]?.focus(), 30);
  }, [challengeId]);

  useEffect(() => {
    if (!isOtpExpired) {
      return;
    }
    setMessage("Code expired. Request a new verification code.");
    setMessageTone("error");
    setOtpVerified(false);
  }, [isOtpExpired]);

  const feedbackTextClassName = (tone: FeedbackTone) =>
    tone === "error"
      ? "text-danger"
      : tone === "success"
        ? "text-success"
        : tone === "info"
          ? "text-accent"
          : "text-muted";

  const updateOtpFromDigits = (nextDigits: string[]) => {
    setOtp(nextDigits.join(""));
  };

  async function verifyOtpAndRestore(codeOverride?: string) {
    if (!challengeId) {
      setMessage("Request a verification code first.");
      setMessageTone("info");
      return;
    }

    const code = (codeOverride ?? otp).trim();

    if (isOtpExpired) {
      setMessage("Code expired. Request a new verification code.");
      setMessageTone("error");
      toast.error("Code expired. Please request a new code.");
      return;
    }

    try {
      setLoadingVerify(true);
      setMessage(null);
      setOtpInlineError(null);
      setOtpVerified(false);

      const response = await fetch("/api/membership/restore", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengeId, otp: code })
      });

      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Could not verify code");
      }

      const status = payload.data.status as RestoreStatus;

      if (status === "OTP_INVALID") {
        setOtpInlineError("Invalid code");
        return;
      }

      if (
        status === "OTP_LOCKED" ||
        status === "OTP_EXPIRED" ||
        status === "OTP_USED" ||
        status === "OTP_INVALID_OR_EXPIRED"
      ) {
        setOtpInlineError("Code expired. Request a new code.");
        setMessage((payload.data.message as string | undefined) || "Code expired. Request a new code.");
        setMessageTone("error");
        return;
      }

      setOtpVerified(true);

      if (status === "ACTIVE") {
        setMessage("Code verified. Signing you in...");
        setMessageTone("success");
        await new Promise((resolve) => window.setTimeout(resolve, 900));

        await Promise.all(
          [
            fetch("/api/track", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ event: "restore_success", path: successPath })
            }),
            successPath === "/success"
              ? fetch("/api/track", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ event: "checkout_success", path: "/success" })
                })
              : Promise.resolve()
          ].map((promise) => promise.catch(() => undefined))
        );

        onRestored?.();
        router.push("/access");
        return;
      }

      setMessage(payload.data.message || "Membership is not active yet.");
      setMessageTone("info");
    } catch (error) {
      const text = error instanceof Error ? error.message : "Unable to restore access";
      setMessage(text);
      setMessageTone("error");
      toast.error(text);
    } finally {
      setLoadingVerify(false);
    }
  }

  const handleOtpInputChange = (index: number, rawValue: string) => {
    if (!challengeId) {
      return;
    }

    const digitsOnly = rawValue.replace(/\D/g, "");
    const nextDigits = [...otpDigits];
    const previousDigit = otpDigits[index];
    const previousOtpLength = otp.trim().length;

    if (!digitsOnly) {
      nextDigits[index] = "";
      updateOtpFromDigits(nextDigits);
      setOtpVerified(false);
      setOtpInlineError(null);
      autoVerifyKeyRef.current = null;
      return;
    }

    let cursor = index;
    for (const digit of digitsOnly) {
      if (cursor > 5) {
        break;
      }
      nextDigits[cursor] = digit;
      cursor += 1;
    }

    const nextOtp = nextDigits.join("");
    setOtp(nextOtp);
    setOtpVerified(false);
    setOtpInlineError(null);
    if (nextOtp.length < 6) {
      autoVerifyKeyRef.current = null;
    }

    const nextFocusIndex = Math.min(5, index + digitsOnly.length);
    window.requestAnimationFrame(() => otpInputRefs.current[nextFocusIndex]?.focus());

    const shouldAutoVerify =
      nextOtp.length === 6 &&
      !loadingVerify &&
      !isOtpExpired &&
      (previousDigit === "" || digitsOnly.length > 1 || previousOtpLength < 6);

    const autoVerifyKey = `${challengeId}:${nextOtp}`;
    if (shouldAutoVerify && autoVerifyKeyRef.current !== autoVerifyKey) {
      autoVerifyKeyRef.current = autoVerifyKey;
      window.setTimeout(() => {
        void verifyOtpAndRestore(nextOtp);
      }, 50);
    }
  };

  const handleOtpKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (!challengeId) {
      return;
    }

    if (event.key === "Backspace") {
      event.preventDefault();
      const nextDigits = [...otpDigits];

      if (nextDigits[index]) {
        nextDigits[index] = "";
        updateOtpFromDigits(nextDigits);
        setOtpVerified(false);
        setOtpInlineError(null);
        autoVerifyKeyRef.current = null;
        return;
      }

      if (index > 0) {
        nextDigits[index - 1] = "";
        updateOtpFromDigits(nextDigits);
        setOtpVerified(false);
        setOtpInlineError(null);
        autoVerifyKeyRef.current = null;
        window.requestAnimationFrame(() => otpInputRefs.current[index - 1]?.focus());
      }
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      otpInputRefs.current[index - 1]?.focus();
      return;
    }

    if (event.key === "ArrowRight" && index < 5) {
      event.preventDefault();
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const requestOtp = async () => {
    try {
      setLoadingRequest(true);
      setMessage(null);
      setMessageTone("neutral");
      setDevOtpHint(null);

      await fetch("/api/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event: "restore_request", path: requestPath })
      }).catch(() => undefined);

      const preferredTheme = resolveUiThemeForEmail();

      const response = await fetch("/api/membership/request-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: emailTrimmed || undefined,
          phone: phoneTrimmed || undefined,
          theme: preferredTheme
        })
      });

      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Could not send verification code");
      }

      const nextChallengeId = payload.data.challengeId as string | undefined;
      if (!nextChallengeId) {
        throw new Error("Could not start verification. Try again.");
      }

      setChallengeId(nextChallengeId);
      setDestination((payload.data.destination as string | undefined) || null);
      setDevOtpHint((payload.data.devOtp as string | undefined) || null);

      const expiresAtIso = (payload.data.expiresAt as string | undefined) || "";
      const expiresAtFromIso = Date.parse(expiresAtIso);
      const ttlSecondsRaw = Number(payload.data.expiresInSeconds || 0);
      const ttlSeconds = Number.isFinite(ttlSecondsRaw) ? Math.max(0, ttlSecondsRaw) : 0;
      const nextExpiresAtMs = Number.isFinite(expiresAtFromIso)
        ? expiresAtFromIso
        : Date.now() + ttlSeconds * 1000;

      setExpiresAtMs(nextExpiresAtMs);
      setNowMs(Date.now());
      setOtp("");
      setOtpVerified(false);
      setOtpInlineError(null);
      autoVerifyKeyRef.current = null;
      setMessage("Code sent. Enter the 6-digit OTP to sign in.");
      setMessageTone("success");
      toast.success("Verification code sent");
    } catch (error) {
      const text = error instanceof Error ? error.message : "Unable to send code";
      setMessage(text);
      setMessageTone("error");
      toast.error(text);
    } finally {
      setLoadingRequest(false);
    }
  };

  const resetChallenge = () => {
    setChallengeId(null);
    setOtp("");
    setDestination(null);
    setDevOtpHint(null);
    setExpiresAtMs(null);
    setNowMs(Date.now());
    setOtpVerified(false);
    setOtpInlineError(null);
    autoVerifyKeyRef.current = null;
    setMessage("Details unlocked. Update contact and request OTP again.");
    setMessageTone("info");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-bg/40 p-2 text-xs">
          <div
            className={cn(
              "rounded-lg px-3 py-2 font-medium",
              step === 1 ? "bg-accent/15 text-accent" : "bg-surface text-muted"
            )}
          >
            1. Contact details
          </div>
          <div
            className={cn(
              "rounded-lg px-3 py-2 font-medium",
              step === 2 ? "bg-accent/15 text-accent" : "bg-surface text-muted"
            )}
          >
            2. OTP verification
          </div>
        </div>

        {step === 1 ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="restore-email">Email</Label>
              <Input
                id="restore-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={cn(
                  hasEmail && !isEmailValid && "border-danger/60 focus-visible:ring-danger/60",
                  hasEmail && isEmailValid && "border-success/45 focus-visible:ring-success/60"
                )}
              />
              <p className={cn("text-xs", feedbackTextClassName(emailFeedback.tone))}>{emailFeedback.text}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="restore-phone">Phone</Label>
              <Input
                id="restore-phone"
                type="tel"
                placeholder="+91 98xxxxxx"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className={cn(
                  hasPhone && !isPhoneValid && "border-danger/60 focus-visible:ring-danger/60",
                  hasPhone && isPhoneValid && "border-success/45 focus-visible:ring-success/60"
                )}
              />
              <p className={cn("text-xs", feedbackTextClassName(phoneFeedback.tone))}>{phoneFeedback.text}</p>
            </div>

            <Button
              className="h-12 w-full rounded-2xl text-base font-semibold"
              size="lg"
              onClick={requestOtp}
              disabled={!canRequest}
            >
              {loadingRequest ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending code...
                </>
              ) : (
                <>
                  <MailCheck className="mr-2 h-4 w-4" /> Continue to OTP
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-bg/50 p-3 text-xs text-muted">
              <p>
                Verification code sent to {destination || emailTrimmed || "your registered email"}.
              </p>
              <p className="mt-1">
                Need to change details? Use <strong>Edit details</strong> below.
              </p>
            </div>

            <div className="space-y-2 rounded-xl border border-border bg-bg/50 p-3">
              <Label htmlFor="restore-otp">Enter 6-digit OTP</Label>
              <div
                id="restore-otp"
                className="grid grid-cols-6 gap-2 sm:gap-2.5"
                role="group"
                aria-label="One-time password digits"
              >
                {otpDigits.map((digit, index) => (
                  <input
                    key={`otp-digit-${index}`}
                    ref={(element) => {
                      otpInputRefs.current[index] = element;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    value={digit}
                    disabled={loadingVerify}
                    onChange={(event) => handleOtpInputChange(index, event.target.value)}
                    onKeyDown={(event) => handleOtpKeyDown(index, event)}
                    onFocus={(event) => event.currentTarget.select()}
                    className={cn(
                      "h-11 rounded-xl border bg-bg/70 text-center text-lg font-semibold tracking-[0.08em] text-text outline-none transition focus-visible:ring-2",
                      otpFeedback.tone === "error"
                        ? "border-danger/60 focus-visible:ring-danger/60"
                        : otpFeedback.tone === "success"
                          ? "border-success/55 focus-visible:ring-success/60"
                          : otpFeedback.tone === "info"
                            ? "border-accent/55 focus-visible:ring-accent/70"
                            : "border-border/90 focus-visible:ring-accent/70"
                    )}
                    aria-label={`OTP digit ${index + 1}`}
                  />
                ))}
              </div>

              {otpInlineError ? <p className="text-xs text-danger">{otpInlineError}</p> : null}
              {!otpInlineError ? (
                <p className={cn("text-xs", feedbackTextClassName(otpFeedback.tone))}>{otpFeedback.text}</p>
              ) : null}

              <p className={cn("text-xs", isOtpExpired ? "text-danger" : "text-warning")}>
                {isOtpExpired ? "This code has expired." : `Code expires in ${formatCountdown(secondsLeft)}`}
              </p>

              {devOtpHint ? (
                <p className="text-xs text-warning">
                  Dev mode OTP: <span className="font-mono">{devOtpHint}</span>
                </p>
              ) : null}
            </div>

            <Button
              className="h-12 w-full rounded-2xl text-base font-semibold"
              size="lg"
              onClick={() => {
                void verifyOtpAndRestore();
              }}
              disabled={!canVerify}
            >
              {loadingVerify ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in...
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" /> Sign in with OTP
                </>
              )}
            </Button>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                variant="secondary"
                className="h-11 w-full rounded-2xl"
                onClick={requestOtp}
                disabled={loadingRequest}
              >
                {loadingRequest ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <RotateCcw className="mr-2 h-4 w-4" /> Resend OTP
                  </>
                )}
              </Button>
              <Button
                variant="secondary"
                className="h-11 w-full rounded-2xl"
                onClick={resetChallenge}
                disabled={loadingRequest || loadingVerify}
              >
                <PencilLine className="mr-2 h-4 w-4" /> Edit details
              </Button>
            </div>
          </div>
        )}

        {message ? <p className={cn("text-sm", feedbackTextClassName(messageTone))}>{message}</p> : null}
      </CardContent>
    </Card>
  );
}
