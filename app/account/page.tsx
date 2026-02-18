import { RestoreForm } from "@/components/member/restore-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IntentLink } from "@/components/ui/intent-link";
import { getCurrentMemberFromCookies } from "@/lib/auth/guards";

export default async function AccountPage() {
  const member = await getCurrentMemberFromCookies();

  return (
    <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Subscription status</CardTitle>
            <CardDescription>Status is verified from server records.</CardDescription>
          </CardHeader>
          <CardContent>
            {member ? (
              <div className="space-y-2 text-sm">
                <Badge variant="success">ACTIVE</Badge>
                <p className="text-muted">You have active access to my membership on this device.</p>
                <p className="font-mono text-xs text-muted">
                  Sub ID: {member.subscription.razorpaySubscriptionId}
                </p>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <Badge variant="warning">NOT ACTIVE</Badge>
                <p className="text-muted">
                  If payment succeeded, use login/restore below. OTP verification will re-link access.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Manage billing</CardTitle>
            <CardDescription>Cancellations and renewals are handled through Razorpay.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted">
            <p>1. Open the email/SMS Razorpay sent you after checkout.</p>
            <p>2. Use the subscription link to cancel or update payment method.</p>
            <p>3. If anything fails, contact support with your checkout phone/email.</p>
            <IntentLink href="/support" className="text-accent hover:text-accentHover">
              Contact support
            </IntentLink>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        {member ? (
          <Card>
            <CardHeader>
              <CardTitle>You&apos;re signed in</CardTitle>
              <CardDescription>Your current device already has active session access.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted">
                Need to log in on another device? Use the OTP login card below with your checkout details.
              </p>
              <Button asChild className="w-full">
                <IntentLink href="/access">Go to my private feed</IntentLink>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <RestoreForm
          title="Login / Restore access"
          description="Enter checkout email or phone, request OTP, then sign in instantly."
          requestPath="/account"
          successPath="/account"
        />
      </div>
    </div>
  );
}
