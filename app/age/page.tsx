"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, CircleAlert, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AGE_COOKIE_NAME, AGE_DECLINED_COOKIE_NAME } from "@/lib/constants";

function setCookie(name: string, value: string, maxAge: number) {
  document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; samesite=lax`;
}

export default function AgeGatePage() {
  const params = useSearchParams();
  const router = useRouter();
  const [declined, setDeclined] = useState(false);

  const nextPath = useMemo(() => params.get("next") || "/", [params]);

  useEffect(() => {
    if (document.cookie.includes(`${AGE_DECLINED_COOKIE_NAME}=1`)) {
      setDeclined(true);
    }
  }, []);

  const accept = () => {
    localStorage.setItem("alina_age_verified", "1");
    setCookie(AGE_COOKIE_NAME, "1", 60 * 60 * 24 * 365);
    setCookie(AGE_DECLINED_COOKIE_NAME, "", 0);
    router.replace(nextPath);
  };

  const reject = () => {
    localStorage.removeItem("alina_age_verified");
    setCookie(AGE_DECLINED_COOKIE_NAME, "1", 60 * 60 * 24 * 30);
    setDeclined(true);
  };

  return (
    <div className="relative mx-auto flex min-h-[78vh] w-full max-w-3xl items-center justify-center py-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[8%] top-[10%] h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute bottom-[8%] right-[6%] h-44 w-44 rounded-full bg-secondaryAccent/20 blur-3xl" />
      </div>

      <Card className="w-full overflow-hidden border-border/90 bg-[linear-gradient(145deg,rgba(255,255,255,0.02),rgba(255,255,255,0.0))] shadow-[0_30px_80px_-40px_rgba(230,75,140,0.65)]">
        <CardHeader className="space-y-5 p-6 sm:p-8">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-accent/35 bg-accent/10 px-3 py-1 text-xs font-medium tracking-[0.08em] text-accent">
            <ShieldCheck className="h-3.5 w-3.5" />
            Member Safety Gate
          </div>

          <div className="space-y-2">
            <CardTitle className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Age confirmation
            </CardTitle>
            <CardDescription className="max-w-2xl text-base leading-relaxed sm:text-lg">
              This private membership is shared only with adults. Please confirm you are 18 or older
              to continue.
            </CardDescription>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-border/80 bg-bg/55 px-3 py-2 text-xs text-muted">
              <Sparkles className="mr-1.5 inline h-3.5 w-3.5 text-accent" />
              Private members-only experience
            </div>
            <div className="rounded-xl border border-border/80 bg-bg/55 px-3 py-2 text-xs text-muted">
              <ShieldCheck className="mr-1.5 inline h-3.5 w-3.5 text-success" />
              Clear rules and safe boundaries
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 p-6 pt-0 sm:p-8 sm:pt-0">
          <Button className="h-14 w-full rounded-2xl text-lg font-semibold" size="lg" onClick={accept}>
            I am 18+ and continue
            <ChevronRight className="ml-2 h-5 w-5" />
          </Button>

          <Button
            className="h-14 w-full rounded-2xl text-lg font-semibold"
            variant="secondary"
            size="lg"
            onClick={reject}
          >
            I am under 18
          </Button>

          <p className="pt-1 text-xs text-muted">
            You can leave now and return when eligible.
          </p>

          {declined ? (
            <div className="flex items-start gap-2 rounded-xl border border-warning/35 bg-warning/10 px-3 py-2 text-sm text-warning">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              Access is blocked. Please return when you are 18+.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
