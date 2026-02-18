"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Loader2, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { IMAGE_BLUR_DATA_URL } from "@/lib/constants";

type FeedItem = {
  _id: string;
  type: "image" | "video";
  title: string;
  tags: string[];
  mediaUrl: string;
  publishedAt: string;
};

const FEED_CACHE_KEY = "alina_feed_cache_v1";

type CachedFeed = {
  items: FeedItem[];
  nextCursor: string | null;
  savedAt: number;
};

function FeedSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="aspect-[4/5] w-full rounded-2xl" />
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="aspect-[4/5] w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export function AccessFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const persistCache = useCallback((nextItems: FeedItem[], next: string | null) => {
    try {
      const payload: CachedFeed = {
        items: nextItems,
        nextCursor: next,
        savedAt: Date.now()
      };
      sessionStorage.setItem(FEED_CACHE_KEY, JSON.stringify(payload));
    } catch {
      // Cache failures should not block feed rendering.
    }
  }, []);

  const loadFeed = useCallback(async (cursor?: string) => {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    const response = await fetch(`/api/content/feed${query}`, {
      method: "GET",
      cache: "no-store"
    });

    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "Unable to load feed");
    }

    return payload.data as {
      items: FeedItem[];
      nextCursor: string | null;
    };
  }, []);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(FEED_CACHE_KEY);
      if (!raw) {
        return;
      }

      const cached = JSON.parse(raw) as CachedFeed;
      if (!Array.isArray(cached.items) || cached.items.length === 0) {
        return;
      }

      setItems(cached.items);
      setNextCursor(cached.nextCursor || null);
      setLoading(false);
    } catch {
      // Ignore malformed cache and continue network-first fetch.
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const data = await loadFeed();
        setItems(data.items);
        setNextCursor(data.nextCursor);
        persistCache(data.items, data.nextCursor);
        setError(null);
      } catch (feedError) {
        setError(feedError instanceof Error ? feedError.message : "Feed unavailable");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadFeed, persistCache]);

  const loadMore = async () => {
    if (!nextCursor) {
      return;
    }

    try {
      setLoadingMore(true);
      const data = await loadFeed(nextCursor);
      setItems((current) => {
        const merged = [...current, ...data.items];
        persistCache(merged, data.nextCursor);
        return merged;
      });
      setNextCursor(data.nextCursor);
      setError(null);
    } catch (feedError) {
      setError(feedError instanceof Error ? feedError.message : "Could not load more");
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading && !items.length) {
    return <FeedSkeleton />;
  }

  if (error) {
    return <p className="text-danger">{error}</p>;
  }

  if (!items.length) {
    return <p className="text-muted">No drops yet. New content appears automatically.</p>;
  }

  const todaysDrop = items[0];

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-accent/40 bg-surface p-4 md:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">Today&apos;s drop</p>
        <h2 className="mt-2 text-xl font-semibold md:text-2xl">{todaysDrop.title}</h2>
        <div className="mt-4 overflow-hidden rounded-2xl border border-border">
          {todaysDrop.type === "image" ? (
            <Image
              src={todaysDrop.mediaUrl}
              alt={todaysDrop.title}
              width={1200}
              height={1500}
              sizes="(min-width: 768px) 70vw, 100vw"
              placeholder="blur"
              blurDataURL={IMAGE_BLUR_DATA_URL}
              className="aspect-[4/5] w-full object-cover"
            />
          ) : (
            <div className="aspect-[4/5] w-full bg-bg">
              <video
                controls
                playsInline
                preload="metadata"
                className="h-full w-full object-cover"
                src={todaysDrop.mediaUrl}
              />
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {items.slice(1).map((item) => (
          <article key={item._id} className="rounded-2xl border border-border bg-surface p-3">
            <div className="overflow-hidden rounded-xl border border-border">
              {item.type === "image" ? (
                <Image
                  src={item.mediaUrl}
                  alt={item.title}
                  width={900}
                  height={1200}
                  sizes="(min-width: 768px) 45vw, 100vw"
                  placeholder="blur"
                  blurDataURL={IMAGE_BLUR_DATA_URL}
                  className="aspect-[4/5] w-full object-cover"
                />
              ) : (
                <div className="relative aspect-[4/5] w-full bg-bg">
                  <video
                    controls
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-cover"
                    src={item.mediaUrl}
                  />
                  <div className="pointer-events-none absolute right-2 top-2 rounded-full bg-bg/80 p-1">
                    <PlayCircle className="h-4 w-4 text-accent" />
                  </div>
                </div>
              )}
            </div>
            <h3 className="mt-3 text-sm font-semibold">{item.title}</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {item.tags.map((tag) => (
                <Badge key={`${item._id}-${tag}`}>{tag}</Badge>
              ))}
            </div>
          </article>
        ))}
      </section>

      {nextCursor ? (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load more"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
