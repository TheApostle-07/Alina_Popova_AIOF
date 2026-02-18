import Image from "next/image";
import { Lock } from "lucide-react";
import { IMAGE_BLUR_DATA_URL } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { IntentLink } from "@/components/ui/intent-link";

type PreviewItem = {
  _id: string;
  title: string;
  previewUrl?: string;
  previewVideoUrl?: string;
};

export function PreviewGrid({
  items,
  placeholderCount = 9
}: {
  items: PreviewItem[];
  placeholderCount?: number;
}) {
  const cards = items.length
    ? items.slice(0, 12)
    : Array.from({ length: placeholderCount }).map((_, index) => ({
        _id: `placeholder-${index}`,
        title: "Private preview",
        previewUrl: undefined,
        previewVideoUrl: undefined
      }));

  return (
    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-3">
      {cards.map((item) => (
        <div
          key={item._id}
          className="group relative overflow-hidden rounded-2xl border border-border bg-surface"
        >
          {item.previewVideoUrl ? (
            <video
              src={item.previewVideoUrl}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster={item.previewUrl}
              className="aspect-[4/5] w-full scale-[1.02] object-cover blur-[12px] brightness-90 saturate-125 transition duration-500 group-hover:scale-110"
            />
          ) : item.previewUrl ? (
            <Image
              src={item.previewUrl}
              alt={item.title}
              width={600}
              height={800}
              sizes="(min-width: 768px) 33vw, 50vw"
              placeholder="blur"
              blurDataURL={IMAGE_BLUR_DATA_URL}
              className="aspect-[4/5] w-full scale-[1.02] object-cover blur-[1.5px] transition duration-500 group-hover:scale-110"
              loading="lazy"
            />
          ) : (
            <div className="bg-theme-media-placeholder aspect-[4/5] w-full" />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-bg/85 via-bg/10 to-transparent" />

          <div className="absolute inset-x-0 top-2.5 flex justify-center sm:top-3">
            <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-bg/80 px-2 py-1 text-[10px] font-medium text-text backdrop-blur sm:px-2.5 sm:text-[11px]">
              <Lock className="h-3 w-3 text-accent" /> Locked Preview
            </span>
          </div>

          <div className="absolute inset-x-2.5 bottom-2.5 space-y-2 rounded-xl border border-border/70 bg-bg/75 px-2.5 py-2.5 backdrop-blur sm:inset-x-3 sm:bottom-3 sm:px-3 sm:py-2">
            <p className="truncate text-[11px] leading-relaxed text-muted sm:text-xs">{item.title}</p>
            <Button asChild className="h-10 w-full rounded-xl px-3 text-sm font-semibold leading-none sm:h-9">
              <IntentLink href="/join" data-analytics-cta="preview_unlock">
                Unlock
              </IntentLink>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
