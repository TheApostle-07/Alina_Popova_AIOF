"use client";

import { useEffect } from "react";

const SESSION_KEY = "alina_analytics_session_id";
const SCROLL_MILESTONES = [25, 50, 75, 90] as const;
const MAX_HEATMAP_CLICKS_PER_PAGE = 30;

function getDeviceType(): "mobile" | "tablet" | "desktop" | "unknown" {
  if (typeof window === "undefined") {
    return "unknown";
  }

  const width = window.innerWidth;
  if (width < 768) {
    return "mobile";
  }
  if (width < 1024) {
    return "tablet";
  }
  return "desktop";
}

function getSessionId() {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) {
      return existing;
    }
    const next = crypto.randomUUID();
    window.sessionStorage.setItem(SESSION_KEY, next);
    return next;
  } catch {
    return crypto.randomUUID();
  }
}

function getReferrerHost() {
  if (typeof document === "undefined" || !document.referrer) {
    return "direct";
  }

  try {
    return new URL(document.referrer).hostname || "direct";
  } catch {
    return "direct";
  }
}

function getScrollDepthPercent() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return 0;
  }

  const scrollElement = document.documentElement;
  const viewportHeight = window.innerHeight || scrollElement.clientHeight || 1;
  const fullHeight = scrollElement.scrollHeight || viewportHeight;
  if (fullHeight <= viewportHeight) {
    return 100;
  }

  const current = window.scrollY + viewportHeight;
  return Math.max(0, Math.min(100, (current / fullHeight) * 100));
}

function normalizeLabel(raw: string) {
  return raw
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 _-]/g, "")
    .trim()
    .slice(0, 80);
}

export function PageViewTracker({ path }: { path: string }) {
  useEffect(() => {
    const sessionId = getSessionId();
    const device = getDeviceType();
    const referrer = getReferrerHost();
    const startedAt = Date.now();
    let destroyed = false;
    let sentExit = false;
    let clickCount = 0;
    let rafId = 0;
    let mutedUntil = 0;
    let maxDepth = getScrollDepthPercent();
    const reachedMilestones = new Set<number>();

    const postEvent = (payload: Record<string, unknown>, beacon = false) => {
      if (Date.now() < mutedUntil) {
        return;
      }

      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        mutedUntil = Date.now() + 15_000;
        return;
      }

      const body = JSON.stringify(payload);
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        const blob = new Blob([body], { type: "application/json" });
        const delivered = navigator.sendBeacon("/api/track", blob);
        if (!delivered) {
          mutedUntil = Date.now() + 15_000;
        }
        return;
      }

      if (beacon) {
        return;
      }

      void (async () => {
        try {
          await fetch("/api/track", {
            method: "POST",
            headers: {
              "content-type": "application/json"
            },
            keepalive: true,
            body
          });
        } catch {
          mutedUntil = Date.now() + 15_000;
        }
      })();
    };

    const commonPayload = {
      path,
      sessionId,
      device,
      referrer
    };

    postEvent({
      event: "page_view",
      ...commonPayload
    });

    const sendExit = () => {
      if (sentExit) {
        return;
      }
      sentExit = true;
      postEvent(
        {
          event: "page_exit",
          ...commonPayload,
          scrollDepth: Math.round(maxDepth * 10) / 10,
          dwellMs: Date.now() - startedAt
        },
        true
      );
    };

    const reportDepthIfNeeded = (depth: number) => {
      SCROLL_MILESTONES.forEach((milestone) => {
        if (depth >= milestone && !reachedMilestones.has(milestone)) {
          reachedMilestones.add(milestone);
          postEvent({
            event: "scroll_depth",
            ...commonPayload,
            scrollDepth: milestone
          });
        }
      });
    };

    reportDepthIfNeeded(maxDepth);

    const onScroll = () => {
      if (rafId) {
        return;
      }

      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        if (destroyed) {
          return;
        }
        const depth = getScrollDepthPercent();
        if (depth > maxDepth) {
          maxDepth = depth;
        }
        reportDepthIfNeeded(depth);
      });
    };

    const onClick = (event: MouseEvent) => {
      if (destroyed || event.button !== 0) {
        return;
      }

      const viewWidth = window.innerWidth || 1;
      const viewHeight = window.innerHeight || 1;
      const x = Math.max(0, Math.min(1, event.clientX / viewWidth));
      const y = Math.max(0, Math.min(1, event.clientY / viewHeight));

      if (clickCount < MAX_HEATMAP_CLICKS_PER_PAGE) {
        clickCount += 1;
        postEvent({
          event: "heatmap_click",
          ...commonPayload,
          x,
          y
        });
      }

      const target = event.target as Element | null;
      const ctaElement = target?.closest<HTMLElement>("[data-analytics-cta],button,a,[role='button']");
      if (!ctaElement) {
        return;
      }

      const explicitId = ctaElement.getAttribute("data-analytics-cta");
      const aria = ctaElement.getAttribute("aria-label");
      const text = ctaElement.textContent || "";
      const label = normalizeLabel(explicitId || aria || text);
      if (!label) {
        return;
      }

      const isCta =
        Boolean(explicitId) ||
        /(unlock|join|membership|checkout|subscribe|reactivate|restore|pay)/i.test(label);

      if (!isCta) {
        return;
      }

      postEvent({
        event: "cta_click",
        ...commonPayload,
        label,
        x,
        y
      });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        sendExit();
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("click", onClick, true);
    window.addEventListener("pagehide", sendExit);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      destroyed = true;
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("pagehide", sendExit);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      sendExit();
    };
  }, [path]);

  return null;
}
