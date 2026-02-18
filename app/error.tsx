"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { IntentLink } from "@/components/ui/intent-link";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 text-center">
      <h2 className="text-2xl font-semibold">Something went wrong</h2>
      <p className="text-sm text-muted">Please retry. If the issue persists, contact support.</p>
      <div className="flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="secondary">
          <IntentLink href="/support">Support</IntentLink>
        </Button>
      </div>
    </div>
  );
}
