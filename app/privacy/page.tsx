import Link from "next/link";
import { Database, Lock, ShieldCheck } from "lucide-react";
import { LegalPageShell } from "@/components/legal/legal-page-shell";
import { getPublicSiteSettings } from "@/lib/site-settings";

const collectedData = [
  "Contact data: email, phone, and optional support details you provide",
  "Membership data: subscription status, plan ID, renewal windows, verification events",
  "Payment references: provider IDs (for example Razorpay payment/subscription IDs)",
  "Security and anti-fraud data: device/session identifiers, IP-derived metadata, login/restore attempts",
  "Operational logs: support requests, webhook events, and error logs"
] as const;

const usagePurposes = [
  "Create and verify membership access",
  "Process billing states and restore access requests",
  "Prevent abuse, fraud, leaks, policy evasion, and payment disputes",
  "Provide support and resolve billing or technical incidents",
  "Maintain service security and uptime"
] as const;

export default async function PrivacyPage() {
  let ageModeEnabled = true;
  try {
    const settings = await getPublicSiteSettings();
    ageModeEnabled = settings.ageModeEnabled;
  } catch {
    ageModeEnabled = true;
  }

  return (
    <LegalPageShell
      icon={ShieldCheck}
      eyebrow="Data Protection"
      title="Privacy Policy"
      summary="This policy explains what we collect, why we collect it, how we protect it, and where data may be shared for payment security and fraud prevention."
      effectiveDate="February 11, 2026"
      highlights={[
        {
          icon: Database,
          title: "Minimal data collection",
          detail: "Only the data required for access, billing verification, and support operations."
        },
        {
          icon: Lock,
          title: "Security-first operations",
          detail: "Server-side access verification and payment-linked reconciliation for protection."
        },
        {
          icon: ShieldCheck,
          title: "No personal data sale",
          detail: "Data is used for service delivery and anti-fraud controls."
        }
      ]}
      sections={[
        {
          id: "information-we-collect",
          title: "Information we collect",
          points: collectedData
        },
        {
          id: "how-we-use-your-data",
          title: "How we use your data",
          points: usagePurposes
        },
        {
          id: "payments-and-third-party-processors",
          title: "Payments and third-party processors",
          points: [
            "Payments are processed by Razorpay. We do not store full card or UPI credentials on this site.",
            "We store payment references and subscription states required for reconciliation, anti-fraud, support, and compliance."
          ]
        },
        {
          id: "data-sharing",
          title: "Data sharing",
          points: [
            "We may share necessary data with payment providers, cloud/storage vendors, and anti-fraud tooling when needed to run and protect the service.",
            "We do not sell personal data."
          ]
        },
        {
          id: "retention",
          title: "Retention",
          points: [
            "We retain records for as long as necessary for membership operations, fraud prevention, and dispute handling.",
            "Even after cancellation, limited records may be retained to prevent abuse and satisfy compliance requirements."
          ]
        },
        {
          id: "security",
          title: "Security",
          points: [
            "We use transport encryption, server-side verification, signed access, and restricted operational access controls.",
            "No system is perfectly secure; by using the service, you acknowledge residual risk inherent to internet systems."
          ]
        },
        {
          id: "your-rights",
          title: "Your rights",
          points: [
            "You may request correction of inaccurate contact data through /support.",
            "You may request account data review or deletion, subject to required retention and anti-fraud safeguards."
          ]
        },
        ...(ageModeEnabled
          ? [
              {
                id: "age-restriction",
                title: "Age restriction",
                points: [
                  "This service is strictly 18+ only.",
                  "We do not knowingly provide service to minors. If a minor account is detected, access may be terminated."
                ]
              }
            ]
          : [])
      ]}
      outro={
        <p className="text-sm text-text">
          This policy should be read together with <Link href="/terms">/terms</Link> and{" "}
          <Link href="/refund">/refund</Link>. Policy updates may be posted as service
          requirements evolve.
        </p>
      }
    />
  );
}
