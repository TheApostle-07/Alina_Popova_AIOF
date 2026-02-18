import { SuccessStatus } from "@/components/member/success-status";

export default async function SuccessPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) || {};

  const subscriptionId =
    typeof params.razorpay_subscription_id === "string" ? params.razorpay_subscription_id : undefined;
  const paymentId = typeof params.razorpay_payment_id === "string" ? params.razorpay_payment_id : undefined;
  const attemptId = typeof params.attemptId === "string" ? params.attemptId : undefined;

  return (
    <div className="py-10">
      <SuccessStatus subscriptionId={subscriptionId} paymentId={paymentId} attemptId={attemptId} />
    </div>
  );
}
