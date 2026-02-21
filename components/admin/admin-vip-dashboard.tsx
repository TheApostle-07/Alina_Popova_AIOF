"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Gavel, Loader2, PlusCircle, RefreshCw, Trophy, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { VIP_BASE_BID_BY_DURATION, VIP_SLOT_DURATIONS, type VipAuctionStatus } from "@/lib/constants";

type AdminVipAuctionItem = {
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
  leadingBidderLabel: string | null;
  extensionCount: number;
  antiSnipeEnabled: boolean;
  meetingJoinUrl: string | null;
  cancelledReason: string | null;
  updatedAt: string;
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

function toInputDateTimeValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function statusVariant(status: VipAuctionStatus): "default" | "success" | "warning" | "danger" {
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

const DEFAULT_DURATION = 10;

function defaultCreateForm() {
  const now = new Date();
  const biddingStart = new Date(now.getTime() + 30 * 60 * 1000);
  const biddingEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const callStart = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  return {
    title: "VIP 1:1 Call Slot",
    description: "",
    durationMinutes: DEFAULT_DURATION,
    callStartsAt: toInputDateTimeValue(callStart),
    biddingStartsAt: toInputDateTimeValue(biddingStart),
    biddingEndsAt: toInputDateTimeValue(biddingEnd),
    startingBidAmount: VIP_BASE_BID_BY_DURATION[DEFAULT_DURATION],
    minIncrement: 100,
    antiSnipeEnabled: true
  };
}

export function AdminVipDashboard() {
  const [items, setItems] = useState<AdminVipAuctionItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<"ALL" | VipAuctionStatus>("ALL");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultCreateForm);

  const loadAuctions = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("status", statusFilter);
      params.set("limit", "80");
      const response = await fetch(`/api/admin/vip/auctions?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
        credentials: "include"
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Unable to load VIP auctions");
      }
      setItems(payload.data.items as AdminVipAuctionItem[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load VIP auctions");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadAuctions();
  }, [loadAuctions]);

  const createAuction = async (event: FormEvent) => {
    event.preventDefault();
    try {
      setSubmitting(true);

      const response = await fetch("/api/admin/vip/auctions", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          ...form,
          callStartsAt: new Date(form.callStartsAt).toISOString(),
          biddingStartsAt: new Date(form.biddingStartsAt).toISOString(),
          biddingEndsAt: new Date(form.biddingEndsAt).toISOString(),
          status: "SCHEDULED"
        })
      });

      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Unable to create auction");
      }

      toast.success("VIP slot auction created.");
      setForm(defaultCreateForm());
      await loadAuctions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create auction");
    } finally {
      setSubmitting(false);
    }
  };

  const patchAuction = useCallback(
    async (id: string, body: Record<string, unknown>, successMessage: string) => {
      try {
        setActionBusyId(id);
        const response = await fetch(`/api/admin/vip/auctions/${id}`, {
          method: "PATCH",
          headers: {
            "content-type": "application/json"
          },
          credentials: "include",
          body: JSON.stringify(body)
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "Unable to update slot");
        }
        toast.success(successMessage);
        await loadAuctions();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to update slot");
      } finally {
        setActionBusyId(null);
      }
    },
    [loadAuctions]
  );

  const tableRows = useMemo(() => items, [items]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gavel className="h-5 w-5 text-accent" />
            VIP Call Slot Auctions
          </CardTitle>
          <CardDescription>
            Configure auction windows, durations, anti-snipe behavior, and settle winners. Overlapping
            call slots are blocked automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={createAuction}>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="vip-title">Title</Label>
              <Input
                id="vip-title"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="VIP 1:1 Call Slot"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="vip-description">Description</Label>
              <Input
                id="vip-description"
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Short summary for members"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vip-duration">Duration (minutes)</Label>
              <select
                id="vip-duration"
                className="h-11 w-full rounded-xl border border-border bg-bg px-3 text-sm text-text"
                value={form.durationMinutes}
                onChange={(event) => {
                  const duration = Number(event.target.value);
                  setForm((current) => ({
                    ...current,
                    durationMinutes: duration,
                    startingBidAmount:
                      VIP_BASE_BID_BY_DURATION[duration as keyof typeof VIP_BASE_BID_BY_DURATION] ||
                      current.startingBidAmount
                  }));
                }}
              >
                {VIP_SLOT_DURATIONS.map((duration) => (
                  <option key={duration} value={duration}>
                    {duration} min
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vip-starting">Starting bid (INR)</Label>
              <Input
                id="vip-starting"
                type="number"
                value={form.startingBidAmount}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    startingBidAmount: Math.max(1, Math.floor(Number(event.target.value) || 0))
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vip-increment">Min increment (INR)</Label>
              <Input
                id="vip-increment"
                type="number"
                value={form.minIncrement}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    minIncrement: Math.max(1, Math.floor(Number(event.target.value) || 0))
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vip-call">Call starts (IST/local input)</Label>
              <Input
                id="vip-call"
                type="datetime-local"
                value={form.callStartsAt}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    callStartsAt: event.target.value
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vip-bidding-start">Bidding starts</Label>
              <Input
                id="vip-bidding-start"
                type="datetime-local"
                value={form.biddingStartsAt}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    biddingStartsAt: event.target.value
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vip-bidding-end">Bidding ends</Label>
              <Input
                id="vip-bidding-end"
                type="datetime-local"
                value={form.biddingEndsAt}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    biddingEndsAt: event.target.value
                  }))
                }
              />
            </div>

            <label className="md:col-span-2 flex items-center gap-2 rounded-xl border border-border/80 bg-bg/40 px-3 py-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={form.antiSnipeEnabled}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    antiSnipeEnabled: event.target.checked
                  }))
                }
              />
              Enable anti-sniping extension near closing seconds
            </label>

            <div className="md:col-span-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating
                  </>
                ) : (
                  <>
                    <PlusCircle className="mr-2 h-4 w-4" /> Create VIP Auction Slot
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-accent" />
                Auction Slots
              </CardTitle>
              <CardDescription>Manage live, upcoming, ended, and settled slots.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <select
                className="h-10 rounded-xl border border-border bg-bg px-3 text-sm text-text"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as "ALL" | VipAuctionStatus)}
              >
                <option value="ALL">All statuses</option>
                <option value="DRAFT">DRAFT</option>
                <option value="SCHEDULED">SCHEDULED</option>
                <option value="LIVE">LIVE</option>
                <option value="ENDED">ENDED</option>
                <option value="CANCELLED">CANCELLED</option>
                <option value="SETTLED">SETTLED</option>
              </select>
              <Button variant="secondary" onClick={() => void loadAuctions()}>
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading auction slots...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Slot</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Bidding Window</TableHead>
                  <TableHead>Current</TableHead>
                  <TableHead>Leader</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <p className="font-medium text-text">{row.title}</p>
                      <p className="text-xs text-muted">
                        {row.durationMinutes} min • Call {formatIST(row.callStartsAt)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted">
                      <p>{formatIST(row.biddingStartsAt)}</p>
                      <p>to {formatIST(row.biddingEndsAt)}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-text">
                        {formatInr(row.currentBidAmount ?? row.startingBidAmount)}
                      </p>
                      <p className="text-xs text-muted">{row.bidCount} bids</p>
                    </TableCell>
                    <TableCell className="text-xs text-muted">
                      {row.leadingBidderLabel || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={actionBusyId === row.id}
                          onClick={() => void patchAuction(row.id, {}, "Auction refreshed")}
                        >
                          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Sync
                        </Button>
                        {row.status !== "CANCELLED" && row.status !== "SETTLED" ? (
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={actionBusyId === row.id}
                            onClick={() => {
                              const reason = window.prompt("Cancellation reason (optional):", "");
                              void patchAuction(
                                row.id,
                                { status: "CANCELLED", cancelledReason: reason || null },
                                "Auction cancelled"
                              );
                            }}
                          >
                            <XCircle className="mr-1 h-3.5 w-3.5" /> Cancel
                          </Button>
                        ) : null}
                        {row.status === "ENDED" && row.bidCount > 0 ? (
                          <Button
                            size="sm"
                            disabled={actionBusyId === row.id}
                            onClick={() => {
                              const link = window.prompt("Meeting link for winner (optional):", row.meetingJoinUrl || "");
                              void patchAuction(
                                row.id,
                                { status: "SETTLED", meetingJoinUrl: link || null },
                                "Auction settled. Booking notifications processed."
                              );
                            }}
                          >
                            <Trophy className="mr-1 h-3.5 w-3.5" /> Settle
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
