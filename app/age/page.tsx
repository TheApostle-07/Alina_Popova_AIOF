"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CircleAlert } from "lucide-react";
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
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Age confirmation</CardTitle>
          <CardDescription>
            I share this membership content only with users who are 18 years or older.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button className="w-full" size="lg" onClick={accept}>
            I am 18+ and continue
          </Button>
          <Button className="w-full" variant="secondary" size="lg" onClick={reject}>
            I am under 18
          </Button>
          {declined ? (
            <p className="flex items-start gap-2 text-sm text-warning">
              <CircleAlert className="mt-0.5 h-4 w-4" />
              Access is blocked. Please return when you are 18+.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
