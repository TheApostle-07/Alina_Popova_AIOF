"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Script from "next/script";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Crown,
  Home,
  Image as ImageIcon,
  Info,
  Loader2,
  LogOut,
  Medal,
  Minus,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserRound,
  Video
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { IMAGE_BLUR_DATA_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";

type MemberDashboardProps = {
  subscriptionId: string;
  email?: string;
  phone?: string;
};

type FeedItem = {
  _id: string;
  type: "image" | "video";
  title: string;
  tags: string[];
  mediaUrl: string;
  publishedAt: string;
};

type FeedResponse = {
  items: FeedItem[];
  nextCursor: string | null;
};

type MemberProfileResponse = {
  profile: {
    userId: string;
    displayName: string;
    displayNameKey: string;
    donationTotal: number;
    createdAt: string;
    updatedAt: string;
  };
  rank: number | null;
  totalMembers: number;
};

type NameSuggestionResponse = {
  suggestion: {
    displayName: string;
    displayNameKey: string;
  };
};

type DonationCreateResponse = {
  keyId: string;
  orderId: string;
  donationId: string;
  amount: number;
  currency: string;
  alreadyPaid?: boolean;
  donation?: {
    amount: number;
    totalDonated: number;
  };
  leaderboard?: LeaderboardResponse;
};

type DonationVerifyResponse = {
  donation: {
    amount: number;
    totalDonated: number;
    alreadyProcessed?: boolean;
  };
  leaderboard: LeaderboardResponse;
};

type LeaderboardRow = {
  rank: number;
  userId: string;
  displayName: string;
  displayNameKey: string;
  donationTotal: number;
  isCurrentMember: boolean;
};

type LeaderboardResponse = {
  items: LeaderboardRow[];
  topThree: LeaderboardRow[];
  currentMemberRank: number | null;
  currentMemberDonationTotal: number;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasPrev: boolean;
    hasNext: boolean;
  };
};

type MemberTab = "home" | "drops" | "images" | "videos" | "leaderboard" | "profile";

type DonationFeedback = {
  tone: "pending" | "success" | "error" | "info";
  title: string;
  body: string;
};

const MEMBER_TABS: Array<{
  id: MemberTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "home", label: "Home", icon: Home },
  { id: "drops", label: "Drops", icon: Sparkles },
  { id: "images", label: "Images", icon: ImageIcon },
  { id: "videos", label: "Videos", icon: Video },
  { id: "leaderboard", label: "Leaderboard", icon: Trophy },
  { id: "profile", label: "Profile", icon: UserRound }
];

const CONTENT_TABS: MemberTab[] = ["home", "drops", "images", "videos"];
const MEMBER_TAB_STORAGE_KEY = "alina_member_active_tab";
const MEMBER_TAB_IDS = new Set<MemberTab>(["home", "drops", "images", "videos", "leaderboard", "profile"]);

const rankStyles: Record<number, string> = {
  1: "border-[#D9B970]/55 bg-[#D9B970]/12 text-[#F1D89A]",
  2: "border-[#B8C2D8]/55 bg-[#B8C2D8]/12 text-[#E1E7F4]",
  3: "border-[#C68A57]/55 bg-[#C68A57]/12 text-[#EFC7A2]"
};

function isMemberTab(value: string | null | undefined): value is MemberTab {
  if (!value) {
    return false;
  }
  return MEMBER_TAB_IDS.has(value as MemberTab);
}

function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value || 0);
}

function formatPublishedAt(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata"
  }).format(new Date(value));
}

function playLeaderboardChime(audioRef: React.MutableRefObject<AudioContext | null>) {
  if (typeof window === "undefined") {
    return;
  }

  const AudioContextConstructor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextConstructor) {
    return;
  }

  try {
    const context = audioRef.current || new AudioContextConstructor();
    audioRef.current = context;

    if (context.state === "suspended") {
      void context.resume().catch(() => undefined);
    }

    const now = context.currentTime;
    const output = context.createGain();
    output.gain.setValueAtTime(0.0001, now);
    output.gain.linearRampToValueAtTime(0.06, now + 0.02);
    output.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
    output.connect(context.destination);

    const notes = [1046.5, 1318.5, 1567.98] as const;
    notes.forEach((frequency, index) => {
      const osc = context.createOscillator();
      const gain = context.createGain();
      const start = now + index * 0.085;
      const duration = 0.22 + index * 0.02;

      osc.type = "triangle";
      osc.frequency.setValueAtTime(frequency, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.45, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      osc.connect(gain);
      gain.connect(output);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    });

    window.setTimeout(() => {
      output.disconnect();
    }, 900);
  } catch {
    // Audio is best effort and should never block UI behavior.
  }
}

function FeedSkeletonGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={`feed-skeleton-${index}`}
          className="overflow-hidden rounded-2xl border border-border bg-surface/70"
        >
          <div className="aspect-[4/5] animate-pulse bg-[linear-gradient(135deg,#111528,#0E1018)]" />
          <div className="space-y-2 p-4">
            <div className="h-3 w-3/4 animate-pulse rounded bg-border/70" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-border/50" />
          </div>
        </div>
      ))}
    </div>
  );
}

function FeedCard({ item }: { item: FeedItem }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface/85 shadow-[0_14px_36px_-26px_rgba(230,75,140,0.35)]">
      <div className="relative overflow-hidden border-b border-border/80">
        {item.type === "image" ? (
          <Image
            src={item.mediaUrl}
            alt={item.title}
            width={900}
            height={1200}
            sizes="(min-width: 1280px) 30vw, (min-width: 640px) 45vw, 100vw"
            placeholder="blur"
            blurDataURL={IMAGE_BLUR_DATA_URL}
            className="aspect-[4/5] w-full object-cover"
          />
        ) : (
          <video
            src={item.mediaUrl}
            preload="metadata"
            controls
            playsInline
            className="aspect-[4/5] w-full object-cover"
          />
        )}
        <div className="pointer-events-none absolute left-3 top-3 inline-flex items-center rounded-full border border-border/70 bg-bg/80 px-2 py-0.5 text-[11px] text-muted">
          {item.type === "image" ? "Image" : "Video"}
        </div>
      </div>
      <div className="space-y-3 p-4">
        <h3 className="text-sm font-semibold text-text sm:text-base">{item.title}</h3>
        <p className="text-xs text-muted">{formatPublishedAt(item.publishedAt)}</p>
        <div className="flex flex-wrap gap-1.5">
          {item.tags.slice(0, 4).map((tag) => (
            <Badge key={`${item._id}-${tag}`}>{tag}</Badge>
          ))}
        </div>
      </div>
    </article>
  );
}

export function MemberDashboard({ subscriptionId, email, phone }: MemberDashboardProps) {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<MemberTab>(() => {
    if (typeof window === "undefined") {
      return "home";
    }

    const hashTab = window.location.hash.replace(/^#/, "").trim();
    if (isMemberTab(hashTab)) {
      return hashTab;
    }

    const storedTab = window.sessionStorage.getItem(MEMBER_TAB_STORAGE_KEY);
    if (isMemberTab(storedTab)) {
      return storedTab;
    }

    return "home";
  });

  const [profile, setProfile] = useState<MemberProfileResponse | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [feedCursor, setFeedCursor] = useState<string | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedLoadingMore, setFeedLoadingMore] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);

  const [contentSearchInput, setContentSearchInput] = useState("");
  const [contentSearch, setContentSearch] = useState("");

  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardPage, setLeaderboardPage] = useState(1);
  const [leaderboardSearchInput, setLeaderboardSearchInput] = useState("");
  const [leaderboardSearch, setLeaderboardSearch] = useState("");
  const [lastLeaderboardSignature, setLastLeaderboardSignature] = useState<string>("");

  const [donationAmount, setDonationAmount] = useState("99");
  const [donationNote, setDonationNote] = useState("");
  const [donating, setDonating] = useState(false);
  const [donationFeedback, setDonationFeedback] = useState<DonationFeedback | null>(null);

  const [newDisplayName, setNewDisplayName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [generatingName, setGeneratingName] = useState(false);
  const [suggestedDisplayName, setSuggestedDisplayName] = useState<string | null>(null);
  const [suggestedDisplayNameKey, setSuggestedDisplayNameKey] = useState<string | null>(null);
  const [confirmSuggestionOpen, setConfirmSuggestionOpen] = useState(false);
  const [checkingName, setCheckingName] = useState(false);
  const [nameAvailability, setNameAvailability] = useState<"idle" | "available" | "taken">("idle");

  const [loggingOut, setLoggingOut] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);

  const currentFeedType =
    activeTab === "images" ? "image" : activeTab === "videos" ? "video" : undefined;
  const isContentTab = CONTENT_TABS.includes(activeTab);

  const feedTitle =
    activeTab === "home"
      ? "Today’s private drop"
      : activeTab === "drops"
        ? "All drops"
        : activeTab === "images"
        ? "Image drops"
          : "Video drops";

  const selectTab = useCallback((tab: MemberTab) => {
    setActiveTab(tab);
  }, []);

  const ensureCheckoutScript = useCallback(async () => {
    if (typeof window === "undefined") {
      return false;
    }

    if (window.Razorpay) {
      return true;
    }

    const existing = document.querySelector<HTMLScriptElement>("script[data-rzp-checkout='1']");
    if (existing) {
      for (let index = 0; index < 20; index += 1) {
        if (window.Razorpay) {
          return true;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return Boolean(window.Razorpay);
    }

    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.dataset.rzpCheckout = "1";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load checkout script"));
      document.body.appendChild(script);
    }).catch(() => undefined);

    return Boolean(window.Razorpay);
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      setLoadingProfile(true);
      const response = await fetch("/api/member/profile", {
        method: "GET",
        cache: "no-store"
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Unable to load profile");
      }

      const next = payload.data as MemberProfileResponse;
      setProfile(next);
      setNewDisplayName(next.profile.displayName);
      setSuggestedDisplayName(null);
      setSuggestedDisplayNameKey(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load profile");
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  const loadFeed = useCallback(
    async ({ cursor, reset }: { cursor?: string; reset: boolean }) => {
      try {
        if (reset) {
          setFeedLoading(true);
          setFeedError(null);
        } else {
          setFeedLoadingMore(true);
        }

        const params = new URLSearchParams();
        if (cursor) {
          params.set("cursor", cursor);
        }
        if (currentFeedType) {
          params.set("type", currentFeedType);
        }
        const trimmedSearch = contentSearch.trim();
        if (trimmedSearch && activeTab !== "home") {
          params.set("q", trimmedSearch);
        }

        const response = await fetch(`/api/content/feed?${params.toString()}`, {
          method: "GET",
          cache: "no-store"
        });
        const payload = await response.json();

        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "Unable to load drops");
        }

        const data = payload.data as FeedResponse;
        setFeedItems((previous) => (reset ? data.items : [...previous, ...data.items]));
        setFeedCursor(data.nextCursor);
        setFeedError(null);
      } catch (error) {
        setFeedError(error instanceof Error ? error.message : "Unable to load drops");
      } finally {
        setFeedLoading(false);
        setFeedLoadingMore(false);
      }
    },
    [activeTab, contentSearch, currentFeedType]
  );

  const loadLeaderboard = useCallback(
    async ({
      page = leaderboardPage,
      query = leaderboardSearch,
      playSound = false
    }: {
      page?: number;
      query?: string;
      playSound?: boolean;
    } = {}) => {
      try {
        setLeaderboardLoading(true);

        const params = new URLSearchParams({
          page: String(page),
          pageSize: "12"
        });
        if (query.trim()) {
          params.set("q", query.trim());
        }

        const response = await fetch(`/api/member/leaderboard?${params.toString()}`, {
          method: "GET",
          cache: "no-store"
        });
        const payload = await response.json();

        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "Unable to load leaderboard");
        }

        const nextData = payload.data as LeaderboardResponse;
        const signature = JSON.stringify({
          top: nextData.topThree.map((item) => [item.userId, item.donationTotal]),
          page: nextData.items.map((item) => [item.userId, item.donationTotal])
        });

        if (playSound && lastLeaderboardSignature && lastLeaderboardSignature !== signature) {
          playLeaderboardChime(audioContextRef);
        }

        setLastLeaderboardSignature(signature);
        setLeaderboard(nextData);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to load leaderboard");
      } finally {
        setLeaderboardLoading(false);
      }
    },
    [lastLeaderboardSignature, leaderboardPage, leaderboardSearch]
  );

  useEffect(() => {
    void loadProfile();
    void loadLeaderboard({ page: 1 });
  }, [loadProfile, loadLeaderboard]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setContentSearch(contentSearchInput.trim());
    }, 280);

    return () => window.clearTimeout(timer);
  }, [contentSearchInput]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const trimmed = leaderboardSearchInput.trim();
      setLeaderboardSearch(trimmed);
      setLeaderboardPage(1);
    }, 280);

    return () => window.clearTimeout(timer);
  }, [leaderboardSearchInput]);

  useEffect(() => {
    if (!isContentTab) {
      return;
    }

    void loadFeed({ reset: true });
  }, [activeTab, contentSearch, isContentTab, loadFeed]);

  useEffect(() => {
    if (activeTab !== "leaderboard") {
      return;
    }

    void loadLeaderboard({ page: leaderboardPage, query: leaderboardSearch, playSound: true });
  }, [activeTab, leaderboardPage, leaderboardSearch, loadLeaderboard]);

  useEffect(() => {
    const handle = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }

      if (activeTab === "leaderboard") {
        void loadLeaderboard({ page: leaderboardPage, query: leaderboardSearch, playSound: true });
      }
    }, 20_000);

    return () => window.clearInterval(handle);
  }, [activeTab, leaderboardPage, leaderboardSearch, loadLeaderboard]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.sessionStorage.setItem(MEMBER_TAB_STORAGE_KEY, activeTab);
    const url = new URL(window.location.href);
    if (url.hash.replace(/^#/, "") !== activeTab) {
      url.hash = activeTab;
      window.history.replaceState(window.history.state, "", url.toString());
    }
  }, [activeTab]);

  useEffect(() => {
    const normalized = newDisplayName.trim();
    if (!normalized || !profile) {
      setNameAvailability("idle");
      return;
    }

    if (normalized === profile.profile.displayName) {
      setNameAvailability("idle");
      return;
    }

    let cancelled = false;
    setCheckingName(true);

    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ checkName: normalized });
        const response = await fetch(`/api/member/profile?${params.toString()}`, {
          method: "GET",
          cache: "no-store"
        });
        const payload = await response.json();

        if (!cancelled) {
          const available = Boolean(response.ok && payload?.ok && payload?.data?.available);
          setNameAvailability(available ? "available" : "taken");
        }
      } catch {
        if (!cancelled) {
          setNameAvailability("idle");
        }
      } finally {
        if (!cancelled) {
          setCheckingName(false);
        }
      }
    }, 360);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [newDisplayName, profile]);

  const latestDrop = feedItems[0] || null;

  const handleLoadMore = async () => {
    if (!feedCursor || feedLoadingMore) {
      return;
    }
    await loadFeed({ cursor: feedCursor, reset: false });
  };

  const submitDonation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const numericAmount = numericDonationAmount;
    if (!Number.isFinite(numericAmount) || numericAmount < 1) {
      toast.error("Enter a valid amount");
      setDonationFeedback({
        tone: "error",
        title: "Invalid amount",
        body: "Enter a valid donation amount and try again."
      });
      return;
    }

    const checkoutReady = await ensureCheckoutScript();
    if (!checkoutReady) {
      toast.error("Secure checkout is still loading. Please try again.");
      setDonationFeedback({
        tone: "error",
        title: "Checkout unavailable",
        body: "Secure payment script is still loading. Please retry in a moment."
      });
      return;
    }

    setDonationFeedback({
      tone: "pending",
      title: "Preparing secure payment",
      body: "Opening Razorpay checkout..."
    });

    const idempotencyKey =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

    let openedCheckout = false;

    try {
      setDonating(true);
      const createResponse = await fetch("/api/member/donate", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          amount: Math.floor(numericAmount),
          note: donationNote.trim() || undefined,
          idempotencyKey
        })
      });

      const createPayload = await createResponse.json();
      if (!createResponse.ok || !createPayload.ok) {
        throw new Error(createPayload.error || "Unable to start donation");
      }

      const createData = createPayload.data as DonationCreateResponse;
      if (createData.alreadyPaid) {
        if (createData.leaderboard) {
          setLeaderboard(createData.leaderboard);
        }

        void loadLeaderboard({ page: leaderboardPage, query: leaderboardSearch });

        const alreadyAmount = createData.donation?.amount || Math.floor(numericAmount);
        if (createData.donation) {
          toast.success(`Donation already counted: ${formatInr(alreadyAmount)}`);
        } else {
          toast.success("Donation already counted.");
        }
        setDonationFeedback({
          tone: "success",
          title: "Donation already recorded",
          body: `Your contribution ${formatInr(alreadyAmount)} is already in your total.`
        });
        setDonationNote("");
        void loadProfile();
        playLeaderboardChime(audioContextRef);
        return;
      }

      const RazorpayCheckout = window.Razorpay;
      if (!createData?.orderId || !createData?.keyId || !RazorpayCheckout) {
        throw new Error("Unable to open secure donation checkout.");
      }

      const razorpay = new RazorpayCheckout({
        key: createData.keyId,
        order_id: createData.orderId,
        amount: createData.amount,
        currency: createData.currency,
        name: "Alina Popova",
        description: "Support contribution",
        prefill: {
          email,
          contact: phone
        },
        notes: {
          donationId: createData.donationId
        },
        theme: {
          color: "#E64B8C"
        },
        handler: (result) => {
          void (async () => {
            try {
              setDonating(true);
              setDonationFeedback({
                tone: "pending",
                title: "Verifying payment",
                body: "Confirming payment with secure server checks..."
              });
              const verifyResponse = await fetch("/api/member/donate/verify", {
                method: "POST",
                headers: {
                  "content-type": "application/json"
                },
                body: JSON.stringify({
                  orderId: result.razorpay_order_id || createData.orderId,
                  paymentId: result.razorpay_payment_id,
                  signature: result.razorpay_signature
                })
              });

              const verifyPayload = await verifyResponse.json();
              if (!verifyResponse.ok || !verifyPayload.ok) {
                throw new Error(verifyPayload.error || "Unable to verify donation payment");
              }

              const verifyData = verifyPayload.data as DonationVerifyResponse;
              if (verifyData.leaderboard) {
                setLeaderboard(verifyData.leaderboard);
              }
              void loadLeaderboard({ page: leaderboardPage, query: leaderboardSearch });

              const confirmedAmount = verifyData.donation?.amount || Math.floor(numericAmount);
              toast.success(
                verifyData.donation?.alreadyProcessed
                  ? `Donation already confirmed: ${formatInr(confirmedAmount)}`
                  : `Donation received: ${formatInr(confirmedAmount)}`
              );
              setDonationFeedback({
                tone: "success",
                title: verifyData.donation?.alreadyProcessed
                  ? "Donation already confirmed"
                  : "Donation successful",
                body: `Recorded ${formatInr(confirmedAmount)}. Current total: ${formatInr(
                  verifyData.donation?.totalDonated || 0
                )}.`
              });
              setDonationNote("");
              void loadProfile();
              playLeaderboardChime(audioContextRef);
            } catch (error) {
              const text = error instanceof Error ? error.message : "Unable to verify donation";
              toast.error(text);
              setDonationFeedback({
                tone: "error",
                title: "Verification failed",
                body: `${text} If money was debited, tap Refresh ranking in a few seconds.`
              });
            } finally {
              setDonating(false);
            }
          })();
        },
        modal: {
          ondismiss: () => {
            setDonating(false);
            toast.message("Donation checkout closed", {
              description: "You can try again anytime."
            });
            setDonationFeedback({
              tone: "info",
              title: "Checkout closed",
              body: "No donation was recorded. You can retry anytime."
            });
          }
        }
      });

      razorpay.open();
      openedCheckout = true;
    } catch (error) {
      const text = error instanceof Error ? error.message : "Unable to submit donation";
      toast.error(text);
      setDonationFeedback({
        tone: "error",
        title: "Donation failed",
        body: text
      });
    } finally {
      if (!openedCheckout) {
        setDonating(false);
      }
    }
  };

  const saveDisplayName = useCallback(
    async (displayName: string) => {
      const normalized = displayName.trim();
      if (!normalized) {
        toast.error("Display name is required");
        return false;
      }

      try {
        setRenaming(true);
        const response = await fetch("/api/member/profile", {
          method: "PATCH",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({ displayName: normalized })
        });
        const payload = await response.json();

        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "Unable to update display name");
        }

        const nextProfile = payload.data as MemberProfileResponse;
        setProfile(nextProfile);
        setNewDisplayName(nextProfile.profile.displayName);
        setSuggestedDisplayName(null);
        setSuggestedDisplayNameKey(null);
        setNameAvailability("idle");
        toast.success("Display name updated");
        void loadLeaderboard({ page: 1, query: leaderboardSearch });
        return true;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to update display name");
        return false;
      } finally {
        setRenaming(false);
      }
    },
    [leaderboardSearch, loadLeaderboard]
  );

  const submitRename = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await saveDisplayName(newDisplayName);
  };

  const requestDisplayNameSuggestion = useCallback(
    async ({ hint, silent = false }: { hint?: string; silent?: boolean }) => {
      if (generatingName) {
        return;
      }

      try {
        setGeneratingName(true);
        const params = new URLSearchParams({ suggestName: "1" });
        const trimmedHint = (hint || "").trim();
        if (trimmedHint) {
          params.set("hint", trimmedHint);
        }

        const response = await fetch(`/api/member/profile?${params.toString()}`, {
          method: "GET",
          cache: "no-store"
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "Unable to generate a unique name");
        }

        const data = payload.data as NameSuggestionResponse;
        const suggestion = data.suggestion?.displayName;
        const suggestionKey = data.suggestion?.displayNameKey;
        if (!suggestion || !suggestionKey) {
          throw new Error("Unable to generate a unique name");
        }

        setSuggestedDisplayName(suggestion);
        setSuggestedDisplayNameKey(suggestionKey);
        if (!silent) {
          toast.success("Unique name suggestion ready");
        }
      } catch (error) {
        if (!silent) {
          toast.error(error instanceof Error ? error.message : "Unable to generate a unique name");
        }
      } finally {
        setGeneratingName(false);
      }
    },
    [generatingName]
  );

  const generateDisplayName = async () => {
    const hint = newDisplayName.trim() || profile?.profile.displayName || "";
    await requestDisplayNameSuggestion({ hint });
  };

  const dismissSuggestion = () => {
    setSuggestedDisplayName(null);
    setSuggestedDisplayNameKey(null);
    setConfirmSuggestionOpen(false);
  };

  const hasAlternativeSuggestion =
    Boolean(suggestedDisplayName) && suggestedDisplayName !== profile?.profile.displayName;
  const currentHandle =
    newDisplayName.trim().length > 0
      ? `@${newDisplayName
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 40)}`
      : "-";

  const shouldShowSavePrompt =
    newDisplayName.trim().length > 0 && newDisplayName.trim() !== profile?.profile.displayName;

  const isSaveDisabled =
    renaming ||
    !newDisplayName.trim() ||
    newDisplayName.trim() === profile?.profile.displayName ||
    nameAvailability === "taken";

  const suggestionHandle = suggestedDisplayNameKey ? `@${suggestedDisplayNameKey}` : null;

  const availabilityTone =
    checkingName || nameAvailability === "idle"
      ? "text-muted"
      : nameAvailability === "available"
        ? "text-success"
        : "text-warning";

  const statusMicrocopy = checkingName
    ? "Checking name availability..."
    : nameAvailability === "available"
      ? shouldShowSavePrompt
        ? "Name is available. Click Save to apply this change."
        : "Name is available."
      : nameAvailability === "taken"
        ? "Name is already in use. Generate another."
        : shouldShowSavePrompt
          ? "Click Save to apply this change. Leaving now keeps your original name."
          : "Use 3-28 characters. Letters, numbers, spaces, hyphen, underscore.";

  const sanitizeDonationAmount = useCallback((value: string) => value.replace(/[^0-9]/g, "").slice(0, 6), []);
  const numericDonationAmount = useMemo(() => {
    const sanitized = sanitizeDonationAmount(donationAmount);
    if (!sanitized) {
      return 0;
    }
    const parsed = Number(sanitized);
    if (!Number.isFinite(parsed)) {
      return 0;
    }
    return Math.max(0, Math.min(500_000, Math.floor(parsed)));
  }, [donationAmount, sanitizeDonationAmount]);

  const setDonationAmountFromNumber = useCallback((value: number) => {
    const normalized = Math.max(1, Math.min(500_000, Math.floor(value)));
    setDonationAmount(String(normalized));
  }, []);

  const adjustDonationAmount = useCallback(
    (delta: number) => {
      const base = numericDonationAmount > 0 ? numericDonationAmount : 49;
      setDonationAmountFromNumber(base + delta);
    },
    [numericDonationAmount, setDonationAmountFromNumber]
  );

  const donationRangeValue = Math.min(Math.max(numericDonationAmount || 49, 1), 2000);

  const logout = async () => {
    try {
      setLoggingOut(true);
      await fetch("/api/member/logout", { method: "POST" });
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("alina_site_role");
      }
      toast.success("Signed out");
      router.push("/account");
      router.refresh();
    } catch {
      toast.error("Unable to sign out. Try again.");
    } finally {
      setLoggingOut(false);
    }
  };

  const topThree = leaderboard?.topThree || [];

  const openSuggestionConfirm = () => {
    if (!suggestedDisplayName) {
      return;
    }
    setConfirmSuggestionOpen(true);
  };

  const confirmSuggestionSelection = async () => {
    if (!suggestedDisplayName) {
      return;
    }

    const saved = await saveDisplayName(suggestedDisplayName);
    if (saved) {
      setConfirmSuggestionOpen(false);
    }
  };

  const closeSuggestionConfirm = () => {
    setConfirmSuggestionOpen(false);
  };

  const totalUnlockedLabel = useMemo(() => {
    if (!feedItems.length) {
      return "No drops loaded yet";
    }
    return `${feedItems.length} loaded now`;
  }, [feedItems.length]);

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
        data-rzp-checkout="1"
      />
      <div className="space-y-6 sm:space-y-7">
      <Card className="overflow-hidden border-accent/30 bg-[radial-gradient(circle_at_85%_-20%,rgba(230,75,140,0.2),transparent_35%),#0E1018] shadow-[0_26px_64px_-42px_rgba(230,75,140,0.55)]">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.22em] text-accent">Member area</p>
              <h1 className="text-2xl font-semibold text-text sm:text-3xl">
                {loadingProfile
                  ? "Loading your private account..."
                  : `Welcome back, ${profile?.profile.displayName || "Member"}`}
              </h1>
              <p className="text-sm text-muted">
                Private content access, leaderboard, and account settings are all in one place.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 lg:w-auto">
              <div className="rounded-2xl border border-border bg-bg/60 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.12em] text-muted">Status</p>
                <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-success">
                  <ShieldCheck className="h-4 w-4" /> ACTIVE
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-bg/60 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.12em] text-muted">Rank</p>
                <p className="mt-1 text-sm font-semibold text-text">
                  {profile?.rank ? `#${profile.rank}` : "-"}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-bg/60 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.12em] text-muted">Support</p>
                <p className="mt-1 text-sm font-semibold text-text">
                  {profile ? formatInr(profile.profile.donationTotal) : formatInr(0)}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => router.push("/vip")}
              className="group relative h-12 w-full overflow-hidden rounded-2xl border border-[#E6B93D]/70 bg-[linear-gradient(135deg,#FFD77A,#E6B93D)] px-4 text-sm font-semibold text-[#2D2006] shadow-[0_18px_38px_-16px_rgba(230,185,61,0.85)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#FFE7A3] hover:brightness-105 hover:shadow-[0_22px_46px_-18px_rgba(255,215,122,0.95)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5C451]/80 sm:w-auto sm:min-w-[14rem]"
            >
              <span className="absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(255,255,255,0.28),transparent_44%)] opacity-80 transition-opacity duration-200 group-hover:opacity-100" />
              <span className="relative inline-flex items-center justify-center gap-2.5">
                <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-[#C69322]/80 bg-[#FCE9B4] text-[#7A4A00] shadow-[0_0_14px_rgba(255,235,170,0.65)]">
                  <Crown className="h-4 w-4" />
                </span>
                <span>VIP Area</span>
              </span>
            </button>
            <Button
              variant="secondary"
              className="h-11 w-full rounded-2xl sm:w-auto"
              onClick={() => router.push("/account")}
            >
              Account
            </Button>
            <Button
              variant="secondary"
              className="h-11 w-full rounded-2xl sm:w-auto"
              onClick={logout}
              disabled={loggingOut}
            >
              {loggingOut ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing out...
                </>
              ) : (
                <>
                  <LogOut className="mr-2 h-4 w-4" /> Logout
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="sm:hidden">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted">Section menu</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {MEMBER_TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;

              return (
                <button
                  key={`mobile-${tab.id}`}
                  type="button"
                  onClick={() => selectTab(tab.id)}
                  className={cn(
                    "inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium transition",
                    active
                      ? "border-accent/55 bg-accent text-white shadow-[0_10px_24px_-14px_rgba(230,75,140,0.8)]"
                      : "border-border bg-surface text-muted hover:border-accent/35 hover:text-text"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="hidden overflow-x-auto sm:block">
          <div className="flex w-max min-w-full gap-2 rounded-2xl border border-border bg-surface/70 p-2">
            {MEMBER_TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => selectTab(tab.id)}
                  className={cn(
                    "inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition",
                    active
                      ? "bg-accent text-white shadow-[0_10px_24px_-14px_rgba(230,75,140,0.8)]"
                      : "text-muted hover:bg-bg/60 hover:text-text"
                  )}
                >
                  <Icon className="h-4 w-4" /> {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {activeTab === "home" ? (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Today’s drop</CardTitle>
                <CardDescription>{latestDrop ? latestDrop.title : "No drop available yet"}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted">
                {latestDrop ? formatPublishedAt(latestDrop.publishedAt) : "New content appears automatically."}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Current rank</CardTitle>
                <CardDescription>Leaderboard position</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted">
                {profile?.rank ? `You are #${profile.rank}` : "Rank not available yet"}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Unlocked content</CardTitle>
                <CardDescription>Loaded in this session</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted">{totalUnlockedLabel}</CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{feedTitle}</CardTitle>
              <CardDescription>Your newest private content appears here first.</CardDescription>
            </CardHeader>
            <CardContent>
              {feedLoading ? (
                <FeedSkeletonGrid />
              ) : latestDrop ? (
                <div className="space-y-4">
                  <FeedCard item={latestDrop} />
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Button variant="secondary" className="w-full sm:w-auto" onClick={() => selectTab("drops")}>
                      Browse all drops <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      className="w-full sm:w-auto"
                      onClick={() => selectTab("leaderboard")}
                    >
                      Open leaderboard
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted">No drops published yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Top supporters</CardTitle>
              <CardDescription>Live leaderboard rankings update while members donate.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-3">
                {topThree.length ? (
                  topThree.map((entry) => (
                    <div
                      key={entry.userId}
                      className={cn(
                        "relative overflow-hidden rounded-2xl border px-4 py-4",
                        rankStyles[entry.rank] || "border-border bg-bg/60"
                      )}
                    >
                      <Crown className="absolute -right-1 -top-1 h-10 w-10 opacity-20" />
                      <p className="text-xs uppercase tracking-[0.14em]">#{entry.rank}</p>
                      <p className="mt-2 text-sm font-semibold">{entry.displayName}</p>
                      <p className="mt-1 text-xs">{formatInr(entry.donationTotal)}</p>
                    </div>
                  ))
                ) : (
                  <p className="col-span-3 text-sm text-muted">Leaderboard data will appear after member activity.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeTab === "drops" || activeTab === "images" || activeTab === "videos" ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{feedTitle}</CardTitle>
              <CardDescription>
                Search by title or tag. Results are filtered instantly for this section.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input
                  value={contentSearchInput}
                  onChange={(event) => setContentSearchInput(event.target.value)}
                  className="h-11 rounded-2xl pl-9"
                  placeholder="Search drops by title or tag"
                />
              </div>

              {feedError ? <p className="text-sm text-danger">{feedError}</p> : null}

              <div className="rounded-2xl border border-border/80 bg-bg/45 px-3 py-3 sm:px-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted">
                    {feedItems.length
                      ? `${feedItems.length} drops loaded in this view`
                      : "No published drops found for this section yet."}
                  </p>
                  {feedCursor ? (
                    <p className="text-xs font-medium text-accent">More content is available below.</p>
                  ) : null}
                </div>
              </div>

              {feedLoading ? (
                <FeedSkeletonGrid />
              ) : feedItems.length ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {feedItems.map((item) => (
                      <FeedCard key={item._id} item={item} />
                    ))}
                  </div>
                  {feedCursor ? (
                    <div className="flex justify-center">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleLoadMore}
                        disabled={feedLoadingMore}
                        className="h-11 w-full rounded-2xl sm:w-auto"
                      >
                        {feedLoadingMore ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
                          </>
                        ) : (
                          "Load more"
                        )}
                      </Button>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-muted">No matching content found for this section.</p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeTab === "leaderboard" ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Leaderboard</CardTitle>
              <CardDescription>Top 3 are highlighted with medal tiers.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                {[1, 2, 3].map((rank) => {
                  const entry = leaderboard?.topThree.find((item) => item.rank === rank);
                  const medal = rank === 1 ? "Gold" : rank === 2 ? "Silver" : "Bronze";
                  const medalIconColor =
                    rank === 1
                      ? "text-[#F1D89A]"
                      : rank === 2
                        ? "text-[#E1E7F4]"
                        : "text-[#EFC7A2]";

                  return (
                    <div
                      key={`medal-${rank}`}
                      className={cn(
                        "relative overflow-hidden rounded-2xl border p-4",
                        rankStyles[rank] || "border-border bg-bg/65"
                      )}
                    >
                      <Crown
                        className={cn(
                          "absolute -right-3 -top-3 h-14 w-14 opacity-25",
                          medalIconColor
                        )}
                      />
                      <p className="text-[11px] uppercase tracking-[0.14em]">{medal} rank</p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-current/35 bg-bg/45 text-sm font-semibold">
                          <span className="relative z-10">{rank}</span>
                          <Medal className="absolute -bottom-2 -right-2 h-4 w-4 opacity-80" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-text">
                            {entry?.displayName || "Open"}
                          </p>
                          <p className="text-xs text-muted">
                            {entry ? formatInr(entry.donationTotal) : "No donation yet"}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Separator />

              <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <Input
                      value={leaderboardSearchInput}
                      onChange={(event) => setLeaderboardSearchInput(event.target.value)}
                      className="h-11 rounded-2xl pl-9"
                      placeholder="Search member names"
                    />
                  </div>

                  <div className="sm:hidden">
                    {leaderboardLoading ? (
                      <p className="rounded-2xl border border-border/80 bg-bg/55 px-4 py-6 text-sm text-muted">
                        Loading leaderboard...
                      </p>
                    ) : leaderboard?.items.length ? (
                      <div className="space-y-2">
                        {leaderboard.items.map((item) => (
                          <article
                            key={`${item.userId}-${item.rank}`}
                            className={cn(
                              "rounded-2xl border border-border/80 bg-bg/55 p-3",
                              item.isCurrentMember && "border-accent/40 bg-accent/10"
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-text">
                                <Trophy className="h-4 w-4 text-accent" /> #{item.rank}
                              </p>
                              <p className="text-sm font-semibold text-text">
                                {formatInr(item.donationTotal)}
                              </p>
                            </div>
                            <p className="mt-1 truncate text-sm font-medium text-text">{item.displayName}</p>
                            <p className="text-xs text-muted">@{item.displayNameKey}</p>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-2xl border border-border/80 bg-bg/55 px-4 py-6 text-sm text-muted">
                        No members found for this search.
                      </p>
                    )}
                  </div>

                  <div className="hidden overflow-hidden rounded-2xl border border-border/80 sm:block">
                    <div className="grid grid-cols-[70px_1fr_auto] border-b border-border bg-bg/65 px-4 py-2 text-xs uppercase tracking-[0.14em] text-muted">
                      <p>Rank</p>
                      <p>Member</p>
                      <p>Donated</p>
                    </div>

                    <div className="divide-y divide-border/60">
                      {leaderboardLoading ? (
                        <p className="px-4 py-6 text-sm text-muted">Loading leaderboard...</p>
                      ) : leaderboard?.items.length ? (
                        leaderboard.items.map((item) => (
                          <div
                            key={`${item.userId}-${item.rank}`}
                            className={cn(
                              "grid grid-cols-[70px_1fr_auto] items-center gap-2 px-4 py-3 text-sm",
                              item.isCurrentMember && "bg-accent/10"
                            )}
                          >
                            <p className="font-semibold text-text">#{item.rank}</p>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-text">{item.displayName}</p>
                              <p className="text-xs text-muted">@{item.displayNameKey}</p>
                            </div>
                            <p className="font-semibold text-text">{formatInr(item.donationTotal)}</p>
                          </div>
                        ))
                      ) : (
                        <p className="px-4 py-6 text-sm text-muted">No members found for this search.</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted">
                      {leaderboard?.pagination.total || 0} members • Page {leaderboard?.pagination.page || 1} / {leaderboard?.pagination.totalPages || 1}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="flex-1 rounded-xl sm:flex-none"
                        disabled={!leaderboard?.pagination.hasPrev || leaderboardLoading}
                        onClick={() => setLeaderboardPage((current) => Math.max(1, current - 1))}
                      >
                        <ChevronLeft className="mr-1 h-4 w-4" /> Prev
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="flex-1 rounded-xl sm:flex-none"
                        disabled={!leaderboard?.pagination.hasNext || leaderboardLoading}
                        onClick={() =>
                          setLeaderboardPage((current) =>
                            Math.min(leaderboard?.pagination.totalPages || current, current + 1)
                          )
                        }
                      >
                        Next <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <Card className="border-border/80 bg-bg/55 lg:sticky lg:top-24">
                  <CardHeader>
                    <CardTitle className="text-base">Support leaderboard</CardTitle>
                    <CardDescription>Add your contribution and climb ranks.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form className="space-y-3" onSubmit={submitDonation}>
                      <div className="space-y-2">
                        <Label htmlFor="donation-amount">Amount (INR)</Label>
                        <div className="space-y-3 rounded-2xl border border-accent/30 bg-[radial-gradient(circle_at_92%_0%,rgba(230,75,140,0.17),transparent_34%),#0C0F18] p-3">
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="icon"
                              variant="secondary"
                              className="h-10 w-10 rounded-xl border-accent/35 bg-bg/70"
                              onClick={() => adjustDonationAmount(-50)}
                              disabled={donating || numericDonationAmount <= 1}
                              aria-label="Decrease amount"
                            >
                              <Minus className="h-4 w-4" />
                            </Button>

                            <div className="relative flex-1">
                              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-accent">
                                ₹
                              </span>
                              <Input
                                id="donation-amount"
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={donationAmount}
                                onChange={(event) => setDonationAmount(sanitizeDonationAmount(event.target.value))}
                                onBlur={() => {
                                  if (!numericDonationAmount) {
                                    setDonationAmount("49");
                                  }
                                }}
                                className="h-11 rounded-xl border-accent/30 bg-bg/75 pl-8 text-base font-semibold tracking-wide text-text focus-visible:ring-accent/70"
                                placeholder="Enter amount"
                                aria-label="Donation amount in rupees"
                              />
                            </div>

                            <Button
                              type="button"
                              size="icon"
                              variant="secondary"
                              className="h-10 w-10 rounded-xl border-accent/35 bg-bg/70"
                              onClick={() => adjustDonationAmount(50)}
                              disabled={donating}
                              aria-label="Increase amount"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>

                          <input
                            type="range"
                            min={1}
                            max={2000}
                            step={1}
                            value={donationRangeValue}
                            onChange={(event) => setDonationAmountFromNumber(Number(event.target.value))}
                            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-border accent-[#E64B8C]"
                            aria-label="Donation amount slider"
                          />

                          <div className="flex items-center justify-between text-[11px] text-muted">
                            <span>Min ₹1</span>
                            <span className="font-medium text-text">Selected {formatInr(numericDonationAmount || 0)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {[49, 99, 199, 499, 999].map((amount) => (
                          <Button
                            key={amount}
                            type="button"
                            size="sm"
                            variant={numericDonationAmount === amount ? "default" : "secondary"}
                            className={cn(
                              "rounded-xl",
                              numericDonationAmount === amount && "shadow-[0_10px_24px_-16px_rgba(230,75,140,0.7)]"
                            )}
                            onClick={() => setDonationAmountFromNumber(amount)}
                          >
                            {formatInr(amount)}
                          </Button>
                        ))}
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="donation-note">Message (optional)</Label>
                        <Input
                          id="donation-note"
                          value={donationNote}
                          onChange={(event) => setDonationNote(event.target.value)}
                          className="h-11 rounded-2xl"
                          placeholder="Keep going"
                          maxLength={180}
                        />
                      </div>

                      <Button type="submit" className="h-11 w-full rounded-2xl" disabled={donating}>
                        {donating ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
                          </>
                        ) : (
                          "Donate"
                        )}
                      </Button>

                      <p className="text-xs text-muted">
                        Your current total:{" "}
                        {formatInr(
                          profile?.profile.donationTotal ?? leaderboard?.currentMemberDonationTotal ?? 0
                        )}
                      </p>

                      {donationFeedback ? (
                        <div
                          className={cn(
                            "space-y-2 rounded-2xl border p-3 text-sm",
                            donationFeedback.tone === "success" && "border-success/45 bg-success/10",
                            donationFeedback.tone === "error" && "border-danger/45 bg-danger/10",
                            donationFeedback.tone === "pending" && "border-accent/35 bg-accent/10",
                            donationFeedback.tone === "info" && "border-border/80 bg-bg/45"
                          )}
                        >
                          <div className="flex items-start gap-2.5">
                            {donationFeedback.tone === "pending" ? (
                              <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-accent" />
                            ) : donationFeedback.tone === "success" ? (
                              <Check className="mt-0.5 h-4 w-4 text-success" />
                            ) : donationFeedback.tone === "error" ? (
                              <AlertTriangle className="mt-0.5 h-4 w-4 text-danger" />
                            ) : (
                              <Info className="mt-0.5 h-4 w-4 text-muted" />
                            )}
                            <div className="space-y-1">
                              <p className="font-semibold text-text">{donationFeedback.title}</p>
                              <p className="text-xs text-muted">{donationFeedback.body}</p>
                            </div>
                          </div>

                          {donationFeedback.tone !== "pending" ? (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                className="rounded-xl"
                                onClick={() => {
                                  void loadLeaderboard({
                                    page: leaderboardPage,
                                    query: leaderboardSearch,
                                    playSound: false
                                  });
                                  void loadProfile();
                                }}
                              >
                                Refresh ranking
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                className="rounded-xl"
                                onClick={() => setDonationFeedback(null)}
                              >
                                Dismiss
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </form>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeTab === "profile" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Profile settings</CardTitle>
              <CardDescription>Update your public leaderboard identity.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={submitRename}>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="member-display-name">Display name</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-8 rounded-xl px-3 text-xs"
                      onClick={generateDisplayName}
                      disabled={generatingName}
                    >
                      {generatingName ? (
                        <>
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Generate new name
                        </>
                      )}
                    </Button>
                  </div>
                  <Input
                    id="member-display-name"
                    value={newDisplayName}
                    onChange={(event) => setNewDisplayName(event.target.value)}
                    className="h-11 rounded-2xl"
                    placeholder="Enter your public display name"
                    maxLength={28}
                  />
                </div>

                <p className="text-xs text-muted">Current handle: {currentHandle}</p>

                {generatingName || hasAlternativeSuggestion ? (
                  <div
                    className={cn(
                      "space-y-2 rounded-2xl border p-3",
                      hasAlternativeSuggestion ? "border-accent/35 bg-accent/10" : "border-border/80 bg-bg/45"
                    )}
                  >
                    <p className="text-xs uppercase tracking-[0.12em] text-muted">
                      {generatingName ? "Generating suggestion" : "Suggested unique name"}
                    </p>
                    {generatingName ? (
                      <p className="text-sm text-muted">Finding a unique name...</p>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-text">{suggestedDisplayName}</p>
                        {suggestionHandle ? <p className="text-xs text-muted">{suggestionHandle}</p> : null}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className="rounded-xl"
                            onClick={openSuggestionConfirm}
                            disabled={renaming}
                          >
                            Use suggestion
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="rounded-xl"
                            onClick={dismissSuggestion}
                            disabled={renaming}
                          >
                            Keep original
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ) : null}

                <p
                  className={cn(
                    "text-xs",
                    availabilityTone
                  )}
                >
                  {statusMicrocopy}
                </p>

                {shouldShowSavePrompt ? (
                  <Button className="h-11 w-full rounded-2xl" disabled={isSaveDisabled} type="submit">
                    {renaming ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                      </>
                    ) : (
                      "Save display name"
                    )}
                  </Button>
                ) : null}
              </form>

              <Separator className="my-4" />

              <Button variant="secondary" className="h-11 w-full rounded-2xl" onClick={logout} disabled={loggingOut}>
                {loggingOut ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Logging out...
                  </>
                ) : (
                  <>
                    <LogOut className="mr-2 h-4 w-4" /> Logout from this device
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Account details</CardTitle>
              <CardDescription>Subscription and identity info for this device session.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-2xl border border-border bg-bg/45 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-muted">Display</p>
                <p className="mt-1 font-semibold text-text">{profile?.profile.displayName || "-"}</p>
                <p className="text-xs text-muted">@{profile?.profile.displayNameKey || "-"}</p>
              </div>

              <div className="rounded-2xl border border-border bg-bg/45 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-muted">Subscription</p>
                <p className="mt-1 font-mono text-xs text-text">{subscriptionId}</p>
              </div>

              <div className="rounded-2xl border border-border bg-bg/45 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-muted">Contact</p>
                <p className="mt-1 text-text">{email || "No email"}</p>
                <p className="text-muted">{phone || "No phone"}</p>
              </div>

              <Button variant="secondary" className="h-11 w-full rounded-2xl" onClick={() => router.push("/support")}>
                Support
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {confirmSuggestionOpen ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-bg/80 p-4 backdrop-blur sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-suggestion-title"
            className="w-full max-w-md rounded-3xl border border-border bg-surface p-5 shadow-rose sm:p-6"
          >
            <div className="space-y-3">
              <p className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                <Sparkles className="h-3.5 w-3.5" /> Confirm suggestion
              </p>
              <div>
                <h3 id="confirm-suggestion-title" className="text-lg font-semibold text-text">
                  Use this suggested name?
                </h3>
                <p className="mt-1 text-sm text-muted">
                  {suggestedDisplayName ? (
                    <>
                      <span className="font-semibold text-text">{suggestedDisplayName}</span>
                      {suggestedDisplayNameKey ? (
                        <span className="ml-2 text-xs text-muted">@{suggestedDisplayNameKey}</span>
                      ) : null}
                    </>
                  ) : (
                    "No suggestion found."
                  )}
                </p>
                <p className="mt-2 text-xs text-muted">
                  Confirm will save this name immediately across your member account.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  variant="secondary"
                  className="h-11 rounded-2xl"
                  onClick={closeSuggestionConfirm}
                  disabled={renaming}
                >
                  Cancel
                </Button>
                <Button
                  className="h-11 rounded-2xl"
                  onClick={confirmSuggestionSelection}
                  disabled={renaming}
                >
                  {renaming ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    "Confirm & save"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      </div>
    </>
  );
}
