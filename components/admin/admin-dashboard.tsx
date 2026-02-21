"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  Check,
  ChevronDown,
  FolderKanban,
  Globe2,
  Loader2,
  LogOut,
  MapPin,
  MousePointerClick,
  RefreshCw,
  Search,
  Trash2,
  TrendingUp,
  Upload,
  Users
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
};

type MetricData = {
  aggregate: {
    visits: number;
    ctaClicks: number;
    checkoutStarts: number;
    successfulSubs: number;
  };
  activeMembers: number;
  churnProxy: number;
  series: Array<{
    date: string;
    visits: number;
    ctaClicks?: number;
    checkoutStarts: number;
    successfulSubs: number;
    activeMembers: number;
  }>;
  funnel: {
    visits: number;
    ctaClicks: number;
    checkoutStarts: number;
    successfulSubs: number;
    visitToCtaRate: number;
    ctaToCheckoutRate: number;
    checkoutToPaidRate: number;
    overallConversionRate: number;
  };
  traffic: {
    uniqueVisitors: number;
    avgSessionSeconds: number;
    avgScrollDepth: number;
    engagedSessionRate: number;
    topReferrers: Array<{ source: string; visits: number }>;
    deviceSplit: Array<{ device: string; visits: number; share: number }>;
  };
  restore: {
    requests: number;
    successes: number;
    successRate: number;
  };
  topCtas: Array<{ label: string; clicks: number }>;
  pathPerformance: Array<{
    path: string;
    visits: number;
    ctaClicks: number;
    checkoutStarts: number;
    successfulSubs: number;
    ctaRate: number;
    startRate: number;
    successRate: number;
  }>;
  heatmap: {
    columns: number;
    rows: number;
    paths: Array<{
      path: string;
      totalClicks: number;
      maxCount: number;
      cells: Array<{ x: number; y: number; count: number; intensity: number }>;
    }>;
  };
  geography: {
    countries: Array<{
      countryCode: string;
      country: string;
      visits: number;
      share: number;
      lat: number | null;
      lng: number | null;
    }>;
    indiaRegions: Array<{
      regionCode: string;
      region: string;
      visits: number;
      share: number;
      lat: number | null;
      lng: number | null;
    }>;
    worldMapPoints: Array<{
      key: string;
      label: string;
      visits: number;
      share: number;
      lat: number;
      lng: number;
    }>;
    indiaMapPoints: Array<{
      key: string;
      label: string;
      visits: number;
      share: number;
      lat: number;
      lng: number;
    }>;
  };
  realtime: {
    updatedAt: string;
    lastEventAt: string | null;
    activeNowSessions: number;
    last5Minutes: {
      visits: number;
      ctaClicks: number;
      checkoutStarts: number;
      successfulSubs: number;
    };
    last60Minutes: {
      visits: number;
      ctaClicks: number;
      checkoutStarts: number;
      successfulSubs: number;
    };
    perMinute: Array<{
      minute: string;
      label: string;
      visits: number;
      ctaClicks: number;
      checkoutStarts: number;
      successfulSubs: number;
    }>;
  };
};

type ContentItem = {
  _id: string;
  title: string;
  type: "image" | "video";
  status: "draft" | "scheduled" | "published";
  publishAt: string | null;
  previewEligible: boolean;
  tags: string[];
};

type MemberItem = {
  userId: string;
  email?: string;
  phone?: string;
  status: string;
  razorpaySubscriptionId?: string;
  updatedAt?: string;
};

type AdminTab = "analytics" | "upload" | "members" | "library";
type ContentStatusFilter = "all" | ContentItem["status"];
type ContentTypeFilter = "all" | ContentItem["type"];
type GeoScope = "world" | "india";
type AdminSiteSettings = {
  ageModeEnabled: boolean;
};

const lookbackWindows = [7, 30, 90] as const;

const membershipStatusVariantMap: Record<string, "default" | "success" | "warning" | "danger"> = {
  ACTIVE: "success",
  PENDING: "warning",
  PAST_DUE: "warning",
  CANCELLED: "danger",
  EXPIRED: "danger",
  DISPUTED: "danger",
  NONE: "default"
};

const contentStatusVariantMap: Record<ContentItem["status"], "default" | "success" | "warning" | "danger"> = {
  draft: "default",
  scheduled: "warning",
  published: "success"
};

const CONTENT_PAGE_SIZE = 12;
const MEMBERS_PAGE_SIZE = 12;
const LIVE_REFRESH_MS = 15_000;

const TAB_STALE_MS: Record<Exclude<AdminTab, "upload">, number> = {
  analytics: 60_000,
  members: 30_000,
  library: 30_000
};

const STATUS_OPTIONS: Array<{ value: ContentItem["status"]; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" }
];

const STATUS_FILTER_OPTIONS: Array<{ value: ContentStatusFilter; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" }
];

const TYPE_FILTER_OPTIONS: Array<{ value: ContentTypeFilter; label: string }> = [
  { value: "all", label: "All types" },
  { value: "image", label: "Images" },
  { value: "video", label: "Videos" }
];

function buildPreviewUrl(cloudName: string, publicId: string, resourceType: string) {
  if (resourceType === "video") {
    return `https://res.cloudinary.com/${cloudName}/video/upload/so_1,e_blur:1400,q_30/${publicId}.jpg`;
  }

  return `https://res.cloudinary.com/${cloudName}/image/upload/e_blur:1400,q_30/${publicId}.jpg`;
}

function formatIST(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata"
  }).format(new Date(value));
}

function formatRate(value?: number | null) {
  return `${(value || 0).toFixed(1)}%`;
}

function formatSeconds(value: number) {
  if (!value) {
    return "0s";
  }
  if (value < 60) {
    return `${value}s`;
  }

  const min = Math.floor(value / 60);
  const sec = value % 60;
  return `${min}m ${sec}s`;
}

function slugToLabel(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function hasFreshData(lastLoadedAt: number | null, ttlMs: number) {
  if (!lastLoadedAt) {
    return false;
  }
  return Date.now() - lastLoadedAt < ttlMs;
}

function HeatmapGrid({
  columns,
  rows,
  cells
}: {
  columns: number;
  rows: number;
  cells: Array<{ x: number; y: number; intensity: number; count: number }>;
}) {
  const cellMap = useMemo(() => {
    const map = new Map<string, { intensity: number; count: number }>();
    cells.forEach((cell) => {
      map.set(`${cell.x}:${cell.y}`, { intensity: cell.intensity, count: cell.count });
    });
    return map;
  }, [cells]);

  return (
    <div className="space-y-3">
      <div
        className="grid overflow-hidden rounded-2xl border border-border bg-bg/60"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`
        }}
      >
        {Array.from({ length: columns * rows }).map((_, index) => {
          const x = index % columns;
          const y = Math.floor(index / columns);
          const data = cellMap.get(`${x}:${y}`);
          const intensity = data?.intensity || 0;

          return (
            <div
              // eslint-disable-next-line react/no-array-index-key
              key={`heat-cell-${index}`}
              className="h-4 border-[0.5px] border-border/40 sm:h-5"
              style={{
                background: `rgba(230, 75, 140, ${0.03 + intensity * 0.82})`
              }}
              title={data ? `${data.count} clicks` : undefined}
            />
          );
        })}
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted">
        <span>Top of page</span>
        <span>Hot zones represent repeated clicks</span>
      </div>
    </div>
  );
}

function TinyBadge({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border/80 bg-bg/55 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.1em] text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-text">{value}</p>
    </div>
  );
}

function AnalyticsLineChart({
  data
}: {
  data: Array<{
    label: string;
    visits: number;
    checkoutStarts: number;
    successfulSubs: number;
  }>;
}) {
  const width = 720;
  const height = 240;
  const padding = 22;

  const safeData = data.length
    ? data
    : [{ label: "-", visits: 0, checkoutStarts: 0, successfulSubs: 0 }];
  const maxValue = Math.max(
    1,
    ...safeData.flatMap((point) => [point.visits, point.checkoutStarts, point.successfulSubs])
  );

  const makePolyline = (key: "visits" | "checkoutStarts" | "successfulSubs") =>
    safeData
      .map((point, index) => {
        const x =
          padding + (index * (width - padding * 2)) / Math.max(1, safeData.length - 1);
        const y = height - padding - (point[key] / maxValue) * (height - padding * 2);
        return `${x},${y}`;
      })
      .join(" ");

  const bottomLabels = [safeData[0]?.label, safeData[Math.floor(safeData.length / 2)]?.label, safeData[safeData.length - 1]?.label].filter(Boolean);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-2xl border border-border/80 bg-bg/55 p-2">
        <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[620px]">
          {[0.25, 0.5, 0.75].map((ratio) => (
            <line
              key={ratio}
              x1={padding}
              x2={width - padding}
              y1={height - padding - ratio * (height - padding * 2)}
              y2={height - padding - ratio * (height - padding * 2)}
              stroke="rgba(182,188,207,0.16)"
              strokeDasharray="4 5"
            />
          ))}
          <polyline
            fill="none"
            stroke="#E64B8C"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={makePolyline("visits")}
          />
          <polyline
            fill="none"
            stroke="#22C55E"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={makePolyline("checkoutStarts")}
          />
          <polyline
            fill="none"
            stroke="#7C9BFF"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={makePolyline("successfulSubs")}
          />
        </svg>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-muted">
            <span className="h-2.5 w-2.5 rounded-full bg-accent" /> Visits
          </span>
          <span className="inline-flex items-center gap-1.5 text-muted">
            <span className="h-2.5 w-2.5 rounded-full bg-success" /> Checkout starts
          </span>
          <span className="inline-flex items-center gap-1.5 text-muted">
            <span className="h-2.5 w-2.5 rounded-full bg-[#7C9BFF]" /> Paid
          </span>
        </div>
        <span className="text-muted">{bottomLabels.join("  •  ")}</span>
      </div>
    </div>
  );
}

function GeoDotMap({
  title,
  subtitle,
  points,
  scope
}: {
  title: string;
  subtitle: string;
  points: Array<{ key: string; label: string; visits: number; share: number; lat: number; lng: number }>;
  scope: GeoScope;
}) {
  const maxVisits = Math.max(1, ...points.map((point) => point.visits));
  const bounds =
    scope === "india"
      ? { minLat: 6, maxLat: 38, minLng: 67, maxLng: 98 }
      : { minLat: -60, maxLat: 80, minLng: -180, maxLng: 180 };

  const mapped = points.map((point) => {
    const x = ((point.lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 100;
    const y = ((bounds.maxLat - point.lat) / (bounds.maxLat - bounds.minLat)) * 100;
    return {
      ...point,
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
      size: 8 + (point.visits / maxVisits) * 14
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-accent" /> {title}
        </CardTitle>
        <CardDescription>{subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-border bg-[radial-gradient(circle_at_18%_14%,rgba(124,155,255,0.22),transparent_30%),radial-gradient(circle_at_78%_16%,rgba(230,75,140,0.28),transparent_35%),#090B11]">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(182,188,207,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(182,188,207,0.08)_1px,transparent_1px)] bg-[size:40px_40px]" />
          {mapped.map((point) => (
            <div
              key={point.key}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/70 bg-accent/40 shadow-[0_0_20px_rgba(230,75,140,0.55)]"
              style={{ left: `${point.x}%`, top: `${point.y}%`, width: point.size, height: point.size }}
              title={`${point.label}: ${point.visits} visits`}
            />
          ))}
          <div className="absolute left-3 top-3 rounded-full border border-border bg-bg/80 px-2.5 py-1 text-[11px] text-muted">
            {scope === "india" ? "India region map" : "Global traffic map"}
          </div>
        </div>
        <div className="space-y-2">
          {points.slice(0, 5).map((point) => (
            <div key={point.key} className="flex items-center justify-between text-xs">
              <span className="truncate text-text">{point.label}</span>
              <span className="text-muted">
                {point.visits} • {formatRate(point.share)}
              </span>
            </div>
          ))}
          {!points.length ? <p className="text-xs text-muted">No geo traffic events captured yet.</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function PaginationControls({
  pagination,
  loading,
  label,
  onPageChange
}: {
  pagination: PaginationMeta;
  loading: boolean;
  label: string;
  onPageChange: (nextPage: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-bg/55 p-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted">
        {label}: {pagination.total} • Page {pagination.page} / {pagination.totalPages}
      </p>
      <div className="flex items-center gap-2">
        <Button
          className="flex-1 sm:flex-none"
          size="sm"
          variant="secondary"
          disabled={!pagination.hasPrev || loading}
          onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
        >
          Previous
        </Button>
        <Button
          className="flex-1 sm:flex-none"
          size="sm"
          variant="secondary"
          disabled={!pagination.hasNext || loading}
          onClick={() => onPageChange(Math.min(pagination.totalPages, pagination.page + 1))}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

function CustomDropdown<T extends string>({
  id,
  value,
  options,
  onChange,
  disabled = false,
  className
}: {
  id?: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  const selected = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        id={id}
        className={cn(
          "inline-flex h-11 w-full items-center justify-between rounded-xl border border-border bg-bg px-3 text-sm text-text transition hover:border-accent/45 disabled:cursor-not-allowed disabled:opacity-60",
          open && "border-accent/60"
        )}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((state) => !state)}
      >
        <span className="truncate">{selected?.label || "-"}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div
          className="absolute left-0 right-0 z-30 mt-2 max-h-64 overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-xl"
          role="listbox"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={value === option.value}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-text transition hover:bg-bg/80",
                value === option.value && "bg-accent/15 text-accent"
              )}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              <span>{option.label}</span>
              {value === option.value ? <Check className="h-4 w-4" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTab>("analytics");
  const [siteSettings, setSiteSettings] = useState<AdminSiteSettings>({ ageModeEnabled: true });
  const [siteSettingsLoading, setSiteSettingsLoading] = useState(false);
  const [siteSettingsSaving, setSiteSettingsSaving] = useState(false);

  const [metrics, setMetrics] = useState<MetricData | null>(null);
  const [daysWindow, setDaysWindow] = useState<(typeof lookbackWindows)[number]>(30);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsLoadedAt, setAnalyticsLoadedAt] = useState<number | null>(null);
  const [analyticsDaysLoaded, setAnalyticsDaysLoaded] = useState<number | null>(null);
  const [selectedHeatmapPath, setSelectedHeatmapPath] = useState("");
  const [geoScope, setGeoScope] = useState<GeoScope>("world");

  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState<"draft" | "scheduled" | "published">("draft");
  const [publishAt, setPublishAt] = useState("");
  const [previewEligible, setPreviewEligible] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [members, setMembers] = useState<MemberItem[]>([]);
  const [memberQuery, setMemberQuery] = useState("");
  const [memberSearchInput, setMemberSearchInput] = useState("");
  const [membersPagination, setMembersPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: MEMBERS_PAGE_SIZE,
    total: 0,
    totalPages: 1,
    hasPrev: false,
    hasNext: false
  });
  const [memberLoading, setMemberLoading] = useState(false);
  const [membersLoadedAt, setMembersLoadedAt] = useState<number | null>(null);

  const [content, setContent] = useState<ContentItem[]>([]);
  const [contentStatusFilter, setContentStatusFilter] = useState<ContentStatusFilter>("all");
  const [contentTypeFilter, setContentTypeFilter] = useState<ContentTypeFilter>("all");
  const [contentPagination, setContentPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: CONTENT_PAGE_SIZE,
    total: 0,
    totalPages: 1,
    hasPrev: false,
    hasNext: false
  });
  const [contentLoading, setContentLoading] = useState(false);
  const [contentLoadedAt, setContentLoadedAt] = useState<number | null>(null);
  const [deletingIds, setDeletingIds] = useState<Record<string, boolean>>({});

  const loadAnalytics = useCallback(
    async (force = false) => {
      if (
        !force &&
        analyticsDaysLoaded === daysWindow &&
        hasFreshData(analyticsLoadedAt, TAB_STALE_MS.analytics)
      ) {
        return;
      }

      try {
        setAnalyticsLoading(true);
        const response = await fetch(`/api/admin/metrics?days=${daysWindow}`, { cache: "no-store" });
        const payload = await response.json();

        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "Unable to load analytics");
        }

        setMetrics(payload.data as MetricData);
        setAnalyticsLoadedAt(Date.now());
        setAnalyticsDaysLoaded(daysWindow);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to load analytics");
      } finally {
        setAnalyticsLoading(false);
      }
    },
    [analyticsDaysLoaded, analyticsLoadedAt, daysWindow]
  );

  const loadSiteSettings = useCallback(async () => {
    try {
      setSiteSettingsLoading(true);
      const response = await fetch("/api/admin/settings", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Unable to load site settings");
      }

      setSiteSettings(payload.data as AdminSiteSettings);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load site settings");
    } finally {
      setSiteSettingsLoading(false);
    }
  }, []);

  const updateAgeMode = useCallback(
    async (enabled: boolean) => {
      try {
        setSiteSettingsSaving(true);
        const previous = siteSettings.ageModeEnabled;
        setSiteSettings((current) => ({ ...current, ageModeEnabled: enabled }));

        const response = await fetch("/api/admin/settings", {
          method: "PATCH",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({ ageModeEnabled: enabled })
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          setSiteSettings((current) => ({ ...current, ageModeEnabled: previous }));
          throw new Error(payload.error || "Unable to update site settings");
        }

        setSiteSettings(payload.data as AdminSiteSettings);
        toast.success(
          enabled
            ? "18+ mode enabled: age checker and labels are active site-wide."
            : "18+ mode disabled: age checker and labels are hidden site-wide."
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to update site settings");
      } finally {
        setSiteSettingsSaving(false);
      }
    },
    [siteSettings.ageModeEnabled]
  );

  const loadMembers = useCallback(
    async ({ force = false, page, query }: { force?: boolean; page?: number; query?: string } = {}) => {
      if (!force && hasFreshData(membersLoadedAt, TAB_STALE_MS.members)) {
        return;
      }

      const targetPage = page || membersPagination.page;
      const targetQuery = query ?? memberQuery;

      try {
        setMemberLoading(true);
        const params = new URLSearchParams({
          page: String(targetPage),
          pageSize: String(MEMBERS_PAGE_SIZE)
        });
        if (targetQuery) {
          params.set("query", targetQuery);
        }

        const response = await fetch(`/api/admin/members?${params.toString()}`, { cache: "no-store" });
        const payload = await response.json();

        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "Failed to load members");
        }

        setMembers(payload.data.items as MemberItem[]);
        setMembersPagination(payload.data.pagination as PaginationMeta);
        setMembersLoadedAt(Date.now());
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load members");
      } finally {
        setMemberLoading(false);
      }
    },
    [memberQuery, membersLoadedAt, membersPagination.page]
  );

  const loadContent = useCallback(
    async ({
      force = false,
      page,
      statusFilter,
      typeFilter
    }: {
      force?: boolean;
      page?: number;
      statusFilter?: ContentStatusFilter;
      typeFilter?: ContentTypeFilter;
    } = {}) => {
      if (!force && hasFreshData(contentLoadedAt, TAB_STALE_MS.library)) {
        return;
      }

      const targetPage = page || contentPagination.page;
      const targetStatus = statusFilter ?? contentStatusFilter;
      const targetType = typeFilter ?? contentTypeFilter;

      try {
        setContentLoading(true);
        const params = new URLSearchParams({
          page: String(targetPage),
          pageSize: String(CONTENT_PAGE_SIZE)
        });
        if (targetStatus !== "all") {
          params.set("status", targetStatus);
        }
        if (targetType !== "all") {
          params.set("type", targetType);
        }

        const response = await fetch(`/api/admin/content?${params.toString()}`, { cache: "no-store" });
        const payload = await response.json();

        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "Unable to load content");
        }

        setContent(payload.data.items as ContentItem[]);
        setContentPagination(payload.data.pagination as PaginationMeta);
        setContentLoadedAt(Date.now());
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to load content");
      } finally {
        setContentLoading(false);
      }
    },
    [contentLoadedAt, contentPagination.page, contentStatusFilter, contentTypeFilter]
  );

  useEffect(() => {
    void loadSiteSettings();
  }, [loadSiteSettings]);

  useEffect(() => {
    if (activeTab === "analytics") {
      void loadAnalytics();
      return;
    }

    if (activeTab === "members") {
      void loadMembers();
      return;
    }

    if (activeTab === "library") {
      void loadContent();
    }
  }, [activeTab, loadAnalytics, loadMembers, loadContent]);

  useEffect(() => {
    if (activeTab !== "analytics") {
      return;
    }

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadAnalytics(true);
      }
    }, LIVE_REFRESH_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [activeTab, loadAnalytics]);

  useEffect(() => {
    const paths = metrics?.heatmap.paths || [];
    if (!paths.length) {
      setSelectedHeatmapPath("");
      return;
    }

    if (!selectedHeatmapPath || !paths.some((item) => item.path === selectedHeatmapPath)) {
      setSelectedHeatmapPath(paths[0].path);
    }
  }, [metrics?.heatmap.paths, selectedHeatmapPath]);

  const selectedHeatmap = useMemo(
    () => metrics?.heatmap.paths.find((item) => item.path === selectedHeatmapPath) || null,
    [metrics?.heatmap.paths, selectedHeatmapPath]
  );

  const uploadAndCreateContent = async () => {
    if (!file || !title) {
      toast.error("Title and media file are required.");
      return;
    }

    try {
      setUploading(true);

      const resourceType = file.type.startsWith("video") ? "video" : "image";
      const signResponse = await fetch("/api/admin/media/sign-upload", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ resourceType })
      });

      const signPayload = await signResponse.json();
      if (!signResponse.ok || !signPayload.ok) {
        throw new Error(signPayload.error || "Failed to prepare upload");
      }

      const signData = signPayload.data as {
        cloudName: string;
        apiKey: string;
        timestamp: number;
        signature: string;
        folder: string;
        resourceType: "image" | "video" | "auto";
      };

      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", signData.apiKey);
      formData.append("timestamp", String(signData.timestamp));
      formData.append("signature", signData.signature);
      formData.append("folder", signData.folder);

      const uploadResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${signData.cloudName}/${signData.resourceType}/upload`,
        {
          method: "POST",
          body: formData
        }
      );

      const uploadPayload = await uploadResponse.json();
      if (!uploadResponse.ok) {
        throw new Error(uploadPayload.error?.message || "Cloudinary upload failed");
      }

      const previewUrl = buildPreviewUrl(
        signData.cloudName,
        uploadPayload.public_id,
        uploadPayload.resource_type
      );

      const createResponse = await fetch("/api/admin/content", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          type: uploadPayload.resource_type === "video" ? "video" : "image",
          title,
          tags: tags
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          status,
          publishAt: publishAt ? new Date(publishAt).toISOString() : undefined,
          previewEligible,
          previewUrl,
          mediaAssetId: uploadPayload.public_id
        })
      });

      const createPayload = await createResponse.json();
      if (!createResponse.ok || !createPayload.ok) {
        throw new Error(createPayload.error || "Could not create content");
      }

      toast.success("Content uploaded successfully");
      setFile(null);
      setTitle("");
      setTags("");
      setPublishAt("");
      setStatus("draft");
      await loadContent({ force: true, page: 1 });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const patchContentStatus = async (id: string, nextStatus: "draft" | "scheduled" | "published") => {
    try {
      const response = await fetch(`/api/admin/content/${id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ status: nextStatus })
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Update failed");
      }

      setContent((items) =>
        items.map((item) => (item._id === id ? { ...item, status: nextStatus } : item))
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    }
  };

  const deleteContent = async (id: string) => {
    const confirmed = window.confirm("Delete this content item permanently?");
    if (!confirmed) {
      return;
    }

    try {
      setDeletingIds((current) => ({ ...current, [id]: true }));
      const response = await fetch(`/api/admin/content/${id}`, {
        method: "DELETE"
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Delete failed");
      }

      toast.success("Content deleted");
      await loadContent({ force: true, page: contentPagination.page });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setDeletingIds((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    }
  };

  const submitMemberSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextQuery = memberSearchInput.trim();
    setMemberQuery(nextQuery);
    await loadMembers({ force: true, page: 1, query: nextQuery });
  };

  const onContentStatusChange = async (nextStatus: ContentStatusFilter) => {
    setContentStatusFilter(nextStatus);
    await loadContent({ force: true, page: 1, statusFilter: nextStatus, typeFilter: contentTypeFilter });
  };

  const onContentTypeChange = async (nextType: ContentTypeFilter) => {
    setContentTypeFilter(nextType);
    await loadContent({ force: true, page: 1, statusFilter: contentStatusFilter, typeFilter: nextType });
  };

  const refreshActiveSegment = async () => {
    if (activeTab === "analytics") {
      await loadAnalytics(true);
      return;
    }

    if (activeTab === "members") {
      await loadMembers({ force: true, page: membersPagination.page, query: memberQuery });
      return;
    }

    if (activeTab === "library") {
      await loadContent({
        force: true,
        page: contentPagination.page,
        statusFilter: contentStatusFilter,
        typeFilter: contentTypeFilter
      });
      return;
    }

    await loadContent({ force: true, page: 1, statusFilter: contentStatusFilter, typeFilter: contentTypeFilter });
  };

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("alina_site_role");
    }
    window.location.href = "/admin/login";
  };

  const funnelRows = useMemo(() => {
    if (!metrics) {
      return [];
    }

    return [
      {
        label: "Page visits",
        value: metrics.funnel.visits,
        rate: "100%"
      },
      {
        label: "CTA clicks",
        value: metrics.funnel.ctaClicks,
        rate: formatRate(metrics.funnel.visitToCtaRate)
      },
      {
        label: "Checkout starts",
        value: metrics.funnel.checkoutStarts,
        rate: formatRate(metrics.funnel.ctaToCheckoutRate)
      },
      {
        label: "Successful paid members",
        value: metrics.funnel.successfulSubs,
        rate: formatRate(metrics.funnel.checkoutToPaidRate)
      }
    ];
  }, [metrics]);

  const dailyTrendPoints = useMemo(
    () =>
      (metrics?.series || []).map((item) => ({
        label: item.date.slice(5),
        visits: item.visits || 0,
        checkoutStarts: item.checkoutStarts || 0,
        successfulSubs: item.successfulSubs || 0
      })),
    [metrics?.series]
  );

  const realtimeTrendPoints = useMemo(
    () =>
      (metrics?.realtime.perMinute || []).slice(-30).map((item) => ({
        label: item.label,
        visits: item.visits,
        checkoutStarts: item.checkoutStarts,
        successfulSubs: item.successfulSubs
      })),
    [metrics?.realtime.perMinute]
  );

  const selectedGeoPoints =
    geoScope === "india" ? metrics?.geography.indiaMapPoints || [] : metrics?.geography.worldMapPoints || [];

  const topGeoRows = useMemo(
    () =>
      geoScope === "india"
        ? (metrics?.geography.indiaRegions || []).map((item) => ({
            key: item.regionCode,
            label: item.region,
            visits: item.visits,
            share: item.share
          }))
        : (metrics?.geography.countries || []).map((item) => ({
            key: item.countryCode,
            label: item.country,
            visits: item.visits,
            share: item.share
          })),
    [geoScope, metrics?.geography.countries, metrics?.geography.indiaRegions]
  );

  const tabStats = useMemo(
    () => ({
      analytics: metrics?.aggregate.visits || 0,
      upload: 0,
      members: membersPagination.total,
      library: contentPagination.total
    }),
    [contentPagination.total, membersPagination.total, metrics?.aggregate.visits]
  );

  const activeSegmentLoading =
    (activeTab === "analytics" && analyticsLoading) ||
    (activeTab === "members" && memberLoading) ||
    (activeTab === "library" && contentLoading) ||
    (activeTab === "upload" && uploading);

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
          <p className="text-sm text-muted">
            Structured control center for analytics, uploads, member management, and content operations.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            className="w-full sm:w-auto"
            variant="secondary"
            onClick={refreshActiveSegment}
            disabled={activeSegmentLoading}
          >
            {activeSegmentLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
          </Button>
          <Button className="w-full sm:w-auto" variant="secondary" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" /> Log out
          </Button>
        </div>
      </div>

      <Card className="border-border/90 bg-surface/70">
        <CardContent className="p-3">
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[
              { id: "analytics", label: "Analytics", icon: BarChart3 },
              { id: "upload", label: "Upload", icon: Upload },
              { id: "members", label: "Members", icon: Users },
              { id: "library", label: "Content Library", icon: FolderKanban }
            ].map((tab) => (
              <Button
                key={tab.id}
                size="sm"
                variant={activeTab === tab.id ? "default" : "secondary"}
                className={cn(
                  "h-11 min-w-[10rem] shrink-0 justify-between rounded-xl px-3 text-sm",
                  activeTab === tab.id && "shadow-[0_0_16px_rgba(230,75,140,0.4)]"
                )}
                onClick={() => setActiveTab(tab.id as AdminTab)}
              >
                <span className="inline-flex items-center gap-2">
                  <tab.icon className="h-4 w-4" /> {tab.label}
                </span>
                <span className="text-xs opacity-85">{tabStats[tab.id as AdminTab]}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/90 bg-surface/70">
        <CardHeader className="space-y-1 p-4">
          <CardTitle className="text-base">Global 18+ Mode</CardTitle>
          <CardDescription>
            One toggle controls both age-check modal enforcement and all 18+ labels across pages,
            including legal pages.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 p-4 pt-0 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            Current status:{" "}
            <span className={cn("font-medium", siteSettings.ageModeEnabled ? "text-accent" : "text-muted")}>
              {siteSettingsLoading
                ? "Loading..."
                : siteSettings.ageModeEnabled
                  ? "Enabled"
                  : "Disabled"}
            </span>
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={siteSettings.ageModeEnabled ? "default" : "secondary"}
              onClick={() => void updateAgeMode(true)}
              disabled={siteSettingsSaving || siteSettingsLoading}
            >
              Enable
            </Button>
            <Button
              size="sm"
              variant={!siteSettings.ageModeEnabled ? "default" : "secondary"}
              onClick={() => void updateAgeMode(false)}
              disabled={siteSettingsSaving || siteSettingsLoading}
            >
              Disable
            </Button>
          </div>
        </CardContent>
      </Card>

      {activeTab === "analytics" ? (
        <div className="space-y-4">
          <section className="flex flex-wrap items-center gap-2">
            <p className="text-xs uppercase tracking-[0.16em] text-muted">Analytics window</p>
            {lookbackWindows.map((days) => (
              <Button
                key={days}
                size="sm"
                variant={days === daysWindow ? "default" : "secondary"}
                onClick={() => {
                  setDaysWindow(days);
                }}
              >
                {days} days
              </Button>
            ))}
            <span className="ml-auto text-xs text-muted">
              Live refresh: every 15s • Updated{" "}
              {metrics?.realtime.updatedAt
                ? new Date(metrics.realtime.updatedAt).toLocaleTimeString("en-IN")
                : "--"}
            </span>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="p-4">
                <CardDescription className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-accent" /> Unique visitors
                </CardDescription>
                <CardTitle>{metrics?.traffic.uniqueVisitors ?? 0}</CardTitle>
                <p className="text-xs text-muted">Visits: {metrics?.aggregate.visits ?? 0}</p>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="p-4">
                <CardDescription className="flex items-center gap-2">
                  <MousePointerClick className="h-4 w-4 text-accent" /> CTA click-through
                </CardDescription>
                <CardTitle>{formatRate(metrics?.funnel.visitToCtaRate)}</CardTitle>
                <p className="text-xs text-muted">CTA clicks: {metrics?.aggregate.ctaClicks ?? 0}</p>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="p-4">
                <CardDescription className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-accent" /> Checkout to paid
                </CardDescription>
                <CardTitle>{formatRate(metrics?.funnel.checkoutToPaidRate)}</CardTitle>
                <p className="text-xs text-muted">
                  Overall CVR: {formatRate(metrics?.funnel.overallConversionRate)}
                </p>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="p-4">
                <CardDescription className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-accent" /> Membership health
                </CardDescription>
                <CardTitle>{metrics?.activeMembers ?? 0}</CardTitle>
                <p className="text-xs text-muted">Active • Churn proxy: {metrics?.churnProxy ?? 0}</p>
              </CardHeader>
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-accent" /> Trend graph (selected window)
                </CardTitle>
                <CardDescription>Daily performance for visits, checkout starts, and paid memberships.</CardDescription>
              </CardHeader>
              <CardContent>
                <AnalyticsLineChart data={dailyTrendPoints} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-accent" /> Real-time analytics
                </CardTitle>
                <CardDescription>Auto-refreshes every 15 seconds while this tab is open.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <TinyBadge
                    label="Active now (sessions)"
                    value={metrics?.realtime.activeNowSessions ?? 0}
                  />
                  <TinyBadge
                    label="Last event"
                    value={metrics?.realtime.lastEventAt ? "Live" : "No data"}
                  />
                  <TinyBadge
                    label="Last 5 min visits"
                    value={metrics?.realtime.last5Minutes.visits ?? 0}
                  />
                  <TinyBadge
                    label="Last 5 min paid"
                    value={metrics?.realtime.last5Minutes.successfulSubs ?? 0}
                  />
                </div>

                <AnalyticsLineChart data={realtimeTrendPoints} />
              </CardContent>
            </Card>
          </section>

          <section className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-base font-semibold">Region-wise tracking map</h3>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={geoScope === "world" ? "default" : "secondary"}
                  onClick={() => setGeoScope("world")}
                >
                  <Globe2 className="mr-1 h-3.5 w-3.5" /> Global
                </Button>
                <Button
                  size="sm"
                  variant={geoScope === "india" ? "default" : "secondary"}
                  onClick={() => setGeoScope("india")}
                >
                  <MapPin className="mr-1 h-3.5 w-3.5" /> India
                </Button>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <GeoDotMap
                scope={geoScope}
                title={geoScope === "india" ? "India region heat map" : "Global country heat map"}
                subtitle={
                  geoScope === "india"
                    ? "Real traffic grouped by Indian state/UT"
                    : "Real traffic grouped by country"
                }
                points={selectedGeoPoints}
              />

              <Card>
                <CardHeader>
                  <CardTitle>
                    {geoScope === "india" ? "Top Indian regions" : "Top countries"}
                  </CardTitle>
                  <CardDescription>Ordered by real visitor volume in selected time window.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {topGeoRows.slice(0, 10).map((item) => (
                    <div
                      key={item.key}
                      className="rounded-xl border border-border/70 bg-bg/55 p-2.5"
                    >
                      <div className="flex items-center justify-between text-sm">
                        <p className="truncate text-text">{item.label}</p>
                        <p className="text-muted">{item.visits}</p>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-surface">
                        <div
                          className="h-2 rounded-full bg-accent"
                          style={{ width: `${Math.max(4, item.share)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  {!selectedGeoPoints.length ? (
                    <p className="text-sm text-muted">Geo data will appear once real traffic arrives.</p>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle>Conversion funnel</CardTitle>
                <CardDescription>Drop-offs from landing visits to paid membership.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {funnelRows.map((step, index) => {
                  const max = funnelRows[0]?.value || 1;
                  const width = Math.max(4, (step.value / max) * 100);

                  return (
                    <div key={step.label} className="rounded-xl border border-border/80 bg-bg/55 p-3">
                      <div className="flex items-center justify-between text-sm">
                        <p className="font-medium text-text">
                          {index + 1}. {step.label}
                        </p>
                        <p className="text-muted">{step.value.toLocaleString()}</p>
                      </div>
                      <div className="mt-2 h-2.5 rounded-full bg-surface">
                        <div
                          className="h-2.5 rounded-full bg-accent shadow-[0_0_14px_rgba(230,75,140,0.4)]"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-muted">Step rate: {step.rate}</p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Traffic quality</CardTitle>
                <CardDescription>Session depth, dwell, and restore behavior.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/80 bg-bg/55 p-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted">Avg session</p>
                    <p className="mt-1 text-lg font-semibold text-text">
                      {formatSeconds(metrics?.traffic.avgSessionSeconds || 0)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/80 bg-bg/55 p-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted">Avg scroll</p>
                    <p className="mt-1 text-lg font-semibold text-text">
                      {formatRate(metrics?.traffic.avgScrollDepth)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/80 bg-bg/55 p-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted">Engaged sessions</p>
                    <p className="mt-1 text-lg font-semibold text-text">
                      {formatRate(metrics?.traffic.engagedSessionRate)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/80 bg-bg/55 p-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted">Restore success</p>
                    <p className="mt-1 text-lg font-semibold text-text">
                      {formatRate(metrics?.restore.successRate)}
                    </p>
                    <p className="text-xs text-muted">
                      {metrics?.restore.successes ?? 0}/{metrics?.restore.requests ?? 0}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 rounded-xl border border-border/80 bg-bg/55 p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted">Top referrers</p>
                  {(metrics?.traffic.topReferrers || []).slice(0, 4).map((item) => (
                    <div key={item.source} className="flex items-center justify-between text-sm">
                      <p className="truncate text-text">{item.source}</p>
                      <p className="text-muted">{item.visits}</p>
                    </div>
                  ))}
                  {!metrics?.traffic.topReferrers?.length ? (
                    <p className="text-xs text-muted">No referrer data yet.</p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle>Heatmap clicks</CardTitle>
                <CardDescription>
                  Live click density for marketing pages (optimize CTA placement and fold strategy).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {(metrics?.heatmap.paths || []).map((item) => (
                    <Button
                      key={item.path}
                      size="sm"
                      variant={selectedHeatmapPath === item.path ? "default" : "secondary"}
                      onClick={() => setSelectedHeatmapPath(item.path)}
                    >
                      {item.path} ({item.totalClicks})
                    </Button>
                  ))}
                </div>

                {selectedHeatmap ? (
                  <HeatmapGrid
                    columns={metrics?.heatmap.columns || 12}
                    rows={metrics?.heatmap.rows || 18}
                    cells={selectedHeatmap.cells}
                  />
                ) : (
                  <div className="rounded-xl border border-border bg-bg/55 p-4 text-sm text-muted">
                    No heatmap data yet. Marketing clicks will appear here automatically.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Device + CTA insights</CardTitle>
                <CardDescription>Where visitors come from and what they click most.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 rounded-xl border border-border/80 bg-bg/55 p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted">Device split</p>
                  {(metrics?.traffic.deviceSplit || []).map((item) => (
                    <div key={item.device} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <p className="text-text">{slugToLabel(item.device)}</p>
                        <p className="text-muted">
                          {item.visits} • {formatRate(item.share)}
                        </p>
                      </div>
                      <div className="h-2 rounded-full bg-surface">
                        <div className="h-2 rounded-full bg-accent" style={{ width: `${Math.max(3, item.share)}%` }} />
                      </div>
                    </div>
                  ))}
                  {!metrics?.traffic.deviceSplit?.length ? (
                    <p className="text-xs text-muted">No device data yet.</p>
                  ) : null}
                </div>

                <div className="space-y-2 rounded-xl border border-border/80 bg-bg/55 p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted">Top CTA labels</p>
                  {(metrics?.topCtas || []).slice(0, 6).map((item) => (
                    <div key={item.label} className="flex items-center justify-between text-sm">
                      <p className="truncate text-text">{slugToLabel(item.label)}</p>
                      <p className="text-muted">{item.clicks}</p>
                    </div>
                  ))}
                  {!metrics?.topCtas?.length ? (
                    <p className="text-xs text-muted">No CTA click labels yet.</p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Path performance</CardTitle>
              <CardDescription>Compare conversion quality between landing and checkout paths.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-xl border border-border/80">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Path</TableHead>
                    <TableHead>Visits</TableHead>
                    <TableHead>CTA</TableHead>
                    <TableHead>Checkout</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Rates</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(metrics?.pathPerformance || []).map((item) => (
                    <TableRow key={item.path}>
                      <TableCell className="font-mono text-xs text-text">{item.path}</TableCell>
                      <TableCell>{item.visits}</TableCell>
                      <TableCell>{item.ctaClicks}</TableCell>
                      <TableCell>{item.checkoutStarts}</TableCell>
                      <TableCell>{item.successfulSubs}</TableCell>
                      <TableCell className="text-xs text-muted">
                        CTA {formatRate(item.ctaRate)} • Start {formatRate(item.startRate)} • Success{" "}
                        {formatRate(item.successRate)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!metrics?.pathPerformance?.length ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-sm text-muted">
                        Path analytics will populate after visitor traffic is tracked.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeTab === "upload" ? (
        <Card>
          <CardHeader>
            <CardTitle>Upload Content</CardTitle>
            <CardDescription>
              Upload media to Cloudinary and create draft/scheduled/published entries.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="content-title">Title</Label>
              <Input id="content-title" value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content-tags">Tags (comma separated)</Label>
              <Input id="content-tags" value={tags} onChange={(event) => setTags(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content-status">Status</Label>
              <CustomDropdown
                id="content-status"
                value={status}
                options={STATUS_OPTIONS}
                onChange={(nextStatus) => setStatus(nextStatus)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="publish-at">Publish time (UTC)</Label>
              <Input
                id="publish-at"
                type="datetime-local"
                value={publishAt}
                onChange={(event) => setPublishAt(event.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="content-file">Media file</Label>
              <Input
                id="content-file"
                type="file"
                accept="image/*,video/*"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
              />
            </div>
            <label className="md:col-span-2 flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={previewEligible}
                onChange={(event) => setPreviewEligible(event.target.checked)}
              />
              Eligible for blurred public preview
            </label>
            <div className="md:col-span-2">
              <Button className="w-full sm:w-auto" onClick={uploadAndCreateContent} disabled={uploading}>
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...
                  </>
                ) : (
                  "Upload and save content"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "members" ? (
        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>Search by email or phone. Data is paginated for scale.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="flex flex-col gap-2 sm:flex-row" onSubmit={submitMemberSearch}>
              <Input
                value={memberSearchInput}
                onChange={(event) => setMemberSearchInput(event.target.value)}
                placeholder="email or phone"
              />
              <Button className="w-full sm:w-auto" type="submit" variant="secondary" disabled={memberLoading}>
                {memberLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </form>

            <div className="overflow-x-auto rounded-xl border border-border/80">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Subscription</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.userId}>
                    <TableCell>{member.email || "-"}</TableCell>
                    <TableCell>{member.phone || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={membershipStatusVariantMap[member.status] || "default"}>{member.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted">{formatIST(member.updatedAt)}</TableCell>
                    <TableCell className="font-mono text-xs">{member.razorpaySubscriptionId || "-"}</TableCell>
                  </TableRow>
                ))}
                {!members.length ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-sm text-muted">
                      No members found for this query.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
              </Table>
            </div>

            <PaginationControls
              pagination={membersPagination}
              loading={memberLoading}
              label="Total members"
              onPageChange={(nextPage) => {
                void loadMembers({ force: true, page: nextPage, query: memberQuery });
              }}
            />
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "library" ? (
        <Card>
          <CardHeader>
            <CardTitle>Content Library</CardTitle>
            <CardDescription>Filter and manage content with pagination for high-volume libraries.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label htmlFor="filter-status">Status</Label>
                <CustomDropdown
                  id="filter-status"
                  value={contentStatusFilter}
                  options={STATUS_FILTER_OPTIONS}
                  onChange={(nextStatus) => {
                    void onContentStatusChange(nextStatus);
                  }}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="filter-type">Type</Label>
                <CustomDropdown
                  id="filter-type"
                  value={contentTypeFilter}
                  options={TYPE_FILTER_OPTIONS}
                  onChange={(nextType) => {
                    void onContentTypeChange(nextType);
                  }}
                />
              </div>
            </div>

            {contentLoading && !content.length ? (
              <div className="rounded-xl border border-border bg-bg/55 p-4 text-sm text-muted">Loading content...</div>
            ) : null}

            {content.map((item) => (
              <div key={item._id} className="rounded-xl border border-border p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-xs text-muted">
                      {item.type.toUpperCase()} • {item.tags.join(", ") || "no tags"} • IST {formatIST(item.publishAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={contentStatusVariantMap[item.status]}>{item.status.toUpperCase()}</Badge>
                    <CustomDropdown
                      value={item.status}
                      options={STATUS_OPTIONS}
                      disabled={Boolean(deletingIds[item._id])}
                      className="w-full min-w-[9rem] sm:w-auto"
                      onChange={(nextStatus) => patchContentStatus(item._id, nextStatus)}
                    />
                    <Button
                      className="w-full sm:w-auto"
                      size="sm"
                      variant="danger"
                      disabled={Boolean(deletingIds[item._id])}
                      onClick={() => deleteContent(item._id)}
                    >
                      {deletingIds[item._id] ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Trash2 className="mr-1 h-4 w-4" /> Delete
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {!content.length && !contentLoading ? (
              <div className="rounded-xl border border-border bg-bg/55 p-4 text-sm text-muted">
                No content found for selected filters.
              </div>
            ) : null}

            <PaginationControls
              pagination={contentPagination}
              loading={contentLoading}
              label="Total content"
              onPageChange={(nextPage) => {
                void loadContent({
                  force: true,
                  page: nextPage,
                  statusFilter: contentStatusFilter,
                  typeFilter: contentTypeFilter
                });
              }}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
