import { Button } from "@/components/ui/button";
import { IntentLink } from "@/components/ui/intent-link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted">The link may be expired or moved.</p>
      <Button asChild>
        <IntentLink href="/">Go home</IntentLink>
      </Button>
    </div>
  );
}
