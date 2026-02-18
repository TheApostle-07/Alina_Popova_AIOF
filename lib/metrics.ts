import { connectToDatabase } from "@/lib/db";
import {
  getCountryFallbackCoordinates,
  getCountryName,
  getIndiaRegionInfo
} from "@/lib/geo";
import { AnalyticsEventModel } from "@/lib/models/analytics-event";
import { MetricsDailyModel } from "@/lib/models/metrics-daily";
import { SubscriptionModel } from "@/lib/models/subscription";
import { getDateKey } from "@/lib/utils";

export type TrackEventName =
  | "page_view"
  | "checkout_start"
  | "checkout_success"
  | "cta_click"
  | "heatmap_click"
  | "scroll_depth"
  | "page_exit"
  | "restore_request"
  | "restore_success";

export type TrackEventInput = {
  event: TrackEventName;
  path?: string;
  sessionId?: string;
  referrer?: string;
  device?: "mobile" | "tablet" | "desktop" | "unknown";
  x?: number;
  y?: number;
  scrollDepth?: number;
  dwellMs?: number;
  label?: string;
  countryCode?: string;
  country?: string;
  regionCode?: string;
  region?: string;
  city?: string;
  lat?: number;
  lng?: number;
};

type PathCounters = {
  path: string;
  visits: number;
  ctaClicks: number;
  checkoutStarts: number;
  successfulSubs: number;
  ctaRate: number;
  startRate: number;
  successRate: number;
};

type RealtimeBucket = {
  minute: string;
  label: string;
  visits: number;
  ctaClicks: number;
  checkoutStarts: number;
  successfulSubs: number;
};

const MARKETING_PATHS = ["/", "/join", "/membership"] as const;
const HEATMAP_COLUMNS = 12;
const HEATMAP_ROWS = 18;
const MAX_HEATMAP_EVENTS = 8000;
const REALTIME_MINUTES = 60;

function sanitizePath(path?: string) {
  if (!path || !path.trim()) {
    return "/";
  }

  const clean = path.trim().slice(0, 200);
  return clean.startsWith("/") ? clean : `/${clean}`;
}

function round(value: number, digits = 1) {
  const base = 10 ** digits;
  return Math.round(value * base) / base;
}

function percentage(part: number, total: number, digits = 1) {
  if (!total) {
    return 0;
  }
  return round((part / total) * 100, digits);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function minuteKey(date: Date) {
  return date.toISOString().slice(0, 16);
}

function buildRealtimeBuckets() {
  const end = new Date();
  end.setSeconds(0, 0);

  const buckets: RealtimeBucket[] = [];
  for (let index = REALTIME_MINUTES - 1; index >= 0; index -= 1) {
    const point = new Date(end.getTime() - index * 60_000);
    const minute = minuteKey(point);
    buckets.push({
      minute,
      label: minute.slice(11),
      visits: 0,
      ctaClicks: 0,
      checkoutStarts: 0,
      successfulSubs: 0
    });
  }
  return buckets;
}

export async function trackEvent(input: TrackEventInput) {
  await connectToDatabase();

  const now = new Date();
  const date = getDateKey(now);
  const event = input.event;

  const inc: Record<string, number> = {};
  if (event === "page_view") {
    inc.visits = 1;
  }
  if (event === "cta_click") {
    inc.ctaClicks = 1;
  }
  if (event === "checkout_start") {
    inc.checkoutStarts = 1;
  }
  if (event === "checkout_success") {
    inc.successfulSubs = 1;
  }

  const writes: Array<Promise<unknown>> = [];
  if (Object.keys(inc).length > 0) {
    writes.push(
      MetricsDailyModel.updateOne(
        { date },
        {
          $setOnInsert: {
            date
          },
          $inc: inc
        },
        { upsert: true }
      )
    );
  }

  writes.push(
    AnalyticsEventModel.create({
      event,
      path: sanitizePath(input.path),
      sessionId: input.sessionId?.slice(0, 80),
      referrer: input.referrer?.slice(0, 140),
      countryCode: input.countryCode?.slice(0, 5),
      country: input.country?.slice(0, 80),
      regionCode: input.regionCode?.slice(0, 12),
      region: input.region?.slice(0, 120),
      city: input.city?.slice(0, 120),
      lat: typeof input.lat === "number" ? clamp(input.lat, -90, 90) : undefined,
      lng: typeof input.lng === "number" ? clamp(input.lng, -180, 180) : undefined,
      device: input.device || "unknown",
      x: typeof input.x === "number" ? clamp(input.x, 0, 1) : undefined,
      y: typeof input.y === "number" ? clamp(input.y, 0, 1) : undefined,
      scrollDepth:
        typeof input.scrollDepth === "number" ? clamp(input.scrollDepth, 0, 100) : undefined,
      dwellMs: typeof input.dwellMs === "number" ? Math.max(0, Math.floor(input.dwellMs)) : undefined,
      label: input.label?.slice(0, 120),
      date,
      createdAt: now
    })
  );

  await Promise.all(writes);
}

export async function updateActiveMembersMetric() {
  await connectToDatabase();
  const count = await SubscriptionModel.countDocuments({ status: "ACTIVE" });
  const date = getDateKey();

  await MetricsDailyModel.updateOne(
    { date },
    {
      $setOnInsert: {
        date
      },
      $set: {
        activeMembers: count
      }
    },
    { upsert: true }
  );

  return count;
}

export async function getMetricsSummary(days = 30) {
  await connectToDatabase();

  const now = new Date();
  const since = new Date(now);
  since.setDate(since.getDate() - days);
  const dateKey = getDateKey(since);

  const realtimeSince = new Date(now.getTime() - REALTIME_MINUTES * 60_000);
  const fiveMinuteSince = new Date(now.getTime() - 5 * 60_000);

  const [series, activeMembers, churnProxy] = await Promise.all([
    MetricsDailyModel.find({ date: { $gte: dateKey } })
      .sort({ date: 1 })
      .lean(),
    updateActiveMembersMetric(),
    SubscriptionModel.countDocuments({
      status: { $in: ["CANCELLED", "EXPIRED"] },
      updatedAt: { $gte: since }
    })
  ]);

  const aggregate = series.reduce(
    (acc, day) => {
      acc.visits += day.visits || 0;
      acc.ctaClicks += day.ctaClicks || 0;
      acc.checkoutStarts += day.checkoutStarts || 0;
      acc.successfulSubs += day.successfulSubs || 0;
      return acc;
    },
    { visits: 0, ctaClicks: 0, checkoutStarts: 0, successfulSubs: 0 }
  );

  const [
    uniqueSessions,
    topReferrersRaw,
    deviceSplitRaw,
    ctaPerformanceRaw,
    pathCountsRaw,
    sessionRollupRaw,
    heatmapEvents,
    restoreRequests,
    restoreSuccesses,
    countryBreakdownRaw,
    indiaRegionRaw,
    realtimeRaw,
    lastEvent,
    activeNowSessions
  ] = await Promise.all([
    AnalyticsEventModel.distinct("sessionId", {
      event: "page_view",
      createdAt: { $gte: since },
      sessionId: { $exists: true, $ne: "" }
    }),
    AnalyticsEventModel.aggregate([
      {
        $match: {
          event: "page_view",
          createdAt: { $gte: since },
          referrer: { $exists: true, $nin: ["", "direct", "unknown"] }
        }
      },
      { $group: { _id: "$referrer", visits: { $sum: 1 } } },
      { $sort: { visits: -1 } },
      { $limit: 6 }
    ]),
    AnalyticsEventModel.aggregate([
      { $match: { event: "page_view", createdAt: { $gte: since } } },
      { $group: { _id: "$device", visits: { $sum: 1 } } },
      { $sort: { visits: -1 } }
    ]),
    AnalyticsEventModel.aggregate([
      {
        $match: {
          event: "cta_click",
          createdAt: { $gte: since },
          label: { $exists: true, $ne: "" }
        }
      },
      { $group: { _id: "$label", clicks: { $sum: 1 } } },
      { $sort: { clicks: -1 } },
      { $limit: 8 }
    ]),
    AnalyticsEventModel.aggregate([
      {
        $match: {
          createdAt: { $gte: since },
          event: { $in: ["page_view", "cta_click", "checkout_start", "checkout_success"] },
          path: { $exists: true, $ne: "" }
        }
      },
      {
        $group: {
          _id: { path: "$path", event: "$event" },
          count: { $sum: 1 }
        }
      }
    ]),
    AnalyticsEventModel.aggregate([
      {
        $match: {
          createdAt: { $gte: since },
          sessionId: { $exists: true, $ne: "" },
          event: { $in: ["page_exit", "scroll_depth"] }
        }
      },
      {
        $group: {
          _id: "$sessionId",
          maxDwellMs: { $max: { $ifNull: ["$dwellMs", 0] } },
          maxScrollDepth: { $max: { $ifNull: ["$scrollDepth", 0] } }
        }
      },
      {
        $group: {
          _id: null,
          sessions: { $sum: 1 },
          avgDwellMs: { $avg: "$maxDwellMs" },
          avgScrollDepth: { $avg: "$maxScrollDepth" },
          engaged: {
            $sum: {
              $cond: [
                { $or: [{ $gte: ["$maxDwellMs", 45_000] }, { $gte: ["$maxScrollDepth", 60] }] },
                1,
                0
              ]
            }
          }
        }
      }
    ]),
    AnalyticsEventModel.find({
      createdAt: { $gte: since },
      event: "heatmap_click",
      path: { $in: [...MARKETING_PATHS] },
      x: { $gte: 0, $lte: 1 },
      y: { $gte: 0, $lte: 1 }
    })
      .select({ path: 1, x: 1, y: 1 })
      .sort({ createdAt: -1 })
      .limit(MAX_HEATMAP_EVENTS)
      .lean(),
    AnalyticsEventModel.countDocuments({
      event: "restore_request",
      createdAt: { $gte: since }
    }),
    AnalyticsEventModel.countDocuments({
      event: "restore_success",
      createdAt: { $gte: since }
    }),
    AnalyticsEventModel.aggregate([
      {
        $match: {
          event: "page_view",
          createdAt: { $gte: since },
          countryCode: { $exists: true, $nin: ["", "unknown", "XX"] }
        }
      },
      {
        $group: {
          _id: { countryCode: "$countryCode", country: "$country" },
          visits: { $sum: 1 },
          lat: { $avg: "$lat" },
          lng: { $avg: "$lng" }
        }
      },
      { $sort: { visits: -1 } },
      { $limit: 24 }
    ]),
    AnalyticsEventModel.aggregate([
      {
        $match: {
          event: "page_view",
          createdAt: { $gte: since },
          countryCode: "IN",
          regionCode: { $exists: true, $nin: ["", "unknown"] }
        }
      },
      {
        $group: {
          _id: { regionCode: "$regionCode", region: "$region" },
          visits: { $sum: 1 },
          lat: { $avg: "$lat" },
          lng: { $avg: "$lng" }
        }
      },
      { $sort: { visits: -1 } },
      { $limit: 28 }
    ]),
    AnalyticsEventModel.aggregate([
      {
        $match: {
          createdAt: { $gte: realtimeSince },
          event: { $in: ["page_view", "cta_click", "checkout_start", "checkout_success"] }
        }
      },
      {
        $group: {
          _id: {
            minute: {
              $dateToString: {
                format: "%Y-%m-%dT%H:%M",
                date: "$createdAt",
                timezone: "UTC"
              }
            },
            event: "$event"
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.minute": 1 } }
    ]),
    AnalyticsEventModel.findOne({})
      .sort({ createdAt: -1 })
      .select({ createdAt: 1 })
      .lean(),
    AnalyticsEventModel.distinct("sessionId", {
      createdAt: { $gte: fiveMinuteSince },
      sessionId: { $exists: true, $ne: "" }
    })
  ]);

  const uniqueVisitors = uniqueSessions.length;

  const sessionRollup = sessionRollupRaw[0] || {
    sessions: 0,
    avgDwellMs: 0,
    avgScrollDepth: 0,
    engaged: 0
  };

  const pathCounterMap = new Map<string, PathCounters>();
  const ensurePathCounter = (path: string) => {
    if (!pathCounterMap.has(path)) {
      pathCounterMap.set(path, {
        path,
        visits: 0,
        ctaClicks: 0,
        checkoutStarts: 0,
        successfulSubs: 0,
        ctaRate: 0,
        startRate: 0,
        successRate: 0
      });
    }
    return pathCounterMap.get(path)!;
  };

  pathCountsRaw.forEach((row) => {
    const path = sanitizePath(row._id?.path);
    const event = row._id?.event as TrackEventName | undefined;
    const counter = ensurePathCounter(path);

    if (event === "page_view") {
      counter.visits = row.count;
    }
    if (event === "cta_click") {
      counter.ctaClicks = row.count;
    }
    if (event === "checkout_start") {
      counter.checkoutStarts = row.count;
    }
    if (event === "checkout_success") {
      counter.successfulSubs = row.count;
    }
  });

  MARKETING_PATHS.forEach((path) => ensurePathCounter(path));

  const pathPerformance = Array.from(pathCounterMap.values())
    .map((row) => ({
      ...row,
      ctaRate: percentage(row.ctaClicks, row.visits),
      startRate: percentage(row.checkoutStarts, row.visits),
      successRate: percentage(row.successfulSubs, row.checkoutStarts)
    }))
    .sort((a, b) => b.visits - a.visits);

  const heatmapByPath = new Map<
    string,
    {
      path: string;
      totalClicks: number;
      maxCount: number;
      cells: Array<{ x: number; y: number; count: number; intensity: number }>;
    }
  >();

  heatmapEvents.forEach((item) => {
    const path = sanitizePath(item.path);
    const x = typeof item.x === "number" ? clamp(item.x, 0, 0.999999) : 0;
    const y = typeof item.y === "number" ? clamp(item.y, 0, 0.999999) : 0;

    const col = Math.floor(x * HEATMAP_COLUMNS);
    const row = Math.floor(y * HEATMAP_ROWS);
    const key = `${col}:${row}`;

    if (!heatmapByPath.has(path)) {
      heatmapByPath.set(path, {
        path,
        totalClicks: 0,
        maxCount: 0,
        cells: []
      });
    }

    const pathMap = heatmapByPath.get(path)!;
    pathMap.totalClicks += 1;

    const existing = pathMap.cells.find((cell) => `${cell.x}:${cell.y}` === key);
    if (existing) {
      existing.count += 1;
      pathMap.maxCount = Math.max(pathMap.maxCount, existing.count);
      return;
    }

    pathMap.cells.push({
      x: col,
      y: row,
      count: 1,
      intensity: 0
    });
    pathMap.maxCount = Math.max(pathMap.maxCount, 1);
  });

  const heatmap = [...heatmapByPath.values()]
    .map((pathMap) => ({
      path: pathMap.path,
      totalClicks: pathMap.totalClicks,
      maxCount: pathMap.maxCount,
      cells: pathMap.cells.map((cell) => ({
        ...cell,
        intensity: pathMap.maxCount ? round(cell.count / pathMap.maxCount, 3) : 0
      }))
    }))
    .sort((a, b) => b.totalClicks - a.totalClicks);

  const topReferrers = topReferrersRaw.map((item) => ({
    source: item._id || "direct",
    visits: item.visits
  }));

  const deviceSplit = deviceSplitRaw.map((item) => ({
    device: item._id || "unknown",
    visits: item.visits,
    share: percentage(item.visits, aggregate.visits || 1)
  }));

  const topCtas = ctaPerformanceRaw.map((item) => ({
    label: item._id,
    clicks: item.clicks
  }));

  const countries = countryBreakdownRaw
    .map((row) => {
      const countryCode = String(row._id?.countryCode || "").toUpperCase();
      if (!countryCode) {
        return null;
      }
      const fallback = getCountryFallbackCoordinates(countryCode);
      const lat = typeof row.lat === "number" ? row.lat : fallback?.lat;
      const lng = typeof row.lng === "number" ? row.lng : fallback?.lng;
      const country = String(row._id?.country || getCountryName(countryCode) || countryCode);
      return {
        countryCode,
        country,
        visits: row.visits,
        share: percentage(row.visits, aggregate.visits || 1),
        lat: typeof lat === "number" ? round(lat, 4) : null,
        lng: typeof lng === "number" ? round(lng, 4) : null
      };
    })
    .filter(Boolean)
    .sort((a, b) => b!.visits - a!.visits) as Array<{
    countryCode: string;
    country: string;
    visits: number;
    share: number;
    lat: number | null;
    lng: number | null;
  }>;

  const indiaRegions = indiaRegionRaw
    .map((row) => {
      const regionCode = String(row._id?.regionCode || "").toUpperCase();
      if (!regionCode) {
        return null;
      }
      const indiaInfo = getIndiaRegionInfo(regionCode);
      const lat = typeof row.lat === "number" ? row.lat : indiaInfo?.lat;
      const lng = typeof row.lng === "number" ? row.lng : indiaInfo?.lng;
      const region = String(row._id?.region || indiaInfo?.name || regionCode);
      return {
        regionCode,
        region,
        visits: row.visits,
        share: percentage(row.visits, aggregate.visits || 1),
        lat: typeof lat === "number" ? round(lat, 4) : null,
        lng: typeof lng === "number" ? round(lng, 4) : null
      };
    })
    .filter(Boolean)
    .sort((a, b) => b!.visits - a!.visits) as Array<{
    regionCode: string;
    region: string;
    visits: number;
    share: number;
    lat: number | null;
    lng: number | null;
  }>;

  const realtimeBuckets = buildRealtimeBuckets();
  const realtimeMap = new Map<string, RealtimeBucket>();
  realtimeBuckets.forEach((bucket) => {
    realtimeMap.set(bucket.minute, bucket);
  });

  realtimeRaw.forEach((row) => {
    const minute = String(row._id?.minute || "");
    const event = row._id?.event as TrackEventName | undefined;
    const bucket = realtimeMap.get(minute);
    if (!bucket || !event) {
      return;
    }
    if (event === "page_view") {
      bucket.visits += row.count;
    }
    if (event === "cta_click") {
      bucket.ctaClicks += row.count;
    }
    if (event === "checkout_start") {
      bucket.checkoutStarts += row.count;
    }
    if (event === "checkout_success") {
      bucket.successfulSubs += row.count;
    }
  });

  const lastFiveBuckets = realtimeBuckets.slice(-5);
  const lastFiveTotals = lastFiveBuckets.reduce(
    (acc, row) => {
      acc.visits += row.visits;
      acc.ctaClicks += row.ctaClicks;
      acc.checkoutStarts += row.checkoutStarts;
      acc.successfulSubs += row.successfulSubs;
      return acc;
    },
    { visits: 0, ctaClicks: 0, checkoutStarts: 0, successfulSubs: 0 }
  );

  const lastSixtyTotals = realtimeBuckets.reduce(
    (acc, row) => {
      acc.visits += row.visits;
      acc.ctaClicks += row.ctaClicks;
      acc.checkoutStarts += row.checkoutStarts;
      acc.successfulSubs += row.successfulSubs;
      return acc;
    },
    { visits: 0, ctaClicks: 0, checkoutStarts: 0, successfulSubs: 0 }
  );

  const latestEventAt =
    !Array.isArray(lastEvent) && lastEvent?.createdAt
      ? new Date(lastEvent.createdAt).toISOString()
      : null;

  return {
    aggregate,
    activeMembers,
    churnProxy,
    series,
    funnel: {
      visits: aggregate.visits,
      ctaClicks: aggregate.ctaClicks,
      checkoutStarts: aggregate.checkoutStarts,
      successfulSubs: aggregate.successfulSubs,
      visitToCtaRate: percentage(aggregate.ctaClicks, aggregate.visits),
      ctaToCheckoutRate: percentage(aggregate.checkoutStarts, aggregate.ctaClicks),
      checkoutToPaidRate: percentage(aggregate.successfulSubs, aggregate.checkoutStarts),
      overallConversionRate: percentage(aggregate.successfulSubs, aggregate.visits)
    },
    traffic: {
      uniqueVisitors,
      avgSessionSeconds: Math.round((sessionRollup.avgDwellMs || 0) / 1000),
      avgScrollDepth: round(sessionRollup.avgScrollDepth || 0, 1),
      engagedSessionRate: percentage(sessionRollup.engaged || 0, sessionRollup.sessions || 0),
      topReferrers,
      deviceSplit
    },
    restore: {
      requests: restoreRequests,
      successes: restoreSuccesses,
      successRate: percentage(restoreSuccesses, restoreRequests)
    },
    topCtas,
    pathPerformance,
    heatmap: {
      columns: HEATMAP_COLUMNS,
      rows: HEATMAP_ROWS,
      paths: heatmap
    },
    geography: {
      countries,
      indiaRegions,
      worldMapPoints: countries
        .filter((item) => typeof item.lat === "number" && typeof item.lng === "number")
        .map((item) => ({
          key: item.countryCode,
          label: item.country,
          visits: item.visits,
          share: item.share,
          lat: item.lat as number,
          lng: item.lng as number
        })),
      indiaMapPoints: indiaRegions
        .filter((item) => typeof item.lat === "number" && typeof item.lng === "number")
        .map((item) => ({
          key: item.regionCode,
          label: item.region,
          visits: item.visits,
          share: item.share,
          lat: item.lat as number,
          lng: item.lng as number
        }))
    },
    realtime: {
      updatedAt: now.toISOString(),
      lastEventAt: latestEventAt,
      activeNowSessions: activeNowSessions.length,
      last5Minutes: lastFiveTotals,
      last60Minutes: lastSixtyTotals,
      perMinute: realtimeBuckets
    }
  };
}
