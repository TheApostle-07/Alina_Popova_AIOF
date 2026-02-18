import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveMemberPage } from "@/lib/auth/guards";
import { getEnv } from "@/lib/env";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const runtime = "nodejs";

export default async function NoGoZonePage() {
  await requireActiveMemberPage();

  const targetUrl = getEnv().NO_GO_ZONE_URL;
  if (targetUrl) {
    redirect(targetUrl);
  }

  return (
    <div className="mx-auto max-w-xl py-10">
      <Card>
        <CardHeader>
          <CardTitle>VIP Area is not configured</CardTitle>
          <CardDescription>
            Set <code>NO_GO_ZONE_URL</code> in environment variables to enable this members-only
            destination.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted">
            This route is protected and available only for active paid members.
          </p>
          <Button asChild>
            <Link href="/access">Back to private feed</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
