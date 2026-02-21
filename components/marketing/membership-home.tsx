import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck,
  CheckCircle2,
  Flame,
  Lock,
  ShieldCheck,
  Sparkles,
  Wallet
} from "lucide-react";
import { CheckoutPanel } from "@/components/marketing/checkout-panel";
import { FaqList } from "@/components/marketing/faq-list";
import { JoinPopups } from "@/components/marketing/join-popups";
import { NoGoZoneGate } from "@/components/marketing/no-go-zone-gate";
import { PageViewTracker } from "@/components/marketing/page-view-tracker";
import { PreviewGrid } from "@/components/marketing/preview-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { IntentLink } from "@/components/ui/intent-link";
import { IMAGE_BLUR_DATA_URL, MEMBERSHIP_PRICE_INR } from "@/lib/constants";
import { createBlurredVideoPreviewUrl } from "@/lib/cloudinary";
import { getPreviewContent } from "@/lib/content-service";

type PreviewItem = {
  _id: string;
  title: string;
  type: "image" | "video";
  previewUrl?: string;
  previewVideoUrl?: string;
  publishAt: string | null;
};

const upcomingDropDate = "February 20, 2026";

const unlockBullets = [
  "Full private gallery - unlock instantly after payment",
  "Private drops - content not kept on public feed",
  "Restore access anytime - re-open on any device"
] as const;

const valueCards = [
  {
    icon: Flame,
    title: "Regular private drops",
    body: "Fresh images and short videos are posted consistently."
  },
  {
    icon: Lock,
    title: "Not posted on Instagram",
    body: "Private sets stay inside membership access."
  },
  {
    icon: CheckCircle2,
    title: "Instant server-verified unlock",
    body: "Access opens right after payment verification."
  },
  {
    icon: Wallet,
    title: "Cancel anytime",
    body: "Billing controls are managed from Razorpay."
  }
] as const;

function getSafetyCards(ageModeEnabled: boolean) {
  const cards: Array<{ title: string; body: string }> = [];

  if (ageModeEnabled) {
    cards.push({
      title: "18+ only",
      body: "Age confirmation is required before entry."
    });
  }

  cards.push(
    {
      title: "No custom requests / no DMs",
      body: "This is a content membership only."
    },
    {
      title: "No redistribution",
      body: "Leaks or reposts result in permanent removal."
    }
  );

  return cards;
}

async function loadPreviewItems(): Promise<PreviewItem[]> {
  try {
    const previews = (await getPreviewContent(12)) as Array<{
      _id: unknown;
      type?: "image" | "video";
      title?: string;
      previewUrl?: string;
      mediaAssetId?: string;
      publishAt?: Date | string | null;
    }>;

    return previews
      .filter(
        (item) =>
          Boolean(item.previewUrl) ||
          (item.type === "video" && Boolean(item.mediaAssetId))
      )
      .map((item) => ({
        _id: String(item._id),
        title: item.title || "Private preview",
        type: item.type === "video" ? "video" : "image",
        previewUrl: item.previewUrl,
        previewVideoUrl:
          item.type === "video" && item.mediaAssetId
            ? createBlurredVideoPreviewUrl(item.mediaAssetId)
            : undefined,
        publishAt: item.publishAt ? new Date(item.publishAt).toISOString() : null
      }));
  } catch {
    return [];
  }
}

function formatIST(value?: string | null) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: "Asia/Kolkata"
  }).format(new Date(value));
}

export async function MembershipHome({
  path,
  previewMode = "live",
  ageModeEnabled = true
}: {
  path: string;
  previewMode?: "live" | "placeholder";
  ageModeEnabled?: boolean;
}) {
  const previewItems = previewMode === "live" ? await loadPreviewItems() : [];
  const heroPreview = previewItems[0]?.previewUrl;
  const heroPreviewVideo = previewItems[0]?.previewVideoUrl;
  const lastDropDate = formatIST(previewItems[0]?.publishAt);
  const safetyCards = getSafetyCards(ageModeEnabled);

  return (
    <div className="space-y-14 pb-10 md:space-y-20 md:pb-8">
      <PageViewTracker path={path} />
      <JoinPopups />

      <section className="grid gap-6 md:gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="space-y-5 md:space-y-6">
          <Badge className="w-fit rounded-full border-accent/40 bg-accent/10 px-3.5 py-1.5 text-[10px] tracking-[0.2em] text-accent sm:text-[11px]">
            <Sparkles className="mr-2 h-3.5 w-3.5" /> PRIVATE MEMBERSHIP
          </Badge>

          <h1 className="text-[2rem] font-semibold leading-[1.05] tracking-tight sm:text-4xl md:text-5xl">
            Come inside my private feed. <span className="text-accent">Instant access.</span>
          </h1>

          <p className="max-w-xl text-[15px] leading-relaxed text-muted md:text-lg">
            Exclusive images and short videos in a private members-only feed, not posted on
            public pages. One checkout. Immediate unlock.
          </p>

          <p className="text-[2rem] font-semibold text-text md:text-4xl">₹{MEMBERSHIP_PRICE_INR}/month</p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 rounded-2xl px-8 text-[15px] sm:h-14 sm:text-base">
              <IntentLink href="/join" data-analytics-cta="hero_unlock_membership">
                Unlock Membership - ₹{MEMBERSHIP_PRICE_INR}/month
              </IntentLink>
            </Button>
            <Button
              asChild
              variant="secondary"
              size="lg"
              className="h-12 rounded-2xl px-8 text-[15px] sm:h-14 sm:text-base"
            >
              <Link href="#what-you-get">See what you get</Link>
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted">
              {ageModeEnabled
                ? "Secured by Razorpay • Cancel anytime • 18+ only"
                : "Secured by Razorpay • Cancel anytime"}
            </p>
            <NoGoZoneGate />
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[1.35rem] border border-border bg-surface/90 p-2.5 shadow-rose sm:rounded-[1.75rem] sm:p-3">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,rgba(230,75,140,0.25),transparent_40%)]" />

          <div className="relative overflow-hidden rounded-2xl border border-border">
            {heroPreviewVideo ? (
              <video
                src={heroPreviewVideo}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                className="aspect-[4/5] w-full object-cover blur-[14px] brightness-90 saturate-125"
              />
            ) : heroPreview ? (
              <Image
                src={heroPreview}
                alt="Private membership preview"
                width={900}
                height={1200}
                sizes="(min-width: 1024px) 42vw, 100vw"
                placeholder="blur"
                blurDataURL={IMAGE_BLUR_DATA_URL}
                className="aspect-[4/5] w-full object-cover"
                priority
              />
            ) : (
              <div className="bg-theme-media-placeholder aspect-[4/5] w-full" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-bg/85 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-3 right-3 rounded-xl border border-border/80 bg-bg/75 p-2.5 backdrop-blur sm:bottom-4 sm:left-4 sm:right-4 sm:p-3">
              <p className="text-sm font-medium">Private drops unlock instantly after payment.</p>
              <p className="mt-1 text-xs text-muted">Members-only gallery with secure access.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold md:text-3xl">What you unlock</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {unlockBullets.map((item) => (
            <Card key={item} className="border-border/90 bg-surface/80">
              <CardContent className="p-5 text-sm text-muted">
                <p className="flex items-start gap-2">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span>{item}</span>
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-sm text-muted">
          {previewItems.length
            ? `Last drop: ${lastDropDate || "Recently"} • ${previewItems.length}+ private previews live`
            : `Drops start on ${upcomingDropDate} • Members will see the first drop immediately.`}
        </p>
      </section>

      <section id="preview" className="space-y-4">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold md:text-3xl">Preview before you decide</h2>
          <p className="text-sm text-muted">
            Locked previews below. Full-resolution images and videos open right after payment.
          </p>
          {!previewItems.length ? (
            <p className="text-sm text-muted">
              Drops start soon. This page is live and ready. Previews will appear here as soon as
              the first private set is posted.
            </p>
          ) : null}
        </div>
        <PreviewGrid items={previewItems} placeholderCount={9} />
      </section>

      <section id="what-you-get" className="space-y-4">
        <h2 className="text-2xl font-semibold md:text-3xl">What you get</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {valueCards.map((item) => (
            <Card key={item.title} className="border-border/90 bg-surface/80">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl border border-accent/30 bg-accent/10 p-2">
                    <item.icon className="h-4 w-4 text-accent" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-text">{item.title}</p>
                    <p className="mt-1 text-sm text-muted">{item.body}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-sm text-muted">One plan. No upsells. ₹{MEMBERSHIP_PRICE_INR}/month.</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold md:text-3xl">Trust & safety</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {safetyCards.map((item) => (
            <Card key={item.title}>
              <CardContent className="space-y-2 p-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-bg/50 px-2.5 py-1 text-xs text-muted">
                  <ShieldCheck className="h-3.5 w-3.5 text-success" /> Policy
                </div>
                <p className="text-base font-semibold text-text">{item.title}</p>
                <p className="text-sm text-muted">{item.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="faq" className="space-y-4">
        <h2 className="text-2xl font-semibold md:text-3xl">Before you pay, quick answers</h2>
        <FaqList ageModeEnabled={ageModeEnabled} />
      </section>

      <section
        id="final-cta"
        className="grid gap-5 rounded-3xl border border-accent/25 bg-surface/80 p-5 md:grid-cols-[1fr_1fr] md:gap-6 md:p-8"
      >
        <div className="space-y-5">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-accent">Final unlock</p>
            <h2 className="mt-2 text-2xl font-semibold text-text sm:text-3xl">Join my membership</h2>
            <p className="mt-2 text-sm text-muted">Tap join to continue. It takes less than a minute.</p>
          </div>

          <p className="text-3xl font-semibold text-text sm:text-4xl">₹{MEMBERSHIP_PRICE_INR}/month</p>

          <ul className="space-y-2 text-sm text-muted">
            <li className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-success" /> One plan, no upsells
            </li>
            <li className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-success" /> Restore access on any device
            </li>
          </ul>

          <p className="inline-flex items-center gap-2 text-sm text-muted">
            <ShieldCheck className="h-4 w-4 text-success" /> Secured by Razorpay • Cancel anytime
          </p>
        </div>

        <CheckoutPanel compact trackingPath={path} ageModeEnabled={ageModeEnabled} />
      </section>
    </div>
  );
}
