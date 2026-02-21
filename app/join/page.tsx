import Image from "next/image";
import { BadgeCheck, Crown, PlayCircle, ShieldCheck, Sparkles, Star } from "lucide-react";
import { CheckoutPanel } from "@/components/marketing/checkout-panel";
import { NoGoZoneGate } from "@/components/marketing/no-go-zone-gate";
import { PageViewTracker } from "@/components/marketing/page-view-tracker";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createBlurredVideoPreviewUrl } from "@/lib/cloudinary";
import { IMAGE_BLUR_DATA_URL, MEMBERSHIP_PRICE_INR } from "@/lib/constants";
import { getPreviewContent } from "@/lib/content-service";
import { getPublicSiteSettings } from "@/lib/site-settings";

type JoinVisual = {
  imageUrl?: string;
  videoUrl?: string;
};

async function loadJoinVisual(): Promise<JoinVisual> {
  try {
    const previews = (await getPreviewContent(8)) as Array<{
      type?: "image" | "video";
      previewUrl?: string;
      mediaAssetId?: string;
    }>;

    const videoItem = previews.find((item) => item.type === "video" && item.mediaAssetId);
    if (videoItem?.mediaAssetId) {
      return {
        videoUrl: createBlurredVideoPreviewUrl(videoItem.mediaAssetId)
      };
    }

    const imageItem = previews.find((item) => item.previewUrl);
    if (imageItem?.previewUrl) {
      return {
        imageUrl: imageItem.previewUrl
      };
    }

    return {};
  } catch {
    return {};
  }
}

export default async function JoinPage() {
  const visual = await loadJoinVisual();
  let ageModeEnabled = true;
  try {
    const settings = await getPublicSiteSettings();
    ageModeEnabled = settings.ageModeEnabled;
  } catch {
    ageModeEnabled = true;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 md:space-y-10">
      <PageViewTracker path="/join" />

      <section className="grid gap-5 md:gap-7 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs tracking-[0.18em] text-accent">
            <PlayCircle className="h-3.5 w-3.5" />
            PRIVATE MEMBERSHIP
          </div>
          <h1 className="text-3xl font-semibold leading-tight md:text-5xl">
            Come inside my private feed. Instant access.
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-muted md:text-base">
            Exclusive images and short videos in a members-only feed. Secured by Razorpay at ₹
            {MEMBERSHIP_PRICE_INR}/month with instant unlock after verification.
          </p>
          <ul className="space-y-2 text-sm leading-relaxed text-muted">
            <li className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-success" /> Members-only gallery not shared on public feed
            </li>
            <li className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-success" /> Restore access anytime on any device
            </li>
            <li className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-success" /> Clear boundaries. No custom requests.
            </li>
          </ul>
          <div className="space-y-3">
            <Button asChild className="h-12 rounded-2xl px-7 text-base">
              <a href="#checkout-card">Join Membership</a>
            </Button>
            <p className="text-xs text-muted">Tap join and complete checkout in under a minute.</p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-border bg-surface/85 p-2.5 shadow-rose">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_88%_0%,rgba(230,75,140,0.2),transparent_38%)]" />
          <div className="relative overflow-hidden rounded-2xl border border-border">
            {visual.videoUrl ? (
              <video
                src={visual.videoUrl}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                className="aspect-[16/10] w-full object-cover blur-[8px] brightness-90"
              />
            ) : visual.imageUrl ? (
              <Image
                src={visual.imageUrl}
                alt="Private membership preview"
                width={1400}
                height={900}
                placeholder="blur"
                blurDataURL={IMAGE_BLUR_DATA_URL}
                className="aspect-[16/10] w-full object-cover"
              />
            ) : (
              <div className="aspect-[16/10] w-full bg-[linear-gradient(130deg,#1a2030,#0e1018_50%,#2d1324)]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-bg/85 via-transparent to-transparent" />
            <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-accent/35 bg-bg/70 px-3 py-1 text-xs text-accent">
              <PlayCircle className="h-3.5 w-3.5" />
              Sneak peek
            </div>
            <div className="absolute bottom-4 left-4 right-4 rounded-xl border border-border/75 bg-bg/75 px-3 py-2 text-sm text-muted backdrop-blur">
              Behind this door: unreleased drops and members-only surprises.
            </div>
          </div>
        </div>
      </section>

      <section id="social-proof" className="space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs text-accent">
          <Sparkles className="h-3.5 w-3.5" />
          Testimonials
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            "Joined in less than a minute and got instant access. Super smooth.",
            "The private drops feel premium and consistent. Worth it every month.",
            "Changed device and restored access quickly without support delays."
          ].map((quote) => (
            <Card key={quote} className="rounded-2xl border-border/90 bg-surface/80">
              <CardContent className="space-y-3 p-5">
                <p className="flex gap-1 text-[#F5C451]">
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                </p>
                <p className="text-sm leading-relaxed text-muted">{quote}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <Card className="rounded-2xl border-border/90 bg-surface/85">
          <CardContent className="grid gap-4 p-5 md:grid-cols-3 md:gap-5 md:p-6">
            <p className="flex items-center gap-2 text-sm text-muted">
              <ShieldCheck className="h-4 w-4 text-success" /> Secure payments via Razorpay
            </p>
            <p className="flex items-center gap-2 text-sm text-muted">
              <Crown className="h-4 w-4 text-[#F5C451]" /> VIP Area unlocks after active membership
            </p>
            <p className="flex items-center gap-2 text-sm text-muted">
              <BadgeCheck className="h-4 w-4 text-success" />{" "}
              {ageModeEnabled ? "18+ only • No custom requests" : "No custom requests"}
            </p>
          </CardContent>
        </Card>
      </section>

      <section id="checkout-card" className="join-checkout-reveal scroll-mt-24">
        <div className="grid gap-6 rounded-3xl border border-accent/25 bg-surface/80 p-5 md:grid-cols-[1fr_0.95fr] md:gap-8 md:p-7">
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-xs tracking-[0.2em] text-accent">READY TO JOIN</p>
              <h2 className="text-2xl font-semibold leading-tight md:text-3xl">Join my membership</h2>
              <p className="text-sm text-muted">
                Private feed, instant access, and member-first support for restore and billing clarity.
              </p>
            </div>

            <p className="text-3xl font-semibold text-text">₹{MEMBERSHIP_PRICE_INR}/month</p>

            <NoGoZoneGate hintClassName="max-w-md" />
          </div>

          <CheckoutPanel compact trackingPath="/join" directFlow ageModeEnabled={ageModeEnabled} />
        </div>
      </section>
    </div>
  );
}
