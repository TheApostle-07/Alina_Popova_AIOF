function getFaqItems(ageModeEnabled: boolean) {
  const base = [
  {
    q: "How quickly do I unlock your private feed?",
    a: "Usually in seconds. If redirect fails, open Account and restore access with your checkout phone or email."
  },
  {
    q: "What if my payment is pending?",
    a: "Status checks run for up to 90 seconds. If still pending, tap Check Again or use Restore Access."
  },
  {
    q: "Can I cancel whenever I want?",
    a: "Yes. Razorpay manages subscription billing and cancellation."
  },
  {
    q: "Do you offer refunds?",
    a: "Digital content membership is non-refundable. Cancel before renewal to avoid next charge. Legal exceptions are covered in Refund Policy."
  },
  {
    q: "What is included in the membership?",
    a: "Private images and short videos in a members-only feed."
  },
  {
    q: "Do you offer DMs or custom requests?",
    a: "No. This is a content membership, not a chat or custom-request service."
  },
  {
    q: "How do I access on a new phone or laptop?",
    a: "Use Restore Access on the Account page with OTP verification."
  },
  {
    q: "Is this secure?",
    a: "Yes. Payments are secured by Razorpay and access is server-verified."
  }
  ];

  if (ageModeEnabled) {
    base.push({
      q: "Any age restrictions?",
      a: "Yes. Membership is strictly 18+ only."
    });
  }

  return base;
}

export function FaqList({ ageModeEnabled = true }: { ageModeEnabled?: boolean }) {
  const faqItems = getFaqItems(ageModeEnabled);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {faqItems.map((item) => (
        <div key={item.q} className="rounded-2xl border border-border bg-surface/70 p-4">
          <p className="text-base font-semibold text-text">{item.q}</p>
          <p className="mt-1.5 text-sm text-muted">{item.a}</p>
        </div>
      ))}
    </div>
  );
}
