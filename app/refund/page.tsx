import Link from "next/link";
import { AlertTriangle, ReceiptText, ShieldCheck } from "lucide-react";
import { LegalPageShell } from "@/components/legal/legal-page-shell";

const nonRefundableCases = [
  "Change of mind after purchase",
  "Not using the membership after successful activation",
  "Forgetting to cancel before renewal date",
  "Dissatisfaction with content style, frequency, or personal expectations",
  "Account/device access issues caused by incorrect checkout details provided by the user",
  "Temporary downtime from third-party providers (including payment, cloud, ISP, or device network issues)"
] as const;

const possibleExceptions = [
  "Duplicate successful charge for the same billing period",
  "Verified unauthorized payment (subject to payment-provider investigation)",
  "Verified technical non-delivery where access cannot be restored within reasonable time and no content was consumed"
] as const;

export default function RefundPage() {
  return (
    <LegalPageShell
      icon={ReceiptText}
      eyebrow="Billing Rules"
      title="Refund Policy"
      summary="This membership provides digital content access. Purchases are final and non-refundable except in narrowly verified exception cases."
      effectiveDate="February 11, 2026"
      highlights={[
        {
          icon: AlertTriangle,
          title: "No refund default",
          detail: "Digital content purchases are final once access is granted."
        },
        {
          icon: ReceiptText,
          title: "Limited exception review",
          detail: "Only verified duplicate or unauthorized cases are considered."
        },
        {
          icon: ShieldCheck,
          title: "Dispute protection",
          detail: "Chargeback abuse may trigger immediate suspension and account restriction."
        }
      ]}
      sections={[
        {
          id: "non-refundable-cases",
          title: "Non-refundable cases",
          points: nonRefundableCases
        },
        {
          id: "limited-exceptions",
          title: "Limited exceptions",
          intro:
            "Refund reviews are rare and handled only in verifiable scenarios. Any exception remains at sole discretion.",
          points: possibleExceptions
        },
        {
          id: "how-to-request-a-review",
          title: "How to request a review",
          points: [
            "Submit a ticket through /support within 7 days of the charge.",
            "Include checkout phone/email, payment ID, date/time, and a concise issue summary.",
            "Additional verification proof may be requested. Incomplete or inconsistent details may be rejected."
          ]
        },
        {
          id: "chargebacks-and-disputes",
          title: "Chargebacks and disputes",
          points: [
            "Initiating a chargeback may suspend access immediately until resolution.",
            "Fraudulent disputes may result in permanent account ban.",
            "Payment, access, and verification logs may be shared with Razorpay and banking partners for dispute handling."
          ]
        },
        {
          id: "cancellation-and-future-billing",
          title: "Cancellation and future billing",
          points: [
            "Cancel through Razorpay subscription settings before your next billing date.",
            "Cancellation stops future renewals only and does not reverse past successful charges.",
            "If payment is pending, delayed, or under review, final access state follows server verification and payment-provider confirmation."
          ]
        }
      ]}
      outro={
        <p className="text-sm text-text">
          This policy works together with <Link href="/terms">/terms</Link> and{" "}
          <Link href="/privacy">/privacy</Link>. Updates to this policy may be posted when billing
          or operational requirements change.
        </p>
      }
    />
  );
}
