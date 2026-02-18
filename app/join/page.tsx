import { CheckoutPanel } from "@/components/marketing/checkout-panel";
import { NoGoZoneGate } from "@/components/marketing/no-go-zone-gate";
import { PageViewTracker } from "@/components/marketing/page-view-tracker";
import { MEMBERSHIP_PRICE_INR } from "@/lib/constants";

export default function JoinPage() {
  return (
    <div className="mx-auto grid max-w-4xl gap-6 md:gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
      <PageViewTracker path="/join" />
      <div className="space-y-4 md:space-y-5">
        <p className="text-xs tracking-[0.2em] text-accent">MEMBERSHIP CHECKOUT</p>
        <h1 className="text-3xl font-semibold leading-tight md:text-4xl">
          Come inside my private feed. Instant access.
        </h1>
        <ul className="space-y-2 text-sm leading-relaxed text-muted">
          <li>Exclusive images and short videos in a members-only feed</li>
          <li>Secured by Razorpay at ₹{MEMBERSHIP_PRICE_INR}/month</li>
          <li>Restore access anytime on any device</li>
        </ul>
        <NoGoZoneGate hintClassName="max-w-sm" />
      </div>
      <CheckoutPanel compact trackingPath="/join" />
    </div>
  );
}
