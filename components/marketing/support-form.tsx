"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function SupportForm() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [topic, setTopic] = useState("Restore access");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    try {
      setBusy(true);
      const response = await fetch("/api/support", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ email: email || undefined, phone: phone || undefined, topic, message })
      });

      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Unable to submit support request");
      }

      toast.success("Support request sent");
      setMessage("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Support request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Need help with my membership?</CardTitle>
        <CardDescription>Send the issue to my support team and we&apos;ll respond quickly.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="support-email">Email</Label>
          <Input
            id="support-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="support-phone">Phone</Label>
          <Input
            id="support-phone"
            type="tel"
            placeholder="+91 98xxxxxx"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="support-topic">Topic</Label>
          <Input
            id="support-topic"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="Restore access / Billing / Other"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="support-message">Message</Label>
          <Textarea
            id="support-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Tell us what happened and include your checkout phone/email."
          />
        </div>
        <Button onClick={submit} disabled={busy || !topic || message.length < 10}>
          {busy ? "Sending..." : "Submit request"}
        </Button>
      </CardContent>
    </Card>
  );
}
