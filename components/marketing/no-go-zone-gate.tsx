"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Crown, Lock, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NoGoZoneGateProps = {
  className?: string;
  hintClassName?: string;
  showHint?: boolean;
};

export function NoGoZoneGate({ className, hintClassName, showHint = true }: NoGoZoneGateProps) {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  const openNoGoZone = async () => {
    try {
      setChecking(true);
      const response = await fetch("/api/membership/access-check", {
        method: "GET",
        cache: "no-store"
      });
      const payload = await response.json();
      const active = Boolean(response.ok && payload?.ok && payload?.data?.active);

      if (active) {
        router.push("/no-go-zone");
        return;
      }

      setOpen(true);
    } catch {
      setOpen(true);
    } finally {
      setChecking(false);
    }
  };

  return (
    <>
      <div className={cn("space-y-2", className)}>
        <Button
          variant="secondary"
          onClick={openNoGoZone}
          disabled={checking}
          data-analytics-cta="no_go_zone_gate"
          className="group h-11 w-full rounded-2xl border-[#E6B93D]/55 bg-[linear-gradient(135deg,rgba(230,185,61,0.2),rgba(230,75,140,0.08))] text-[#F5C451] hover:border-[#FFD77A] hover:bg-[linear-gradient(135deg,#FFD77A,#E6B93D)] hover:text-[#2D2006] sm:w-auto"
        >
          {checking ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking access...
            </>
          ) : (
            <>
              <Crown className="mr-2 h-4 w-4 text-[#F5C451] transition-colors group-hover:text-[#7A4A00]" /> VIP Area
            </>
          )}
        </Button>
        {showHint ? (
          <p className={cn("text-xs text-muted", hintClassName)}>
            Behind this door: unreleased drops and members-only surprises.
          </p>
        ) : null}
      </div>

      {open ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-bg/80 p-4 backdrop-blur sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="no-go-zone-title"
            className="relative w-full max-w-md rounded-3xl border border-border bg-surface p-5 shadow-rose sm:p-6"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-click-fx absolute right-3 top-3 rounded-lg border border-border p-1.5 text-muted transition-[transform,color,border-color] duration-200 hover:text-text"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E6B93D]/40 bg-[#E6B93D]/10 px-3 py-1 text-xs font-medium text-[#F5C451]">
                <Crown className="h-3.5 w-3.5" /> VIP Area
              </div>
              <div className="space-y-2">
                <h3 id="no-go-zone-title" className="text-xl font-semibold">
                  VIP Area unlocks for active members
                </h3>
                <p className="text-sm text-muted">
                  Unreleased drops and surprise collections are waiting inside. Unlock membership or
                  restore paid access to continue.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  className="h-11 rounded-2xl"
                  data-analytics-cta="restricted_unlock_membership"
                  onClick={() => {
                    setOpen(false);
                    router.push("/join");
                  }}
                >
                  <Lock className="mr-2 h-4 w-4" /> Unlock membership
                </Button>
                <Button
                  variant="secondary"
                  className="h-11 rounded-2xl"
                  data-analytics-cta="restricted_restore_access"
                  onClick={() => {
                    setOpen(false);
                    router.push("/account");
                  }}
                >
                  Restore access
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
