"use client";

import Script from "next/script";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { MEMBERSHIP_PRICE_INR } from "@/lib/constants";
import { IntentLink } from "@/components/ui/intent-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CreateSubscriptionResponse = {
  keyId: string;
  subscriptionId: string;
  checkoutAttemptId: string;
  prefill: {
    email: string;
    phone: string;
  };
  alreadyActive?: boolean;
};

export function CheckoutPanel({
  compact = false,
  trackingPath,
  directFlow = false
}: {
  compact?: boolean;
  trackingPath?: string;
  directFlow?: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(directFlow);
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);

  const disabled = useMemo(
    () => loading || !email.trim() || !phone.trim() || !acceptedPolicies,
    [acceptedPolicies, email, loading, phone]
  );

  const ensureCheckoutScript = useCallback(async () => {
    if (window.Razorpay) {
      return true;
    }

    const existing = document.querySelector<HTMLScriptElement>("script[data-rzp-checkout='1']");
    if (existing) {
      for (let index = 0; index < 20; index += 1) {
        if (window.Razorpay) {
          return true;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return Boolean(window.Razorpay);
    }

    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.dataset.rzpCheckout = "1";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load checkout script"));
      document.body.appendChild(script);
    }).catch(() => undefined);

    return Boolean(window.Razorpay);
  }, []);

  useEffect(() => {
    if (!detailsOpen) {
      return;
    }

    emailInputRef.current?.focus();
  }, [detailsOpen]);

  useEffect(() => {
    if (!detailsOpen) {
      return;
    }

    void ensureCheckoutScript();
  }, [detailsOpen, ensureCheckoutScript]);

  const startCheckout = async () => {
    setError(null);
    const checkoutReady = await ensureCheckoutScript();
    if (!checkoutReady) {
      setError("Checkout is still loading. Please retry.");
      return;
    }

    try {
      setLoading(true);

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("alina_checkout_email", email.trim());
        window.sessionStorage.setItem("alina_checkout_phone", phone.trim());
      }

      const idempotencyKey = crypto.randomUUID();
      await fetch("/api/track", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ event: "checkout_start", path: trackingPath || (compact ? "/join" : "/") })
      }).catch(() => undefined);

      const response = await fetch("/api/checkout/create-subscription", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKey
        },
        body: JSON.stringify({ email, phone, idempotencyKey, acceptPolicies: acceptedPolicies })
      });

      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Unable to start checkout");
      }

      const data = payload.data as CreateSubscriptionResponse;
      if (data.alreadyActive) {
        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem("alina_checkout_email");
          window.sessionStorage.removeItem("alina_checkout_phone");
        }
        router.push("/access");
        return;
      }

      const RazorpayCheckout = window.Razorpay;
      if (!RazorpayCheckout) {
        throw new Error("Checkout is still loading. Please retry.");
      }

      const razorpay = new RazorpayCheckout({
        key: data.keyId,
        subscription_id: data.subscriptionId,
        name: "Alina Popova",
        description: "VIP Membership",
        prefill: {
          email: data.prefill.email,
          contact: data.prefill.phone
        },
        notes: {
          checkoutAttemptId: data.checkoutAttemptId
        },
        theme: {
          color: "#E64B8C"
        },
        handler: (result) => {
          const nextUrl = new URL("/success", window.location.origin);
          nextUrl.searchParams.set("razorpay_payment_id", result.razorpay_payment_id);
          nextUrl.searchParams.set(
            "razorpay_subscription_id",
            result.razorpay_subscription_id || data.subscriptionId
          );
          nextUrl.searchParams.set("razorpay_signature", result.razorpay_signature);
          nextUrl.searchParams.set("attemptId", data.checkoutAttemptId);
          window.location.href = nextUrl.toString();
        },
        modal: {
          ondismiss: () => {
            toast.message("Checkout closed", {
              description: "You can continue later from Restore Access."
            });
          }
        }
      });

      razorpay.open();
    } catch (checkoutError) {
      const message = checkoutError instanceof Error ? checkoutError.message : "Checkout failed";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const startJoin = () => {
    setError(null);
    setAcceptedPolicies(false);
    setDetailsOpen(true);
  };

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
        data-rzp-checkout="1"
      />
      <Card className="w-full border-accent/20 bg-surface/95">
        <CardHeader className={compact ? "space-y-1 p-4 sm:p-5" : "space-y-1 p-5 sm:p-6"}>
          <CardTitle className="text-xl sm:text-2xl">Join my membership</CardTitle>
          <CardDescription className="text-sm sm:text-base">
            {detailsOpen || directFlow
              ? "Enter your details to continue to secure checkout."
              : "Tap join to continue - it takes less than a minute."}
          </CardDescription>
        </CardHeader>
        <CardContent
          className={
            compact
              ? "space-y-3 p-4 pt-0 sm:space-y-4 sm:p-5 sm:pt-0"
              : "space-y-4 p-5 pt-0 sm:p-6 sm:pt-0"
          }
        >
          {detailsOpen ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="member-email">Email</Label>
                <Input
                  ref={emailInputRef}
                  id="member-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="member-phone">Phone</Label>
                <Input
                  id="member-phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+91 98xxxxxx"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </div>
              <label className="flex items-start gap-3 rounded-xl border border-border/80 bg-bg/55 px-3 py-2.5 text-xs leading-relaxed text-muted">
                <input
                  type="checkbox"
                  checked={acceptedPolicies}
                  onChange={(event) => setAcceptedPolicies(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border bg-surface text-accent focus:ring-accent"
                />
                <span>
                  I accept{" "}
                  <IntentLink href="/terms" className="text-text underline-offset-2 hover:underline">
                    Terms
                  </IntentLink>
                  ,{" "}
                  <IntentLink href="/privacy" className="text-text underline-offset-2 hover:underline">
                    Privacy
                  </IntentLink>
                  {" "}and{" "}
                  <IntentLink href="/refund" className="text-text underline-offset-2 hover:underline">
                    Refund Policy
                  </IntentLink>
                  .
                </span>
              </label>
            </>
          ) : null}
          <Button
            size="lg"
            className="h-12 w-full rounded-2xl text-[15px] sm:h-14 sm:text-base"
            onClick={detailsOpen || directFlow ? startCheckout : startJoin}
            disabled={detailsOpen || directFlow ? disabled : false}
            data-analytics-cta={detailsOpen || directFlow ? "checkout_unlock" : "checkout_join"}
          >
            {detailsOpen || directFlow
              ? loading
                ? "Preparing secure checkout..."
                : `Unlock ₹${MEMBERSHIP_PRICE_INR}/month`
              : "Join Membership"}
          </Button>
          <p className="flex items-center gap-2 text-xs text-muted sm:text-sm">
            <ShieldCheck className="h-4 w-4 text-success" />
            Secured by Razorpay. 18+ members only. No custom requests.
          </p>
          <p className="text-[11px] leading-relaxed text-muted sm:text-xs">
            Membership unlock is enabled only after consent to{" "}
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
            . Digital content purchases are non-refundable except where required by law.
          </p>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </CardContent>
      </Card>
    </>
  );
}
