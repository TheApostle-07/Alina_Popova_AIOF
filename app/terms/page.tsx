import Link from "next/link";
import { Gavel, RefreshCcw, ShieldCheck } from "lucide-react";
import { LegalPageShell } from "@/components/legal/legal-page-shell";

const sections = [
  {
    id: "agreement-and-eligibility",
    title: "Agreement and eligibility",
    points: [
      "By using this site, purchasing membership, or accessing member content, you agree to these Terms.",
      "You must be at least 18 years old to use this service.",
      "If you do not agree with these Terms, do not use the site or purchase membership."
    ]
  },
  {
    id: "membership-scope",
    title: "What this membership includes",
    points: [
      "This is a digital content membership that provides access to a private feed of images and short videos.",
      "This is not a chat, escort, dating, custom-request, or DM service.",
      "Content volume, timing, style, and schedule may change at any time without notice."
    ]
  },
  {
    id: "billing-renewal-cancellation",
    title: "Billing, renewal, and cancellation",
    points: [
      "Membership is an auto-renewing subscription billed through Razorpay (currently ₹499/month unless otherwise shown at checkout).",
      "You authorize recurring charges until you cancel through Razorpay before your next billing date.",
      "If a renewal charge fails, your status may move to PAST_DUE, CANCELLED, or EXPIRED and access may stop automatically."
    ]
  },
  {
    id: "access-verification-and-restore-flow",
    title: "Access verification and restore flow",
    points: [
      "Access is granted only after server-side verification of payment/subscription state.",
      "Redirect failure does not create entitlement by itself. Access is restored only after verification from payment records.",
      "For security, restore flows may require OTP verification, email/phone match, or additional proof of payment."
    ]
  },
  {
    id: "acceptable-use-and-account-security",
    title: "Acceptable use and account security",
    points: [
      "Your membership is personal and non-transferable. Sharing login/session access is prohibited.",
      "You may not record, scrape, mirror, redistribute, resell, or publicly repost member content.",
      "You are responsible for device/account security. We may log device/session activity to prevent abuse and fraud."
    ]
  },
  {
    id: "intellectual-property",
    title: "Intellectual property",
    points: [
      "All content, branding, code, media, and site assets are protected by copyright and related rights.",
      "Membership grants a limited, revocable, non-exclusive, non-transferable license for personal viewing only.",
      "Any unauthorized use may result in immediate termination and permanent access removal without refund."
    ]
  },
  {
    id: "chargebacks-disputes-and-fraud",
    title: "Chargebacks, disputes, and fraud",
    points: [
      "Chargebacks or payment disputes may result in immediate suspension while the case is reviewed.",
      "We may submit logs and records (including payment, access, and device/IP signals) to contest fraudulent claims.",
      "Fraud, abuse, or policy evasion may result in permanent ban."
    ]
  },
  {
    id: "refund-policy-reference",
    title: "Refund policy reference",
    points: [
      "Digital membership purchases are final and non-refundable.",
      "No pro-rata, partial, or goodwill refunds for unused time, changed preference, or failure to cancel before renewal.",
      "See the full Refund Policy at /refund."
    ]
  },
  {
    id: "service-availability-and-technical-limits",
    title: "Service availability and technical limits",
    points: [
      "The service is provided on an \"as is\" and \"as available\" basis without guarantees of uninterrupted availability.",
      "Downtime or delays may occur due to maintenance, network issues, payment provider outages, attacks, or force majeure events.",
      "We may modify, suspend, or discontinue features to protect operations, compliance, or platform integrity."
    ]
  },
  {
    id: "disclaimer-and-limitation-of-liability",
    title: "Disclaimer and limitation of liability",
    points: [
      "To the fullest extent allowed, we disclaim all warranties, express or implied, including merchantability, fitness, and non-infringement.",
      "To the fullest extent allowed, we are not liable for indirect, incidental, consequential, special, exemplary, or punitive damages.",
      "To the fullest extent allowed, our total liability for any claim is limited to the amount paid by you for membership during the 30 days before the event."
    ]
  },
  {
    id: "indemnity",
    title: "Indemnity",
    points: [
      "You agree to indemnify and hold us harmless from claims, losses, liabilities, and costs arising from misuse of the service, policy violations, or unlawful conduct."
    ]
  },
  {
    id: "updates-to-these-terms",
    title: "Updates to these terms",
    points: [
      "We may update these Terms at any time. Updated Terms become effective when posted.",
      "Continued use after updates means you accept the revised Terms."
    ]
  }
] as const;

export default function TermsPage() {
  return (
    <LegalPageShell
      icon={Gavel}
      eyebrow="Legal"
      title="Terms and Conditions"
      summary="These terms define membership access, payment behavior, and security boundaries for using the Alina Popova membership platform."
      effectiveDate="February 11, 2026"
      highlights={[
        {
          icon: ShieldCheck,
          title: "18+ restricted service",
          detail: "Access is only for legally eligible adults who accept these terms."
        },
        {
          icon: Gavel,
          title: "Clear service boundaries",
          detail: "Misuse, leaks, fraud, and chargeback abuse can lead to immediate termination."
        },
        {
          icon: RefreshCcw,
          title: "Auto-renewing membership",
          detail: "Billing continues until cancelled through Razorpay before next renewal."
        }
      ]}
      sections={sections}
      outro={
        <p className="text-sm text-text">
          Need help with billing or restore access? Use <Link href="/support">/support</Link> and
          include the checkout phone/email used during payment.
        </p>
      }
    />
  );
}
