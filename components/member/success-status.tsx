"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IntentLink } from "@/components/ui/intent-link";
import { RestoreForm } from "@/components/member/restore-form";

type Props = {
  subscriptionId?: string;
  paymentId?: string;
  attemptId?: string;
};

type MembershipStatus = "ACTIVE" | "PENDING" | "PAST_DUE" | "CANCELLED" | "EXPIRED" | "DISPUTED" | "NONE";

const terminalStates: MembershipStatus[] = ["ACTIVE", "PAST_DUE", "CANCELLED", "EXPIRED", "DISPUTED", "NONE"];

export function SuccessStatus({ subscriptionId, paymentId, attemptId }: Props) {
  const [status, setStatus] = useState<MembershipStatus>("PENDING");
  const [message, setMessage] = useState("Verifying payment securely...");
  const [busy, setBusy] = useState(true);
  const [timedOut, setTimedOut] = useState(false);
  const [defaultEmail, setDefaultEmail] = useState("");
  const [defaultPhone, setDefaultPhone] = useState("");
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [showOtpUnlock, setShowOtpUnlock] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (subscriptionId) params.set("subscriptionId", subscriptionId);
    if (paymentId) params.set("paymentId", paymentId);
    if (attemptId) params.set("attemptId", attemptId);
    return params.toString();
  }, [attemptId, paymentId, subscriptionId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setDefaultEmail(window.sessionStorage.getItem("alina_checkout_email") || "");
    setDefaultPhone(window.sessionStorage.getItem("alina_checkout_phone") || "");
  }, []);

  useEffect(() => {
    let isMounted = true;
    const startedAt = Date.now();

    const check = async () => {
      try {
        const response = await fetch(`/api/membership/status?${query}`, {
          method: "GET",
          cache: "no-store"
        });

        const payload = await response.json();
        if (!isMounted) {
          return;
        }

        if (!response.ok || !payload.ok) {
          setMessage(payload.error || "Could not verify membership yet.");
          setBusy(false);
          return;
        }

        const nextStatus = payload.data.status as MembershipStatus;
        setStatus(nextStatus);
        setMessage(payload.data.message || "Status updated.");

        if (nextStatus === "ACTIVE") {
          setBusy(false);
          return;
        }

        if (terminalStates.includes(nextStatus) && nextStatus !== "PENDING") {
          setBusy(false);
          return;
        }

        if (Date.now() - startedAt > 90_000) {
          setTimedOut(true);
          setBusy(false);
          return;
        }

        setTimeout(check, 4000);
      } catch {
        if (!isMounted) {
          return;
        }
        if (Date.now() - startedAt > 90_000) {
          setTimedOut(true);
          setBusy(false);
          return;
        }
        setTimeout(check, 4000);
      }
    };

    void check();

    return () => {
      isMounted = false;
    };
  }, [query]);

  useEffect(() => {
    if (status !== "ACTIVE") {
      setAcceptedPolicies(false);
      setShowOtpUnlock(false);
      setConsentError(null);
    }
  }, [status]);

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle>{status === "ACTIVE" ? "Payment confirmed" : "Payment processing"}</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {busy ? (
          <div className="space-y-2 rounded-xl border border-border bg-surface/60 p-3 text-sm text-muted">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Securing payment and syncing membership...
            </div>
            <p>1. Securing payment</p>
            <p>2. Confirming membership status</p>
            <p>3. Unlocking private feed</p>
          </div>
        ) : null}

        {timedOut ? (
          <p className="text-sm text-warning">
            Still pending after 90 seconds. Use Check Again or Restore Access from Account.
          </p>
        ) : null}

        {status === "ACTIVE" ? (
          showOtpUnlock ? (
            <RestoreForm
              title="Verify OTP to unlock"
              description="For security, verify a code sent to your checkout email before entering membership."
              requestPath="/success"
              successPath="/success"
              defaultEmail={defaultEmail}
              defaultPhone={defaultPhone}
              onRestored={() => {
                if (typeof window !== "undefined") {
                  window.sessionStorage.removeItem("alina_checkout_email");
                  window.sessionStorage.removeItem("alina_checkout_phone");
                }
              }}
            />
          ) : (
            <div className="space-y-4 rounded-2xl border border-border/85 bg-surface/65 p-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-medium text-success">
                <ShieldCheck className="h-3.5 w-3.5" /> Payment confirmed
              </div>
              <p className="text-sm text-muted">
                Before unlocking your membership on this device, please confirm you accept the{" "}
                <IntentLink href="/terms" className="text-text underline-offset-2 hover:underline">
                  Terms
                </IntentLink>
                ,{" "}
                <IntentLink href="/privacy" className="text-text underline-offset-2 hover:underline">
                  Privacy
                </IntentLink>{" "}
                and{" "}
                <IntentLink href="/refund" className="text-text underline-offset-2 hover:underline">
                  Refund Policy
                </IntentLink>
                .
              </p>

              <label className="flex items-start gap-3 rounded-xl border border-border/80 bg-bg/55 px-3 py-2.5 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={acceptedPolicies}
                  onChange={(event) => {
                    setAcceptedPolicies(event.target.checked);
                    if (event.target.checked) {
                      setConsentError(null);
                    }
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-border bg-surface text-accent focus:ring-accent"
                />
                <span>I accept the membership terms and policy boundaries.</span>
              </label>

              {consentError ? <p className="text-sm text-danger">{consentError}</p> : null}

              <Button
                className="w-full"
                onClick={() => {
                  if (!acceptedPolicies) {
                    setConsentError("Please accept terms and conditions to continue.");
                    return;
                  }
                  setConsentError(null);
                  setShowOtpUnlock(true);
                }}
              >
                Continue to OTP sign in
              </Button>
            </div>
          )
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="secondary" className="w-full" onClick={() => window.location.reload()}>
              Check again
            </Button>
            <Button asChild className="w-full">
              <IntentLink href="/account">Restore access</IntentLink>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
