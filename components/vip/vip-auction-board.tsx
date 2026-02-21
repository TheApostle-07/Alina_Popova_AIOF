"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpCircle,
  CalendarClock,
  Clock3,
  Crown,
  Gem,
  Gavel,
  Loader2,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Trophy
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type VipAuctionStatus = "DRAFT" | "SCHEDULED" | "LIVE" | "ENDED" | "CANCELLED" | "SETTLED";

type VipRecentBid = {
  id: string;
  amount: number;
  bidderLabel: string;
  placedAt: string;
  isCurrentMember: boolean;
};

type VipAuctionCard = {
  id: string;
  title: string;
  description: string | null;
  status: VipAuctionStatus;
  durationMinutes: number;
  callStartsAt: string;
  biddingStartsAt: string;
  biddingEndsAt: string;
  startingBidAmount: number;
  minIncrement: number;
  currentBidAmount: number | null;
  bidCount: number;
  minimumNextBid: number;
  leadingBidderLabel: string | null;
  leadingBidderIsCurrentMember: boolean;
  myTopBidAmount: number | null;
  meetingJoinUrl: string | null;
  topBidders: Array<{
    rank: 1 | 2 | 3;
    amount: number;
    bidderLabel: string;
    isCurrentMember: boolean;
    lastBidAt: string;
  }>;
  recentBids: VipRecentBid[];
};

type VipAuctionBoardData = {
  serverTime: string;
  live: VipAuctionCard[];
  upcoming: VipAuctionCard[];
  past: VipAuctionCard[];
};

type BidSubmitResult =
  | {
      ok: true;
      message: string;
      board: VipAuctionBoardData;
      autoExtended: boolean;
      alreadyProcessed: boolean;
    }
  | {
      ok: false;
      message: string;
      code?: string;
      minRequired?: number;
    };

function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value || 0);
}

function formatIST(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata"
  }).format(new Date(value));
}

function formatCountdown(targetIso: string, nowMs: number) {
  const diffMs = new Date(targetIso).getTime() - nowMs;
  if (diffMs <= 0) {
    return "00:00";
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function makeIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `vip_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function statusBadgeVariant(status: VipAuctionStatus): "default" | "success" | "warning" | "danger" {
  if (status === "LIVE" || status === "SETTLED") {
    return "success";
  }
  if (status === "SCHEDULED" || status === "ENDED") {
    return "warning";
  }
  if (status === "CANCELLED") {
    return "danger";
  }
  return "default";
}

function topBidderBadgeClass(rank: 1 | 2 | 3) {
  if (rank === 1) {
    return "border-[#E6B93D]/55 bg-[linear-gradient(140deg,rgba(230,185,61,0.22),rgba(230,75,140,0.1))] text-[#F5C451]";
  }
  if (rank === 2) {
    return "border-[#9FB5E8]/45 bg-[linear-gradient(140deg,rgba(159,181,232,0.2),rgba(124,155,255,0.08))] text-[#C6D3F2]";
  }
  return "border-accent/35 bg-accent/10 text-accent";
}

function AuctionCard({
  item,
  nowMs,
  submitting,
  onOpenBidModal
}: {
  item: VipAuctionCard;
  nowMs: number;
  submitting: boolean;
  onOpenBidModal: () => void;
}) {
  const liveTimer = formatCountdown(item.biddingEndsAt, nowMs);
  const startsInTimer = formatCountdown(item.biddingStartsAt, nowMs);
  const statusVariant = statusBadgeVariant(item.status);
  const countdownLabel =
    item.status === "LIVE" ? `Ends in ${liveTimer}` : item.status === "SCHEDULED" ? `Starts in ${startsInTimer}` : "Closed";

  return (
    <Card className="vip-slot-card group relative overflow-hidden border-border/85 bg-surface/88">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-accent/80 to-transparent opacity-70" />
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge variant={statusVariant}>{item.status}</Badge>
          <span className="text-xs text-muted">{item.durationMinutes} min call</span>
        </div>
        <div>
          <CardTitle className="text-xl">{item.title}</CardTitle>
          <CardDescription className="mt-1 text-sm leading-relaxed">
            {item.description || "Private 1:1 VIP call slot with clear boundaries and respectful format."}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <p className="rounded-xl border border-border/80 bg-bg/45 px-3 py-2 text-muted">
            <CalendarClock className="mr-1.5 inline h-4 w-4 text-accent" />
            Call: {formatIST(item.callStartsAt)}
          </p>
          <p className="rounded-xl border border-border/80 bg-bg/45 px-3 py-2 text-muted">
            <Clock3 className="mr-1.5 inline h-4 w-4 text-accent" />
            {countdownLabel}
          </p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-bg/45 p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-muted">Current bid</p>
          <p className="mt-1 text-2xl font-semibold text-text">
            {formatInr(item.currentBidAmount ?? item.startingBidAmount)}
          </p>
          <p className="mt-1 text-xs text-muted">
            Minimum next bid: <span className="text-text">{formatInr(item.minimumNextBid)}</span>
          </p>
          <p className="mt-1 text-xs text-muted">
            Leading:{" "}
            <span className={item.leadingBidderIsCurrentMember ? "text-success" : "text-text"}>
              {item.leadingBidderLabel || "No bids yet"}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted">Total bids: {item.bidCount}</p>
        </div>

        {item.topBidders.length ? (
          <div className="space-y-2 rounded-2xl border border-border/80 bg-bg/50 p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-muted">Top 3 bidders</p>
            <div className="space-y-1.5">
              {item.topBidders.map((row) => (
                <div
                  key={`${item.id}-rank-${row.rank}-${row.bidderLabel}`}
                  className={`flex items-center justify-between rounded-xl border px-2.5 py-2 text-xs ${topBidderBadgeClass(row.rank)}`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {row.rank === 1 ? (
                      <Crown className="h-3.5 w-3.5" />
                    ) : row.rank === 2 ? (
                      <Gem className="h-3.5 w-3.5" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    <span className={row.isCurrentMember ? "font-semibold text-success" : ""}>
                      #{row.rank} {row.bidderLabel}
                    </span>
                  </span>
                  <span className="font-semibold">{formatInr(row.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/80 bg-bg/50 p-3 text-xs text-muted">
            Top bidder board appears once bids are placed.
          </div>
        )}

        {item.status === "LIVE" ? (
          <div className="space-y-3 rounded-2xl border border-accent/35 bg-[linear-gradient(140deg,rgba(230,75,140,0.16),rgba(124,155,255,0.08))] p-3">
            <Button
              className="h-12 w-full rounded-xl text-base"
              onClick={onOpenBidModal}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Placing bid...
                </>
              ) : (
                <>
                  <Gavel className="mr-2 h-4 w-4" />
                  Place Bid
                </>
              )}
            </Button>
            <p className="text-xs text-muted">
              Outbid allowed. Last-minute bids may extend timer for fair competition.
            </p>
          </div>
        ) : null}

        {item.status === "ENDED" && item.leadingBidderIsCurrentMember ? (
          <div className="rounded-2xl border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
            Timer ended. Finalizing winner automatically. Refresh in a few seconds.
          </div>
        ) : null}

        {item.status === "SETTLED" && item.leadingBidderIsCurrentMember && !item.meetingJoinUrl ? (
          <div className="rounded-2xl border border-success/40 bg-success/10 p-3 text-xs text-success">
            Slot booked successfully. A confirmation email is sent to your registered email. Meeting link
            will follow shortly.
          </div>
        ) : null}

        {item.status === "SETTLED" && item.leadingBidderIsCurrentMember && item.meetingJoinUrl ? (
          <Button asChild className="w-full">
            <a href={item.meetingJoinUrl} target="_blank" rel="noreferrer">
              Join call link
            </a>
          </Button>
        ) : null}

        <div className="space-y-2 rounded-2xl border border-border/80 bg-bg/40 p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-muted">Recent bids</p>
          {item.recentBids.length ? (
            <div className="space-y-1.5">
              {item.recentBids.map((bid) => (
                <div
                  key={bid.id}
                  className="flex items-center justify-between rounded-lg border border-border/70 bg-bg/55 px-2.5 py-2 text-xs"
                >
                  <span className={bid.isCurrentMember ? "text-success" : "text-muted"}>
                    {bid.bidderLabel}
                  </span>
                  <span className="font-medium text-text">{formatInr(bid.amount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted">No bids yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function VipAuctionBoard({ initialData }: { initialData: VipAuctionBoardData }) {
  const [board, setBoard] = useState<VipAuctionBoardData>(initialData);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [submittingByAuction, setSubmittingByAuction] = useState<Record<string, boolean>>({});
  const [bidModalAuctionId, setBidModalAuctionId] = useState<string | null>(null);
  const [bidModalAmount, setBidModalAmount] = useState("");
  const [bidModalError, setBidModalError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const bidInputRef = useRef<HTMLInputElement | null>(null);
  const activeBidAuction = useMemo(
    () => board.live.find((row) => row.id === bidModalAuctionId) || null,
    [board.live, bidModalAuctionId]
  );

  const loadBoard = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/vip/auctions", {
        method: "GET",
        cache: "no-store",
        credentials: "include"
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Unable to load VIP board");
      }
      setBoard(payload.data as VipAuctionBoardData);
      setErrorText(null);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Unable to load VIP board");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const poll = window.setInterval(() => {
      void loadBoard();
    }, 8000);
    return () => window.clearInterval(poll);
  }, [loadBoard]);

  const submitBid = useCallback(async (auctionId: string, amount: number): Promise<BidSubmitResult> => {
    try {
      setSubmittingByAuction((current) => ({ ...current, [auctionId]: true }));
      const response = await fetch("/api/vip/bids", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          auctionId,
          amount,
          idempotencyKey: makeIdempotencyKey()
        })
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            error?: string;
            code?: string;
            minRequired?: number;
            data?: {
              message?: string;
              board?: VipAuctionBoardData;
              autoExtended?: boolean;
              alreadyProcessed?: boolean;
            };
          }
        | null;
      if (!response.ok || !payload?.ok || !payload.data?.board) {
        return {
          ok: false,
          message: payload?.error || "Bid rejected",
          code: payload?.code,
          minRequired:
            typeof payload?.minRequired === "number" && Number.isFinite(payload.minRequired)
              ? payload.minRequired
              : undefined
        };
      }

      return {
        ok: true,
        message: payload.data.message || "Bid placed successfully",
        board: payload.data.board,
        autoExtended: Boolean(payload.data.autoExtended),
        alreadyProcessed: Boolean(payload.data.alreadyProcessed)
      };
    } finally {
      setSubmittingByAuction((current) => ({ ...current, [auctionId]: false }));
    }
  }, []);

  const closeBidModal = useCallback(() => {
    if (activeBidAuction && submittingByAuction[activeBidAuction.id]) {
      return;
    }
    setBidModalAuctionId(null);
    setBidModalAmount("");
    setBidModalError(null);
  }, [activeBidAuction, submittingByAuction]);

  const openBidModal = useCallback((auction: VipAuctionCard) => {
    setBidModalAuctionId(auction.id);
    setBidModalAmount(String(auction.minimumNextBid));
    setBidModalError(null);
  }, []);

  useEffect(() => {
    if (!bidModalAuctionId) {
      return;
    }
    window.setTimeout(() => {
      bidInputRef.current?.focus();
      bidInputRef.current?.select();
    }, 45);
  }, [bidModalAuctionId]);

  useEffect(() => {
    if (!bidModalAuctionId) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [bidModalAuctionId]);

  useEffect(() => {
    if (!bidModalAuctionId) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeBidModal();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [bidModalAuctionId, closeBidModal]);

  useEffect(() => {
    if (!bidModalAuctionId) {
      return;
    }
    const latestLive = board.live.find((row) => row.id === bidModalAuctionId);
    if (!latestLive) {
      setBidModalError("This slot is no longer live. Please refresh and choose another slot.");
      return;
    }

    if (submittingByAuction[latestLive.id]) {
      return;
    }

    if (bidInputRef.current && document.activeElement === bidInputRef.current) {
      return;
    }

    const parsed = Math.floor(Number(bidModalAmount));
    if (!Number.isFinite(parsed) || parsed < latestLive.minimumNextBid) {
      setBidModalAmount(String(latestLive.minimumNextBid));
    }
  }, [bidModalAmount, bidModalAuctionId, board.live, submittingByAuction]);

  const handleBidSubmit = useCallback(async () => {
    if (!activeBidAuction) {
      setBidModalError("This slot is no longer live. Refreshing latest board...");
      await loadBoard();
      return;
    }

    const amount = Math.floor(Number(bidModalAmount));
    if (!Number.isFinite(amount) || amount <= 0) {
      setBidModalError("Enter a valid amount.");
      return;
    }

    setBidModalError(null);
    const result = await submitBid(activeBidAuction.id, amount);
    if (!result.ok) {
      if (result.minRequired) {
        setBidModalAmount(String(result.minRequired));
      }
      setBidModalError(
        result.minRequired
          ? `${result.message}. Minimum required is ${formatInr(result.minRequired)}.`
          : result.message
      );
      if (result.code === "AUCTION_NOT_LIVE") {
        await loadBoard();
      }
      return;
    }

    setBoard(result.board);
    setErrorText(null);
    closeBidModal();
    toast.success(result.message);
  }, [activeBidAuction, bidModalAmount, closeBidModal, loadBoard, submitBid]);

  const sections = useMemo(
    () => [
      {
        id: "live",
        title: "Live Auctions",
        icon: Gavel,
        description: "Real-time bidding is open now. Highest valid bid at close wins the slot.",
        items: board.live
      },
      {
        id: "upcoming",
        title: "Upcoming Slots",
        icon: TimerReset,
        description: "Watchlist these slots and come back before bidding starts.",
        items: board.upcoming
      },
      {
        id: "past",
        title: "Past Results",
        icon: Trophy,
        description: "Recently closed or settled slots with latest bid history.",
        items: board.past
      }
    ],
    [board]
  );

  const isModalSubmitting = Boolean(
    activeBidAuction && submittingByAuction[activeBidAuction.id]
  );
  const modalMinBid = activeBidAuction?.minimumNextBid || 0;
  const modalCurrentBid = activeBidAuction
    ? activeBidAuction.currentBidAmount ?? activeBidAuction.startingBidAmount
    : null;

  return (
    <div className="vip-board-shell space-y-8">
      <section className="vip-hero-panel rounded-3xl border p-5 sm:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <p className="inline-flex items-center gap-2 rounded-full border border-accent/35 bg-accent/10 px-3 py-1 text-xs tracking-[0.12em] text-accent">
              <Sparkles className="h-3.5 w-3.5" />
              VIP CALL AUCTIONS
            </p>
            <h1 className="vip-hero-title text-3xl font-semibold leading-tight sm:text-4xl">
              Book 1:1 call slots with Alina
            </h1>
            <p className="vip-hero-subtitle max-w-3xl text-sm leading-relaxed sm:text-base">
              10 minutes starts at ₹999. Longer slots up to 60 minutes are available via timed bids.
              Highest valid bid wins. No private chat promises, only scheduled call slots.
            </p>
          </div>
          <div className="space-y-2 text-sm">
            <p className="vip-hero-chip inline-flex items-center gap-2 rounded-xl px-3 py-2">
              <ShieldCheck className="h-4 w-4 text-success" />
              Fair-bid rules + anti-sniping protection
            </p>
            <p className="vip-hero-chip inline-flex items-center gap-2 rounded-xl px-3 py-2">
              <ArrowUpCircle className="h-4 w-4 text-accent" />
              Outbid anytime before timer closes
            </p>
          </div>
        </div>
      </section>

      {errorText ? (
        <Card className="border-warning/40 bg-warning/10">
          <CardContent className="p-4 text-sm text-warning">
            {errorText}
            <Button variant="secondary" className="ml-3" size="sm" onClick={() => void loadBoard()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {sections.map((section) => (
        <section key={section.id} className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-2xl font-semibold text-text">
                <section.icon className="h-5 w-5 text-accent" />
                {section.title}
              </h2>
              <p className="mt-1 text-sm text-muted">{section.description}</p>
            </div>
            {loading ? <p className="text-xs text-muted">Refreshing...</p> : null}
          </div>

          {section.items.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {section.items.map((item) => (
                <AuctionCard
                  key={item.id}
                  item={item}
                  nowMs={nowMs}
                  submitting={Boolean(submittingByAuction[item.id])}
                  onOpenBidModal={() => openBidModal(item)}
                />
              ))}
            </div>
          ) : (
            <Card className="border-border/80 bg-surface/70">
              <CardContent className="p-4 text-sm text-muted">
                No {section.title.toLowerCase()} right now.
              </CardContent>
            </Card>
          )}
        </section>
      ))}

      {bidModalAuctionId ? (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-bg/82 p-4 backdrop-blur-sm sm:items-center"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeBidModal();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="vip-bid-dialog-title"
            className="vip-bid-modal w-full max-w-md rounded-3xl border border-border/90 bg-surface/96 p-5 shadow-rose sm:p-6"
          >
            {activeBidAuction ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="inline-flex items-center gap-2 rounded-full border border-accent/35 bg-accent/10 px-3 py-1 text-xs tracking-[0.11em] text-accent">
                    <Gavel className="h-3.5 w-3.5" />
                    LIVE BID
                  </p>
                  <h3 id="vip-bid-dialog-title" className="text-xl font-semibold text-text">
                    Place your bid
                  </h3>
                  <p className="text-sm text-muted">{activeBidAuction.title}</p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/80 bg-bg/45 p-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted">Current</p>
                    <p className="mt-1 text-lg font-semibold text-text">
                      {modalCurrentBid ? formatInr(modalCurrentBid) : "NA"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-accent/35 bg-accent/10 p-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-accent">Minimum next bid</p>
                    <p className="mt-1 text-lg font-semibold text-text">{formatInr(modalMinBid)}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="vip-bid-amount" className="text-sm font-medium text-text">
                    Bid amount (INR)
                  </label>
                  <Input
                    id="vip-bid-amount"
                    ref={bidInputRef}
                    inputMode="numeric"
                    type="number"
                    min={modalMinBid}
                    step={Math.max(1, activeBidAuction.minIncrement)}
                    value={bidModalAmount}
                    onChange={(event) => setBidModalAmount(event.target.value)}
                    disabled={isModalSubmitting}
                    placeholder={`Enter at least ₹${modalMinBid}`}
                    className="h-12 text-base"
                  />
                  <p className="text-xs text-muted">
                    Ends in {formatCountdown(activeBidAuction.biddingEndsAt, nowMs)}. Last-minute bids may
                    extend the timer to prevent sniping.
                  </p>
                </div>

                {bidModalError ? (
                  <div className="rounded-xl border border-danger/35 bg-danger/10 p-2.5 text-xs text-danger">
                    {bidModalError}
                  </div>
                ) : null}

                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    variant="secondary"
                    className="h-11 rounded-xl"
                    onClick={closeBidModal}
                    disabled={isModalSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button className="h-11 rounded-xl" onClick={() => void handleBidSubmit()} disabled={isModalSubmitting}>
                    {isModalSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Placing bid...
                      </>
                    ) : (
                      "Place bid now"
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-text">Auction no longer live</h3>
                <p className="text-sm text-muted">
                  This slot was updated while you were bidding. Refresh and pick an active slot.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button variant="secondary" className="h-11 rounded-xl" onClick={closeBidModal}>
                    Close
                  </Button>
                  <Button
                    className="h-11 rounded-xl"
                    onClick={() => {
                      void loadBoard();
                      closeBidModal();
                    }}
                  >
                    Refresh board
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
