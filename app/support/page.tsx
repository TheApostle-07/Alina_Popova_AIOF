import { SupportForm } from "@/components/marketing/support-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SupportPage() {
  return (
    <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-[1fr_1fr]">
      <SupportForm />

      <Card>
        <CardHeader>
          <CardTitle>Quick help from my team</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted">
          <p>
            <strong>Restore access:</strong> Open Account and submit the phone/email you used at checkout.
          </p>
          <p>
            <strong>Pending payment:</strong> Wait a minute, then retry Success page or Restore Access.
          </p>
          <p>
            <strong>Cancelled membership:</strong> Start a fresh subscription from Join page to get back in.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
