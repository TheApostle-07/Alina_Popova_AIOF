import { Types } from "mongoose";
import { VIP_AUCTION_STATUSES, type VipAuctionStatus } from "@/lib/constants";
import { connectToDatabase } from "@/lib/db";
import { sendVipSlotBookedEmails } from "@/lib/email";
import { logWarn } from "@/lib/log";
import { MemberProfileModel } from "@/lib/models/member-profile";
import { UserModel } from "@/lib/models/user";
import { VipAuctionModel } from "@/lib/models/vip-auction";
import { VipBidModel } from "@/lib/models/vip-bid";

type AuctionStatusMutable = Exclude<VipAuctionStatus, "CANCELLED" | "SETTLED" | "DRAFT">;

const MEMBER_VISIBLE_STATUSES = new Set<VipAuctionStatus>([
  "SCHEDULED",
  "LIVE",
  "ENDED",
  "CANCELLED",
  "SETTLED"
]);

const AUCTION_MUTABLE_STATUSES = new Set<AuctionStatusMutable>(["SCHEDULED", "LIVE", "ENDED"]);
const SLOT_ACTIVE_STATUSES = new Set<VipAuctionStatus>(["SCHEDULED", "LIVE", "ENDED", "SETTLED"]);
const MAX_SLOT_DURATION_MINUTES = 60;

type VipAuctionLean = {
  _id: Types.ObjectId;
  title?: string;
  description?: string;
  status: VipAuctionStatus;
  durationMinutes: number;
  callStartsAt: Date;
  biddingStartsAt: Date;
  biddingEndsAt: Date;
  startingBidAmount: number;
  minIncrement: number;
  currentBidAmount?: number | null;
  leadingBidUserId?: Types.ObjectId | null;
  leadingBidId?: Types.ObjectId | null;
  bidCount?: number;
  revision?: number;
  antiSnipeEnabled?: boolean;
  antiSnipeWindowSeconds?: number;
  antiSnipeExtendSeconds?: number;
  antiSnipeMaxExtensions?: number;
  extensionCount?: number;
  settledAt?: Date;
  bookingConfirmedAt?: Date;
  winnerNotifiedAt?: Date;
  adminNotifiedAt?: Date;
  winnerUserId?: Types.ObjectId | null;
  winnerBidId?: Types.ObjectId | null;
  meetingJoinUrl?: string;
  cancelledReason?: string;
  updatedAt?: Date;
};

type VipRecentBidLean = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  amount: number;
  placedAt: Date;
};

type VipTopBidderLean = {
  userId: Types.ObjectId;
  amount: number;
  lastBidAt: Date;
};

function toObjectId(id: string) {
  if (!Types.ObjectId.isValid(id)) {
    return null;
  }
  return new Types.ObjectId(id);
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
}

function asDate(value: unknown) {
  if (value instanceof Date) {
    return value;
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function fallbackBidderLabel(userId: string) {
  const suffix = userId.slice(-4).toUpperCase();
  return `Member ${suffix}`;
}

function deriveTimedStatus(
  status: VipAuctionStatus,
  biddingStartsAt: Date,
  biddingEndsAt: Date,
  now: Date
): VipAuctionStatus {
  if (!AUCTION_MUTABLE_STATUSES.has(status as AuctionStatusMutable)) {
    return status;
  }

  if (now < biddingStartsAt) {
    return "SCHEDULED";
  }

  if (now >= biddingEndsAt) {
    return "ENDED";
  }

  return "LIVE";
}

function minimumNextBid(auction: {
  currentBidAmount?: number | null;
  startingBidAmount: number;
  minIncrement: number;
}) {
  const current = numberValue(auction.currentBidAmount, 0);
  if (current <= 0) {
    return Math.max(1, numberValue(auction.startingBidAmount, 1));
  }
  return Math.max(1, current + Math.max(1, numberValue(auction.minIncrement, 1)));
}

function computeCallEnd(callStartsAt: Date, durationMinutes: number) {
  return new Date(callStartsAt.getTime() + Math.max(1, durationMinutes) * 60 * 1000);
}

function intervalsOverlap(leftStart: Date, leftEnd: Date, rightStart: Date, rightEnd: Date) {
  return leftStart < rightEnd && leftEnd > rightStart;
}

async function resolveDisplayNames(userIds: string[]) {
  if (!userIds.length) {
    return new Map<string, string>();
  }

  const objectIds = userIds
    .map((value) => toObjectId(value))
    .filter((value): value is Types.ObjectId => Boolean(value));

  if (!objectIds.length) {
    return new Map<string, string>();
  }

  const profiles = (await MemberProfileModel.find({
    userId: { $in: objectIds }
  })
    .select({ userId: 1, displayName: 1 })
    .lean()) as unknown as Array<{ userId: Types.ObjectId; displayName: string }>;

  const map = new Map<string, string>();
  for (const profile of profiles) {
    map.set(String(profile.userId), profile.displayName);
  }
  return map;
}

async function ensureNoOverlappingSlot(params: {
  callStartsAt: Date;
  durationMinutes: number;
  excludeAuctionId?: Types.ObjectId;
}) {
  const slotStart = params.callStartsAt;
  const slotEnd = computeCallEnd(slotStart, params.durationMinutes);
  const candidateStart = new Date(slotStart.getTime() - MAX_SLOT_DURATION_MINUTES * 60 * 1000);

  const filter: Record<string, unknown> = {
    status: { $in: Array.from(SLOT_ACTIVE_STATUSES) },
    callStartsAt: {
      $gte: candidateStart,
      $lt: slotEnd
    }
  };

  if (params.excludeAuctionId) {
    filter._id = { $ne: params.excludeAuctionId };
  }

  const candidates = (await VipAuctionModel.find(filter)
    .select({ _id: 1, title: 1, callStartsAt: 1, durationMinutes: 1, status: 1 })
    .lean()) as unknown as Array<{
    _id: Types.ObjectId;
    title?: string;
    callStartsAt: Date;
    durationMinutes: number;
    status: VipAuctionStatus;
  }>;

  for (const candidate of candidates) {
    const candidateStartAt = new Date(candidate.callStartsAt);
    const candidateEndAt = computeCallEnd(candidateStartAt, numberValue(candidate.durationMinutes, 10));
    if (!intervalsOverlap(slotStart, slotEnd, candidateStartAt, candidateEndAt)) {
      continue;
    }

    const scheduleLabel = new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata"
    }).format(candidateStartAt);

    return {
      ok: false as const,
      message: `Call time overlaps with "${candidate.title || "VIP slot"}" scheduled at ${scheduleLabel} IST`
    };
  }

  return { ok: true as const };
}

async function sendSettlementNotificationsIfNeeded(auctionId: Types.ObjectId) {
  const auction = (await VipAuctionModel.findById(auctionId)
    .select({
      _id: 1,
      status: 1,
      title: 1,
      durationMinutes: 1,
      callStartsAt: 1,
      currentBidAmount: 1,
      startingBidAmount: 1,
      meetingJoinUrl: 1,
      winnerUserId: 1,
      bookingConfirmedAt: 1,
      winnerNotifiedAt: 1,
      adminNotifiedAt: 1
    })
    .lean()) as unknown as VipAuctionLean | null;

  if (!auction || auction.status !== "SETTLED" || !auction.winnerUserId) {
    return;
  }

  const winnerUserId = String(auction.winnerUserId);
  const winnerUser = (await UserModel.findById(auction.winnerUserId)
    .select({ email: 1, phone: 1 })
    .lean()) as { email?: string; phone?: string } | null;
  const winnerProfile = (await MemberProfileModel.findOne({ userId: auction.winnerUserId })
    .select({ displayName: 1 })
    .lean()) as { displayName?: string } | null;

  const recipientEmail = winnerUser?.email?.trim().toLowerCase() || null;
  const recipientPhone = winnerUser?.phone?.trim() || null;
  const recipientLabel =
    winnerProfile?.displayName ||
    recipientEmail?.split("@")[0] ||
    fallbackBidderLabel(winnerUserId);

  const shouldSendWinner = Boolean(recipientEmail) && !auction.winnerNotifiedAt;
  const shouldSendAdmin = !auction.adminNotifiedAt;

  if (!shouldSendWinner && !shouldSendAdmin) {
    if (!auction.bookingConfirmedAt) {
      await VipAuctionModel.updateOne(
        { _id: auction._id },
        {
          $set: {
            bookingConfirmedAt: new Date()
          }
        }
      );
    }
    return;
  }

  try {
    const notification = await sendVipSlotBookedEmails({
      auctionId: String(auction._id),
      slotTitle: String(auction.title || "VIP Call Slot"),
      durationMinutes: numberValue(auction.durationMinutes, 10),
      callStartsAt: new Date(auction.callStartsAt),
      winningBidAmount: Math.max(
        numberValue(auction.currentBidAmount, 0),
        numberValue(auction.startingBidAmount, 1)
      ),
      recipientLabel,
      recipientEmail,
      recipientPhone,
      meetingJoinUrl: auction.meetingJoinUrl || null,
      sendWinner: shouldSendWinner,
      sendAdmin: shouldSendAdmin
    });

    const now = new Date();
    const setPayload: Record<string, unknown> = {};
    if (!auction.bookingConfirmedAt) {
      setPayload.bookingConfirmedAt = now;
    }
    if (notification.winnerSent && !auction.winnerNotifiedAt) {
      setPayload.winnerNotifiedAt = now;
    }
    if (notification.adminSent && !auction.adminNotifiedAt) {
      setPayload.adminNotifiedAt = now;
    }

    if (Object.keys(setPayload).length) {
      await VipAuctionModel.updateOne(
        { _id: auction._id },
        {
          $set: setPayload
        }
      );
    }
  } catch (error) {
    logWarn("vip_settlement_notification_failed", {
      auctionId: String(auction._id),
      winnerUserId,
      error: error instanceof Error ? error.message : "unknown"
    });

    if (!auction.bookingConfirmedAt) {
      await VipAuctionModel.updateOne(
        { _id: auction._id },
        {
          $set: {
            bookingConfirmedAt: new Date()
          }
        }
      );
    }
  }
}

type MemberBidSummary = {
  id: string;
  amount: number;
  bidderLabel: string;
  placedAt: string;
  isCurrentMember: boolean;
};

type MemberTopBidderSummary = {
  rank: 1 | 2 | 3;
  amount: number;
  bidderLabel: string;
  isCurrentMember: boolean;
  lastBidAt: string;
};

export type VipAuctionMemberCard = {
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
  topBidders: MemberTopBidderSummary[];
  recentBids: MemberBidSummary[];
};

export type VipAuctionBoardData = {
  serverTime: string;
  live: VipAuctionMemberCard[];
  upcoming: VipAuctionMemberCard[];
  past: VipAuctionMemberCard[];
};

function buildMemberCard(
  auction: VipAuctionLean,
  memberId: string,
  displayNames: Map<string, string>,
  recentByAuction: Map<string, VipRecentBidLean[]>,
  topByAuction: Map<string, VipTopBidderLean[]>,
  myTopBidMap: Map<string, number>
): VipAuctionMemberCard {
  const auctionId = String(auction._id);
  const leadingUserId = auction.leadingBidUserId ? String(auction.leadingBidUserId) : null;
  const recentRows = recentByAuction.get(auctionId) || [];

  const recentBids: MemberBidSummary[] = recentRows.map((row) => {
    const rowUserId = String(row.userId);
    return {
      id: String(row._id),
      amount: numberValue(row.amount, 0),
      bidderLabel: displayNames.get(rowUserId) || fallbackBidderLabel(rowUserId),
      placedAt: new Date(row.placedAt).toISOString(),
      isCurrentMember: rowUserId === memberId
    };
  });

  const topRows = topByAuction.get(auctionId) || [];
  const topBidders: MemberTopBidderSummary[] = topRows.map((row, index) => {
    const rowUserId = String(row.userId);
    return {
      rank: ((index + 1) as 1 | 2 | 3),
      amount: numberValue(row.amount, 0),
      bidderLabel: displayNames.get(rowUserId) || fallbackBidderLabel(rowUserId),
      isCurrentMember: rowUserId === memberId,
      lastBidAt: new Date(row.lastBidAt).toISOString()
    };
  });

  return {
    id: auctionId,
    title: String(auction.title || "VIP Call Slot"),
    description: auction.description ? String(auction.description) : null,
    status: auction.status as VipAuctionStatus,
    durationMinutes: numberValue(auction.durationMinutes, 10),
    callStartsAt: new Date(auction.callStartsAt).toISOString(),
    biddingStartsAt: new Date(auction.biddingStartsAt).toISOString(),
    biddingEndsAt: new Date(auction.biddingEndsAt).toISOString(),
    startingBidAmount: numberValue(auction.startingBidAmount, 999),
    minIncrement: Math.max(1, numberValue(auction.minIncrement, 100)),
    currentBidAmount:
      auction.currentBidAmount === null || auction.currentBidAmount === undefined
        ? null
        : numberValue(auction.currentBidAmount, 0),
    bidCount: Math.max(0, numberValue(auction.bidCount, 0)),
    minimumNextBid: minimumNextBid(auction),
    leadingBidderLabel: leadingUserId
      ? displayNames.get(leadingUserId) || fallbackBidderLabel(leadingUserId)
      : null,
    leadingBidderIsCurrentMember: leadingUserId === memberId,
    myTopBidAmount: myTopBidMap.get(auctionId) || null,
    meetingJoinUrl: auction.meetingJoinUrl ? String(auction.meetingJoinUrl) : null,
    topBidders,
    recentBids
  };
}

async function syncTimedStatuses(auctions: VipAuctionLean[], now: Date) {
  const operations: Array<{
    updateOne: { filter: Record<string, unknown>; update: Record<string, unknown> };
  }> = [];

  for (const auction of auctions) {
    const startAt = asDate(auction.biddingStartsAt);
    const endAt = asDate(auction.biddingEndsAt);
    if (!startAt || !endAt) {
      continue;
    }

    const currentStatus = (auction.status || "SCHEDULED") as VipAuctionStatus;
    const nextStatus = deriveTimedStatus(currentStatus, startAt, endAt, now);
    if (nextStatus !== currentStatus) {
      operations.push({
        updateOne: {
          filter: { _id: auction._id, status: currentStatus },
          update: {
            $set: {
              status: nextStatus
            }
          }
        }
      });
      auction.status = nextStatus;
    }
  }

  if (!operations.length) {
    return 0;
  }

  await VipAuctionModel.bulkWrite(operations).catch((error) => {
    logWarn("vip_auction_status_sync_failed", {
      error: error instanceof Error ? error.message : "unknown",
      operations: operations.length
    });
  });

  return operations.length;
}

async function autoSettleEndedAuctions(auctions: VipAuctionLean[]) {
  const candidates = auctions.filter(
    (row) => row.status === "ENDED" && Boolean(row.leadingBidUserId)
  );
  if (!candidates.length) {
    return 0;
  }

  let settledCount = 0;

  for (const candidate of candidates) {
    const settledAt = new Date();
    const updated = await VipAuctionModel.findOneAndUpdate(
      {
        _id: candidate._id,
        status: "ENDED",
        leadingBidUserId: { $exists: true, $ne: null }
      },
      {
        $set: {
          status: "SETTLED",
          settledAt,
          bookingConfirmedAt: settledAt,
          winnerUserId: candidate.leadingBidUserId,
          winnerBidId: candidate.leadingBidId || null
        }
      },
      { new: true }
    )
      .select({ _id: 1 })
      .lean();

    if (!updated) {
      continue;
    }

    candidate.status = "SETTLED";
    candidate.settledAt = settledAt;
    candidate.bookingConfirmedAt = settledAt;
    candidate.winnerUserId = candidate.leadingBidUserId || null;
    candidate.winnerBidId = candidate.leadingBidId || null;
    settledCount += 1;

    await sendSettlementNotificationsIfNeeded(candidate._id);
  }

  return settledCount;
}

async function sendPendingSettlementNotifications(auctions: VipAuctionLean[]) {
  const candidates = auctions.filter(
    (row) =>
      row.status === "SETTLED" &&
      Boolean(row.winnerUserId) &&
      (!row.winnerNotifiedAt || !row.adminNotifiedAt)
  );

  if (!candidates.length) {
    return 0;
  }

  for (const candidate of candidates) {
    await sendSettlementNotificationsIfNeeded(candidate._id);
  }

  return candidates.length;
}

export type VipAuctionHousekeepingResult = {
  scanned: number;
  timedStatusUpdates: number;
  autoSettled: number;
  notificationChecks: number;
};

export async function runVipAuctionHousekeeping(limit = 160): Promise<VipAuctionHousekeepingResult> {
  await connectToDatabase();
  const now = new Date();
  const cappedLimit = Math.max(20, Math.min(300, Math.floor(limit)));

  const rows = (await VipAuctionModel.find({
    status: { $in: ["SCHEDULED", "LIVE", "ENDED", "SETTLED"] }
  })
    .sort({ biddingEndsAt: 1, _id: 1 })
    .limit(cappedLimit)
    .lean()) as unknown as VipAuctionLean[];

  const timedStatusUpdates = await syncTimedStatuses(rows, now);
  const autoSettled = await autoSettleEndedAuctions(rows);
  const notificationChecks = await sendPendingSettlementNotifications(rows);

  return {
    scanned: rows.length,
    timedStatusUpdates,
    autoSettled,
    notificationChecks
  };
}

export async function getVipAuctionBoardForMember(
  memberId: string,
  options: {
    liveLimit?: number;
    upcomingLimit?: number;
    pastLimit?: number;
  } = {}
): Promise<VipAuctionBoardData> {
  await connectToDatabase();

  const now = new Date();
  const liveLimit = Math.max(1, Math.min(15, Math.floor(options.liveLimit || 8)));
  const upcomingLimit = Math.max(1, Math.min(20, Math.floor(options.upcomingLimit || 10)));
  const pastLimit = Math.max(1, Math.min(20, Math.floor(options.pastLimit || 8)));

  const rows = (await VipAuctionModel.find({
    status: { $in: Array.from(MEMBER_VISIBLE_STATUSES) }
  })
    .sort({ biddingEndsAt: 1, _id: 1 })
    .limit(120)
    .lean()) as unknown as VipAuctionLean[];

  await syncTimedStatuses(rows, now);
  await autoSettleEndedAuctions(rows);
  await sendPendingSettlementNotifications(rows);

  const live = rows.filter((row) => row.status === "LIVE").slice(0, liveLimit);
  const upcoming = rows.filter((row) => row.status === "SCHEDULED").slice(0, upcomingLimit);
  const past = rows
    .filter((row) => row.status === "ENDED" || row.status === "SETTLED" || row.status === "CANCELLED")
    .sort((left, right) => new Date(right.biddingEndsAt).getTime() - new Date(left.biddingEndsAt).getTime())
    .slice(0, pastLimit);

  const selected = [...live, ...upcoming, ...past];
  const selectedIds = selected.map((row) => row._id);

  const recentRows = selectedIds.length
    ? ((await VipBidModel.aggregate([
        {
          $match: {
            auctionId: { $in: selectedIds }
          }
        },
        { $sort: { placedAt: -1, _id: -1 } },
        {
          $group: {
            _id: "$auctionId",
            bids: {
              $push: {
                _id: "$_id",
                userId: "$userId",
                amount: "$amount",
                placedAt: "$placedAt"
              }
            }
          }
        },
        {
          $project: {
            bids: { $slice: ["$bids", 10] }
          }
        }
      ])) as Array<{ _id: Types.ObjectId; bids: VipRecentBidLean[] }>)
    : [];

  const topRows = selectedIds.length
    ? ((await VipBidModel.aggregate([
        {
          $match: {
            auctionId: { $in: selectedIds }
          }
        },
        {
          $group: {
            _id: {
              auctionId: "$auctionId",
              userId: "$userId"
            },
            amount: { $max: "$amount" },
            lastBidAt: { $max: "$placedAt" }
          }
        },
        { $sort: { "_id.auctionId": 1, amount: -1, lastBidAt: 1, "_id.userId": 1 } },
        {
          $group: {
            _id: "$_id.auctionId",
            top: {
              $push: {
                userId: "$_id.userId",
                amount: "$amount",
                lastBidAt: "$lastBidAt"
              }
            }
          }
        },
        {
          $project: {
            top: { $slice: ["$top", 3] }
          }
        }
      ])) as Array<{ _id: Types.ObjectId; top: VipTopBidderLean[] }>)
    : [];

  const myBids = selectedIds.length
    ? ((await VipBidModel.aggregate([
        {
          $match: {
            auctionId: { $in: selectedIds },
            userId: toObjectId(memberId)
          }
        },
        {
          $group: {
            _id: "$auctionId",
            maxAmount: { $max: "$amount" }
          }
        }
      ])) as Array<{ _id: Types.ObjectId; maxAmount: number }>)
    : [];

  const recentByAuction = new Map<string, VipRecentBidLean[]>();
  const userIds = new Set<string>();

  for (const row of recentRows) {
    recentByAuction.set(String(row._id), row.bids);
    for (const bid of row.bids) {
      userIds.add(String(bid.userId));
    }
  }

  const topByAuction = new Map<string, VipTopBidderLean[]>();
  for (const row of topRows) {
    topByAuction.set(String(row._id), row.top);
    for (const bidder of row.top) {
      userIds.add(String(bidder.userId));
    }
  }

  for (const row of selected) {
    if (row.leadingBidUserId) {
      userIds.add(String(row.leadingBidUserId));
    }
  }

  const myTopBidMap = new Map<string, number>();
  for (const row of myBids) {
    myTopBidMap.set(String(row._id), numberValue(row.maxAmount, 0));
  }

  const displayNames = await resolveDisplayNames(Array.from(userIds));

  return {
    serverTime: now.toISOString(),
    live: live.map((row) =>
      buildMemberCard(row, memberId, displayNames, recentByAuction, topByAuction, myTopBidMap)
    ),
    upcoming: upcoming.map((row) =>
      buildMemberCard(row, memberId, displayNames, recentByAuction, topByAuction, myTopBidMap)
    ),
    past: past.map((row) =>
      buildMemberCard(row, memberId, displayNames, recentByAuction, topByAuction, myTopBidMap)
    )
  };
}

export type PlaceVipBidInput = {
  auctionId: string;
  memberId: string;
  amount: number;
  idempotencyKey?: string;
};

export type PlaceVipBidResult =
  | {
      ok: true;
      alreadyProcessed?: boolean;
      autoExtended: boolean;
      board: VipAuctionBoardData;
      message: string;
    }
  | {
      ok: false;
      status: number;
      code:
        | "AUCTION_NOT_FOUND"
        | "AUCTION_NOT_LIVE"
        | "BID_TOO_LOW"
        | "CONFLICT_RETRY"
        | "INVALID_AMOUNT"
        | "INVALID_AUCTION_ID";
      message: string;
      minRequired?: number;
      currentBidAmount?: number | null;
    };

function isDuplicateMongoError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: number }).code === 11000
  );
}

export async function placeVipBid(input: PlaceVipBidInput): Promise<PlaceVipBidResult> {
  const objectAuctionId = toObjectId(input.auctionId);
  if (!objectAuctionId) {
    return {
      ok: false,
      status: 422,
      code: "INVALID_AUCTION_ID",
      message: "Invalid auction id"
    };
  }

  const objectMemberId = toObjectId(input.memberId);
  if (!objectMemberId) {
    return {
      ok: false,
      status: 422,
      code: "INVALID_AUCTION_ID",
      message: "Invalid member id"
    };
  }

  const amount = Math.floor(numberValue(input.amount, 0));
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      ok: false,
      status: 422,
      code: "INVALID_AMOUNT",
      message: "Invalid bid amount"
    };
  }

  await connectToDatabase();
  const now = new Date();

  if (input.idempotencyKey) {
    const existingBid = (await VipBidModel.findOne({
      auctionId: objectAuctionId,
      userId: objectMemberId,
      idempotencyKey: input.idempotencyKey
    })
      .select({ _id: 1 })
      .lean()) as { _id: Types.ObjectId } | null;

    if (existingBid) {
      return {
        ok: true,
        alreadyProcessed: true,
        autoExtended: false,
        board: await getVipAuctionBoardForMember(input.memberId),
        message: "Bid already processed"
      };
    }
  }

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const auction = (await VipAuctionModel.findById(objectAuctionId).lean()) as unknown as VipAuctionLean | null;
    if (!auction) {
      return {
        ok: false,
        status: 404,
        code: "AUCTION_NOT_FOUND",
        message: "Auction slot not found"
      };
    }

    const startAt = asDate(auction.biddingStartsAt);
    const endAt = asDate(auction.biddingEndsAt);
    if (!startAt || !endAt) {
      return {
        ok: false,
        status: 409,
        code: "AUCTION_NOT_LIVE",
        message: "Auction timing is invalid"
      };
    }

    const runtimeStatus = deriveTimedStatus(auction.status as VipAuctionStatus, startAt, endAt, now);
    if (runtimeStatus !== auction.status) {
      await VipAuctionModel.updateOne(
        { _id: auction._id, status: auction.status },
        {
          $set: {
            status: runtimeStatus
          }
        }
      );
      auction.status = runtimeStatus;
    }

    if (runtimeStatus !== "LIVE") {
      if (runtimeStatus === "ENDED" && auction.leadingBidUserId) {
        await autoSettleEndedAuctions([auction]);
      }
      return {
        ok: false,
        status: 409,
        code: "AUCTION_NOT_LIVE",
        message:
          runtimeStatus === "SCHEDULED"
            ? "Bidding has not started yet"
            : runtimeStatus === "ENDED"
              ? "Bidding has already ended"
              : "This slot is not open for bids"
      };
    }

    const minRequired = minimumNextBid(auction);
    const currentBidAmount =
      auction.currentBidAmount === null || auction.currentBidAmount === undefined
        ? null
        : numberValue(auction.currentBidAmount, 0);

    if (amount < minRequired) {
      return {
        ok: false,
        status: 409,
        code: "BID_TOO_LOW",
        message: `Bid must be at least ₹${minRequired}`,
        minRequired,
        currentBidAmount
      };
    }

    const extensionCount = Math.max(0, numberValue(auction.extensionCount, 0));
    const extensionMax = Math.max(0, numberValue(auction.antiSnipeMaxExtensions, 10));
    const antiSnipeWindowSeconds = Math.max(0, numberValue(auction.antiSnipeWindowSeconds, 120));
    const antiSnipeExtendSeconds = Math.max(0, numberValue(auction.antiSnipeExtendSeconds, 120));
    const timeLeftMs = endAt.getTime() - now.getTime();

    const shouldExtend =
      Boolean(auction.antiSnipeEnabled) &&
      extensionCount < extensionMax &&
      timeLeftMs > 0 &&
      timeLeftMs <= antiSnipeWindowSeconds * 1000 &&
      antiSnipeExtendSeconds > 0;

    const updatePayload: {
      $set: Record<string, unknown>;
      $inc: Record<string, number>;
    } = {
      $set: {
        currentBidAmount: amount,
        leadingBidUserId: objectMemberId,
        lastBidAt: now
      },
      $inc: {
        bidCount: 1,
        revision: 1
      }
    };

    if (shouldExtend) {
      updatePayload.$set.biddingEndsAt = new Date(endAt.getTime() + antiSnipeExtendSeconds * 1000);
      updatePayload.$inc.extensionCount = 1;
    }

    const updated = (await VipAuctionModel.findOneAndUpdate(
      {
        _id: auction._id,
        revision: numberValue(auction.revision, 0),
        status: "LIVE",
        biddingStartsAt: { $lte: now },
        biddingEndsAt: { $gt: now }
      },
      updatePayload,
      { new: true }
    ).lean()) as unknown as VipAuctionLean | null;

    if (!updated) {
      continue;
    }

    try {
      const bid = await VipBidModel.create({
        auctionId: objectAuctionId,
        userId: objectMemberId,
        amount,
        currency: "INR",
        placedAt: now,
        idempotencyKey: input.idempotencyKey || undefined,
        wasAutoExtended: shouldExtend
      });

      await VipAuctionModel.updateOne(
        { _id: updated._id },
        {
          $set: {
            leadingBidId: bid._id
          }
        }
      );
    } catch (error) {
      if (!isDuplicateMongoError(error) || !input.idempotencyKey) {
        throw error;
      }
    }

    return {
      ok: true,
      autoExtended: shouldExtend,
      board: await getVipAuctionBoardForMember(input.memberId),
      message: shouldExtend
        ? "Bid placed. Auction timer extended due to last-minute activity."
        : "Bid placed successfully"
    };
  }

  return {
    ok: false,
    status: 409,
    code: "CONFLICT_RETRY",
    message: "High bidding activity. Please retry."
  };
}

export type AdminVipAuctionListItem = {
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

export async function getVipAuctionsForAdmin(options: {
  status?: VipAuctionStatus | "ALL";
  limit?: number;
}): Promise<AdminVipAuctionListItem[]> {
  await connectToDatabase();
  const now = new Date();

  const limit = Math.max(1, Math.min(100, Math.floor(options.limit || 60)));
  const filter: Record<string, unknown> = {};
  if (options.status && options.status !== "ALL") {
    filter.status = options.status;
  }

  const rows = (await VipAuctionModel.find(filter)
    .sort({ biddingStartsAt: 1, _id: -1 })
    .limit(limit)
    .lean()) as unknown as VipAuctionLean[];

  await syncTimedStatuses(rows, now);
  await autoSettleEndedAuctions(rows);
  await sendPendingSettlementNotifications(rows);

  const userIds = rows
    .map((row) => (row.leadingBidUserId ? String(row.leadingBidUserId) : ""))
    .filter(Boolean);
  const displayNames = await resolveDisplayNames(userIds);

  return rows.map((row) => {
    const leadingId = row.leadingBidUserId ? String(row.leadingBidUserId) : null;
    return {
      id: String(row._id),
      title: String(row.title || ""),
      description: row.description ? String(row.description) : null,
      status: row.status as VipAuctionStatus,
      durationMinutes: numberValue(row.durationMinutes, 10),
      callStartsAt: new Date(row.callStartsAt).toISOString(),
      biddingStartsAt: new Date(row.biddingStartsAt).toISOString(),
      biddingEndsAt: new Date(row.biddingEndsAt).toISOString(),
      startingBidAmount: numberValue(row.startingBidAmount, 999),
      minIncrement: numberValue(row.minIncrement, 100),
      currentBidAmount:
        row.currentBidAmount === null || row.currentBidAmount === undefined
          ? null
          : numberValue(row.currentBidAmount, 0),
      bidCount: numberValue(row.bidCount, 0),
      leadingBidderLabel: leadingId
        ? displayNames.get(leadingId) || fallbackBidderLabel(leadingId)
        : null,
      extensionCount: numberValue(row.extensionCount, 0),
      antiSnipeEnabled: Boolean(row.antiSnipeEnabled),
      meetingJoinUrl: row.meetingJoinUrl ? String(row.meetingJoinUrl) : null,
      cancelledReason: row.cancelledReason ? String(row.cancelledReason) : null,
      updatedAt: new Date(row.updatedAt || now).toISOString()
    };
  });
}

type AdminCreateVipAuctionInput = {
  title: string;
  description?: string;
  durationMinutes: number;
  callStartsAt: Date;
  biddingStartsAt: Date;
  biddingEndsAt: Date;
  startingBidAmount: number;
  minIncrement?: number;
  antiSnipeEnabled?: boolean;
  antiSnipeWindowSeconds?: number;
  antiSnipeExtendSeconds?: number;
  antiSnipeMaxExtensions?: number;
  status?: VipAuctionStatus;
  meetingJoinUrl?: string;
  adminNotes?: string;
};

function normalizeInitialStatus(
  inputStatus: VipAuctionStatus | undefined,
  biddingStartsAt: Date,
  biddingEndsAt: Date,
  now: Date
): VipAuctionStatus {
  if (inputStatus === "DRAFT") {
    return "DRAFT";
  }

  if (inputStatus && VIP_AUCTION_STATUSES.includes(inputStatus)) {
    if (inputStatus === "CANCELLED" || inputStatus === "SETTLED") {
      return inputStatus;
    }
  }

  if (now < biddingStartsAt) {
    return "SCHEDULED";
  }

  if (now >= biddingEndsAt) {
    return "ENDED";
  }

  return "LIVE";
}

export async function createVipAuctionByAdmin(input: AdminCreateVipAuctionInput) {
  await connectToDatabase();
  const now = new Date();

  const initialStatus = normalizeInitialStatus(
    input.status,
    input.biddingStartsAt,
    input.biddingEndsAt,
    now
  );

  if (SLOT_ACTIVE_STATUSES.has(initialStatus)) {
    const overlap = await ensureNoOverlappingSlot({
      callStartsAt: input.callStartsAt,
      durationMinutes: input.durationMinutes
    });
    if (!overlap.ok) {
      return {
        ok: false as const,
        status: 409,
        message: overlap.message
      };
    }
  }

  const created = await VipAuctionModel.create({
    title: input.title,
    description: input.description || undefined,
    durationMinutes: input.durationMinutes,
    callStartsAt: input.callStartsAt,
    biddingStartsAt: input.biddingStartsAt,
    biddingEndsAt: input.biddingEndsAt,
    startingBidAmount: input.startingBidAmount,
    minIncrement: input.minIncrement || 100,
    antiSnipeEnabled: input.antiSnipeEnabled ?? true,
    antiSnipeWindowSeconds: input.antiSnipeWindowSeconds ?? 120,
    antiSnipeExtendSeconds: input.antiSnipeExtendSeconds ?? 120,
    antiSnipeMaxExtensions: input.antiSnipeMaxExtensions ?? 10,
    status: initialStatus,
    meetingJoinUrl: input.meetingJoinUrl || undefined,
    adminNotes: input.adminNotes || undefined
  });

  return {
    ok: true as const,
    id: String(created._id)
  };
}

type AdminUpdateVipAuctionInput = {
  title?: string;
  description?: string | null;
  durationMinutes?: number;
  callStartsAt?: Date;
  biddingStartsAt?: Date;
  biddingEndsAt?: Date;
  startingBidAmount?: number;
  minIncrement?: number;
  antiSnipeEnabled?: boolean;
  antiSnipeWindowSeconds?: number;
  antiSnipeExtendSeconds?: number;
  antiSnipeMaxExtensions?: number;
  status?: VipAuctionStatus;
  meetingJoinUrl?: string | null;
  adminNotes?: string | null;
  cancelledReason?: string | null;
};

export type AdminUpdateVipAuctionResult =
  | { ok: true; id: string }
  | { ok: false; status: number; message: string };

export async function updateVipAuctionByAdmin(
  auctionId: string,
  input: AdminUpdateVipAuctionInput
): Promise<AdminUpdateVipAuctionResult> {
  const objectAuctionId = toObjectId(auctionId);
  if (!objectAuctionId) {
    return { ok: false, status: 422, message: "Invalid auction id" };
  }

  await connectToDatabase();
  const now = new Date();

  const auction = await VipAuctionModel.findById(objectAuctionId);
  if (!auction) {
    return { ok: false, status: 404, message: "Auction not found" };
  }

  if (auction.status === "SETTLED" && input.status && input.status !== "SETTLED") {
    return {
      ok: false,
      status: 409,
      message: "Settled auctions cannot be moved back to active states"
    };
  }

  if (input.status === "SETTLED") {
    const timed = deriveTimedStatus(
      auction.status as VipAuctionStatus,
      auction.biddingStartsAt,
      auction.biddingEndsAt,
      now
    );
    if (timed !== "ENDED" && auction.status !== "SETTLED") {
      return {
        ok: false,
        status: 409,
        message: "Auction can be settled only after bidding ends"
      };
    }
    if (!auction.leadingBidUserId) {
      return {
        ok: false,
        status: 409,
        message: "Cannot settle an auction with no bids"
      };
    }
  }

  if (auction.bidCount > 0) {
    if (
      input.durationMinutes !== undefined ||
      input.biddingStartsAt !== undefined ||
      input.biddingEndsAt !== undefined ||
      input.startingBidAmount !== undefined ||
      input.minIncrement !== undefined
    ) {
      return {
        ok: false,
        status: 409,
        message: "Core auction terms cannot be changed after bids are placed"
      };
    }
  }

  if (input.title !== undefined) {
    auction.title = input.title;
  }
  if (input.description !== undefined) {
    auction.description = input.description || undefined;
  }
  if (input.durationMinutes !== undefined) {
    auction.durationMinutes = input.durationMinutes;
  }
  if (input.callStartsAt !== undefined) {
    auction.callStartsAt = input.callStartsAt;
  }
  if (input.biddingStartsAt !== undefined) {
    auction.biddingStartsAt = input.biddingStartsAt;
  }
  if (input.biddingEndsAt !== undefined) {
    auction.biddingEndsAt = input.biddingEndsAt;
  }
  if (input.startingBidAmount !== undefined) {
    auction.startingBidAmount = input.startingBidAmount;
  }
  if (input.minIncrement !== undefined) {
    auction.minIncrement = input.minIncrement;
  }
  if (input.antiSnipeEnabled !== undefined) {
    auction.antiSnipeEnabled = input.antiSnipeEnabled;
  }
  if (input.antiSnipeWindowSeconds !== undefined) {
    auction.antiSnipeWindowSeconds = input.antiSnipeWindowSeconds;
  }
  if (input.antiSnipeExtendSeconds !== undefined) {
    auction.antiSnipeExtendSeconds = input.antiSnipeExtendSeconds;
  }
  if (input.antiSnipeMaxExtensions !== undefined) {
    auction.antiSnipeMaxExtensions = input.antiSnipeMaxExtensions;
  }
  if (input.meetingJoinUrl !== undefined) {
    auction.meetingJoinUrl = input.meetingJoinUrl || undefined;
  }
  if (input.adminNotes !== undefined) {
    auction.adminNotes = input.adminNotes || undefined;
  }
  if (input.cancelledReason !== undefined) {
    auction.cancelledReason = input.cancelledReason || undefined;
  }

  if (input.status !== undefined) {
    if (input.status === "CANCELLED") {
      auction.status = "CANCELLED";
      auction.cancelledReason = input.cancelledReason || auction.cancelledReason || "Cancelled by admin";
    } else if (input.status === "SETTLED") {
      auction.status = "SETTLED";
      auction.settledAt = now;
      auction.bookingConfirmedAt = auction.bookingConfirmedAt || now;
      auction.winnerUserId = auction.leadingBidUserId || undefined;
      auction.winnerBidId = auction.leadingBidId || undefined;
    } else if (input.status === "DRAFT") {
      if (auction.bidCount > 0) {
        return {
          ok: false,
          status: 409,
          message: "Cannot move an auction with bids back to draft"
        };
      }
      auction.status = "DRAFT";
    } else if (input.status === "SCHEDULED" || input.status === "LIVE" || input.status === "ENDED") {
      auction.status = input.status;
    }
  } else {
    const nextTimed = deriveTimedStatus(
      auction.status as VipAuctionStatus,
      auction.biddingStartsAt,
      auction.biddingEndsAt,
      now
    );
    auction.status = nextTimed;
  }

  if (SLOT_ACTIVE_STATUSES.has(auction.status as VipAuctionStatus)) {
    const overlap = await ensureNoOverlappingSlot({
      callStartsAt: auction.callStartsAt,
      durationMinutes: numberValue(auction.durationMinutes, 10),
      excludeAuctionId: auction._id
    });

    if (!overlap.ok) {
      return {
        ok: false,
        status: 409,
        message: overlap.message
      };
    }
  }

  await auction.save();

  if (auction.status === "SETTLED") {
    await sendSettlementNotificationsIfNeeded(auction._id);
  }

  return { ok: true, id: String(auction._id) };
}
