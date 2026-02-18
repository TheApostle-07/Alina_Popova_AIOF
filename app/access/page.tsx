import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MemberDashboard } from "@/components/member/member-dashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IntentLink } from "@/components/ui/intent-link";
import { LAST_SUBSCRIPTION_COOKIE } from "@/lib/constants";
import { connectToDatabase } from "@/lib/db";
import { SubscriptionModel } from "@/lib/models/subscription";
import { getCurrentMemberFromCookies } from "@/lib/auth/guards";
import { reconcileSubscriptionByRazorpayId } from "@/lib/subscription-service";

export default async function AccessPage() {
  const member = await getCurrentMemberFromCookies();

  if (!member) {
    const cookieStore = await cookies();
    const lastSubscriptionId = cookieStore.get(LAST_SUBSCRIPTION_COOKIE)?.value;
    let status: string | null = null;

    if (lastSubscriptionId) {
      try {
        await connectToDatabase();
        const subscription = (await SubscriptionModel.findOne({
          razorpaySubscriptionId: lastSubscriptionId
        })
          .select({ status: 1 })
          .lean()) as { status?: string } | null;

        if (subscription?.status === "PENDING" || subscription?.status === "PAST_DUE") {
          const reconciled = await reconcileSubscriptionByRazorpayId(lastSubscriptionId).catch(() => null);
          if (reconciled?.status) {
            status = reconciled.status;
          } else {
            status = subscription.status || null;
          }
        } else {
          status = subscription?.status || null;
        }
      } catch {
        status = null;
      }
    }

    if (lastSubscriptionId && status === "ACTIVE") {
      redirect(`/success?razorpay_subscription_id=${encodeURIComponent(lastSubscriptionId)}`);
    }

    return (
      <div className="mx-auto max-w-xl py-10">
        <Card>
          <CardHeader>
            <CardTitle>Membership inactive</CardTitle>
            <CardDescription>
              {status === "PAST_DUE"
                ? "Your membership is paused due to payment retry."
                : status === "CANCELLED" || status === "EXPIRED"
                  ? "Your membership is no longer active."
                  : "Your current session is not linked to an active subscription."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted">
              {status === "PAST_DUE"
                ? "Update billing in Razorpay, then restore access from Account."
                : "Restore access or start a new membership."}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              {lastSubscriptionId && (status === "PENDING" || status === "PAST_DUE") ? (
                <Button asChild className="w-full">
                  <IntentLink
                    href={`/success?razorpay_subscription_id=${encodeURIComponent(lastSubscriptionId)}`}
                  >
                    Check payment status
                  </IntentLink>
                </Button>
              ) : (
                <Button asChild className="w-full">
                  <IntentLink href="/account">Restore access</IntentLink>
                </Button>
              )}
              <Button asChild variant="secondary" className="w-full">
                <IntentLink href="/join">Re-subscribe</IntentLink>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <MemberDashboard
      subscriptionId={member.subscription.razorpaySubscriptionId}
      email={member.user.email}
      phone={member.user.phone}
    />
  );
}
