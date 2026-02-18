import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { DonationModel, ensureDonationIndexes } from "@/lib/models/donation";
import { MemberProfileModel } from "@/lib/models/member-profile";
import { UserModel } from "@/lib/models/user";
import {
  createRazorpayOrder,
  fetchRazorpayPayment,
  verifyRazorpayPaymentSignature
} from "@/lib/razorpay";

type MemberIdentity = {
  _id: unknown;
  email?: string;
  phone?: string;
};

type MemberProfileRow = {
  _id: unknown;
  userId: unknown;
  displayName: string;
  displayNameKey: string;
  donationTotal?: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

type EnsureMemberProfileResult = {
  userId: string;
  displayName: string;
  displayNameKey: string;
  donationTotal: number;
  createdAt: string;
  updatedAt: string;
};

type LeaderboardRow = {
  rank: number;
  userId: string;
  displayName: string;
  displayNameKey: string;
  donationTotal: number;
  isCurrentMember: boolean;
};

type MemberLeaderboardResult = {
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

type DonationCreateResult =
  | {
      type: "created";
      donationId: string;
      orderId: string;
      amount: number;
      currency: "INR";
    }
  | {
      type: "already_paid";
      donationId: string;
      amount: number;
      totalDonated: number;
    };

type DonationPaymentSnapshot = {
  id?: string;
  order_id?: string;
  status?: string;
  amount?: number;
  currency?: string;
};

const ADJECTIVES = [
  "Velvet",
  "Rose",
  "Luxe",
  "Moon",
  "Nova",
  "Silk",
  "Scarlet",
  "Ivory",
  "Stellar",
  "Golden",
  "Crimson",
  "Mystic",
  "Royal",
  "Radiant",
  "Dusk",
  "Aurora",
  "Pearl",
  "Diamond",
  "Opal",
  "Cosmic",
  "Elite",
  "Midnight",
  "Satin",
  "Gilded"
] as const;

const NOUNS = [
  "Lotus",
  "Muse",
  "Halo",
  "Flare",
  "Vibe",
  "Orbit",
  "Aura",
  "Bloom",
  "Crown",
  "Pulse",
  "Wave",
  "Phoenix",
  "Echo",
  "Charm",
  "Rhythm",
  "Star",
  "Comet",
  "Lily",
  "Spark",
  "Dream",
  "Glow",
  "Fable",
  "Whisper",
  "Orbit"
] as const;

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function normalizeDisplayNameInput(value: string) {
  const cleaned = value
    .replace(/[^a-zA-Z0-9 _-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return "";
  }

  return cleaned.slice(0, 28);
}

function toDisplayNameKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function formatProfile(row: MemberProfileRow): EnsureMemberProfileResult {
  return {
    userId: String(row.userId),
    displayName: row.displayName,
    displayNameKey: row.displayNameKey,
    donationTotal: Number(row.donationTotal || 0),
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString()
  };
}

function normalizeDonationAmount(amount: number) {
  const safeAmount = Math.max(1, Math.floor(amount));
  if (!Number.isFinite(safeAmount) || safeAmount > 500_000) {
    throw new Error("Donation amount is not valid.");
  }
  return safeAmount;
}

function normalizeDonationNote(note?: string) {
  const trimmed = (note || "").trim().slice(0, 180);
  return trimmed || undefined;
}

function normalizeIdempotencyKey(value?: string) {
  const trimmed = (value || "").trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.slice(0, 120);
}

function isDuplicateKeyError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      Number((error as { code?: number }).code) === 11000
  );
}

async function isDisplayNameKeyTaken(key: string, excludeUserId?: string) {
  if (!key) {
    return true;
  }

  const profile = (await MemberProfileModel.findOne({
    displayNameKey: key,
    ...(excludeUserId
      ? {
          userId: {
            $ne: new Types.ObjectId(excludeUserId)
          }
        }
      : {})
  })
    .select({ _id: 1 })
    .lean()) as { _id: unknown } | null;

  return Boolean(profile);
}

function generateBaseFromMember(identity: MemberIdentity) {
  const emailUser = identity.email?.split("@")[0]?.trim();
  if (emailUser) {
    const preferred = normalizeDisplayNameInput(emailUser.replace(/[._-]+/g, " "));
    if (preferred.length >= 3) {
      return preferred;
    }
  }

  const phoneTail = (identity.phone || "").replace(/[^0-9]/g, "").slice(-4);
  return phoneTail ? `Member ${phoneTail}` : "Private Member";
}

function generateRandomAlias() {
  const adjective = ADJECTIVES[randomInt(0, ADJECTIVES.length - 1)] || "Luxe";
  const noun = NOUNS[randomInt(0, NOUNS.length - 1)] || "Muse";
  const suffix = randomInt(11, 999);
  return `${adjective} ${noun} ${suffix}`;
}

async function resolveUniqueDisplayName(baseName: string, excludeUserId?: string) {
  const initial = normalizeDisplayNameInput(baseName);

  if (initial.length >= 3) {
    const initialKey = toDisplayNameKey(initial);
    if (initialKey && !(await isDisplayNameKeyTaken(initialKey, excludeUserId))) {
      return {
        displayName: initial,
        displayNameKey: initialKey
      };
    }
  }

  for (let attempt = 0; attempt < 64; attempt += 1) {
    const candidate = normalizeDisplayNameInput(generateRandomAlias());
    if (candidate.length < 3) {
      continue;
    }

    const candidateKey = toDisplayNameKey(candidate);
    if (!candidateKey) {
      continue;
    }

    const taken = await isDisplayNameKeyTaken(candidateKey, excludeUserId);
    if (!taken) {
      return {
        displayName: candidate,
        displayNameKey: candidateKey
      };
    }
  }

  throw new Error("Unable to reserve a unique display name. Please try again.");
}

export async function ensureMemberProfile(identity: MemberIdentity) {
  await connectToDatabase();
  const userId = String(identity._id);

  const existing = (await MemberProfileModel.findOne({ userId: new Types.ObjectId(userId) })
    .select({
      _id: 1,
      userId: 1,
      displayName: 1,
      displayNameKey: 1,
      donationTotal: 1,
      createdAt: 1,
      updatedAt: 1
    })
    .lean()) as MemberProfileRow | null;

  if (existing) {
    return formatProfile(existing);
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const baseName = generateBaseFromMember(identity);
    const unique = await resolveUniqueDisplayName(baseName);

    try {
      const created = await MemberProfileModel.create({
        userId: new Types.ObjectId(userId),
        displayName: unique.displayName,
        displayNameKey: unique.displayNameKey,
        donationTotal: 0,
        avatarSeed: unique.displayNameKey
      });

      return {
        userId,
        displayName: created.displayName,
        displayNameKey: created.displayNameKey,
        donationTotal: Number(created.donationTotal || 0),
        createdAt: created.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: created.updatedAt?.toISOString() || new Date().toISOString()
      };
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("Unable to initialize member profile right now.");
}

export async function ensureMemberProfileByUserId(userId: string) {
  await connectToDatabase();
  const user = (await UserModel.findById(userId)
    .select({ _id: 1, email: 1, phone: 1 })
    .lean()) as MemberIdentity | null;

  if (!user) {
    throw new Error("Member account not found.");
  }

  return ensureMemberProfile(user);
}

export async function isDisplayNameAvailable(name: string, excludeUserId?: string) {
  await connectToDatabase();
  const normalized = normalizeDisplayNameInput(name);
  if (normalized.length < 3) {
    return false;
  }

  const key = toDisplayNameKey(normalized);
  if (!key) {
    return false;
  }

  const taken = await isDisplayNameKeyTaken(key, excludeUserId);
  return !taken;
}

export async function generateUniqueDisplayNameSuggestion({
  excludeUserId,
  hint,
  avoidDisplayNameKey
}: {
  excludeUserId?: string;
  hint?: string;
  avoidDisplayNameKey?: string;
}) {
  await connectToDatabase();

  const normalizedHint = normalizeDisplayNameInput(hint || "");
  const avoidKey = (avoidDisplayNameKey || "").trim().toLowerCase();

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const useHint = attempt === 0 && normalizedHint.length >= 3;
    const base = useHint ? normalizedHint : generateRandomAlias();
    const suggestion = await resolveUniqueDisplayName(base, excludeUserId);

    if (!avoidKey || suggestion.displayNameKey !== avoidKey) {
      return suggestion;
    }
  }

  throw new Error("Unable to generate a different unique name right now.");
}

export async function updateMemberDisplayName(userId: string, name: string) {
  await connectToDatabase();

  const normalized = normalizeDisplayNameInput(name);
  if (normalized.length < 3 || normalized.length > 28) {
    throw new Error("Display name must be between 3 and 28 characters.");
  }

  const key = toDisplayNameKey(normalized);
  if (!key) {
    throw new Error("Display name is not valid.");
  }

  const taken = await isDisplayNameKeyTaken(key, userId);
  if (taken) {
    throw new Error("That display name is already taken.");
  }

  const updated = (await MemberProfileModel.findOneAndUpdate(
    { userId: new Types.ObjectId(userId) },
    {
      $set: {
        displayName: normalized,
        displayNameKey: key,
        avatarSeed: key
      }
    },
    {
      new: true,
      projection: {
        _id: 1,
        userId: 1,
        displayName: 1,
        displayNameKey: 1,
        donationTotal: 1,
        createdAt: 1,
        updatedAt: 1
      }
    }
  ).lean()) as MemberProfileRow | null;

  if (!updated) {
    throw new Error("Member profile is missing. Please refresh and try again.");
  }

  return formatProfile(updated);
}

export async function createDonationCheckoutOrder(params: {
  userId: string;
  amount: number;
  note?: string;
  idempotencyKey?: string;
}): Promise<DonationCreateResult> {
  await connectToDatabase();

  const userObjectId = new Types.ObjectId(params.userId);
  const safeAmount = normalizeDonationAmount(params.amount);
  const safeNote = normalizeDonationNote(params.note);
  const idempotencyKey =
    normalizeIdempotencyKey(params.idempotencyKey) || `srv_${new Types.ObjectId().toHexString()}`;

  await ensureMemberProfileByUserId(params.userId);
  await ensureDonationIndexes();

  if (idempotencyKey) {
    const existing = await DonationModel.findOne({
      userId: userObjectId,
      idempotencyKey
    }).sort({ createdAt: -1 });

    if (existing) {
      if (existing.status === "paid") {
        const profile = await ensureMemberProfileByUserId(params.userId);
        return {
          type: "already_paid",
          donationId: String(existing._id),
          amount: Number(existing.amount || safeAmount),
          totalDonated: profile.donationTotal
        };
      }

      if (existing.razorpayOrderId) {
        return {
          type: "created",
          donationId: String(existing._id),
          orderId: existing.razorpayOrderId,
          amount: Number(existing.amount || safeAmount),
          currency: "INR"
        };
      }

      const order = await createRazorpayOrder({
        amountInr: safeAmount,
        receipt: `don_${String(existing._id).slice(-24)}`,
        notes: {
          memberId: params.userId,
          donationId: String(existing._id)
        }
      });

      existing.razorpayOrderId = order.id;
      existing.status = "created";
      existing.note = safeNote;
      existing.amount = safeAmount;
      await existing.save();

      return {
        type: "created",
        donationId: String(existing._id),
        orderId: order.id,
        amount: safeAmount,
        currency: "INR"
      };
    }
  }

  const donationId = new Types.ObjectId();

  const order = await createRazorpayOrder({
    amountInr: safeAmount,
    receipt: `don_${donationId.toString().slice(-24)}`,
    notes: {
      memberId: params.userId,
      donationId: donationId.toString()
    }
  });

  try {
    await DonationModel.create({
      _id: donationId,
      userId: userObjectId,
      amount: safeAmount,
      currency: "INR",
      note: safeNote,
      status: "created",
      idempotencyKey,
      razorpayOrderId: order.id
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const existing = await DonationModel.findOne({
        userId: userObjectId,
        idempotencyKey
      }).sort({ createdAt: -1 });

      if (existing?.status === "paid") {
        const profile = await ensureMemberProfileByUserId(params.userId);
        return {
          type: "already_paid",
          donationId: String(existing._id),
          amount: Number(existing.amount || safeAmount),
          totalDonated: profile.donationTotal
        };
      }

      if (existing?.razorpayOrderId) {
        return {
          type: "created",
          donationId: String(existing._id),
          orderId: existing.razorpayOrderId,
          amount: Number(existing.amount || safeAmount),
          currency: "INR"
        };
      }
    }

    throw error;
  }

  return {
    type: "created",
    donationId: donationId.toString(),
    orderId: order.id,
    amount: safeAmount,
    currency: "INR"
  };
}

export async function verifyDonationPayment(params: {
  userId: string;
  orderId: string;
  paymentId: string;
  signature: string;
}) {
  await connectToDatabase();

  const userObjectId = new Types.ObjectId(params.userId);
  const orderId = params.orderId.trim();
  const paymentId = params.paymentId.trim();
  const signature = params.signature.trim();

  const donation = await DonationModel.findOne({
    userId: userObjectId,
    razorpayOrderId: orderId
  });

  if (!donation) {
    throw new Error("Donation order was not found.");
  }

  if (!verifyRazorpayPaymentSignature({ orderId, paymentId, signature })) {
    throw new Error("Payment verification failed. Signature mismatch.");
  }

  const payment = (await fetchRazorpayPayment(paymentId)) as DonationPaymentSnapshot;

  if (!payment?.id || payment.id !== paymentId) {
    throw new Error("Unable to verify payment details.");
  }

  if ((payment.order_id || "").trim() !== orderId) {
    throw new Error("Payment does not match this donation order.");
  }

  const paymentStatus = (payment.status || "").toLowerCase();
  if (paymentStatus !== "captured" && paymentStatus !== "authorized") {
    throw new Error("Payment is pending. Please tap Check again in a few seconds.");
  }

  if (Number(payment.amount || 0) !== Number(donation.amount || 0) * 100) {
    throw new Error("Payment amount mismatch.");
  }

  if (String(payment.currency || "INR").toUpperCase() !== "INR") {
    throw new Error("Payment currency mismatch.");
  }

  if (donation.status === "paid") {
    if (donation.razorpayPaymentId && donation.razorpayPaymentId !== paymentId) {
      throw new Error("Donation was already linked to another payment.");
    }

    const profile = await ensureMemberProfileByUserId(params.userId);
    return {
      amount: Number(donation.amount || 0),
      totalDonated: profile.donationTotal,
      alreadyProcessed: true
    };
  }

  const markedPaid = await DonationModel.findOneAndUpdate(
    {
      _id: donation._id,
      status: { $ne: "paid" }
    },
    {
      $set: {
        status: "paid",
        razorpayPaymentId: paymentId,
        razorpaySignature: signature,
        verifiedAt: new Date()
      }
    },
    { new: true }
  );

  if (!markedPaid) {
    const latest = (await DonationModel.findById(donation._id)
      .select({ status: 1, razorpayPaymentId: 1, amount: 1 })
      .lean()) as
      | {
          status?: string;
          razorpayPaymentId?: string;
          amount?: number;
        }
      | null;
    if (latest?.status === "paid" && latest.razorpayPaymentId === paymentId) {
      const profile = await ensureMemberProfileByUserId(params.userId);
      return {
        amount: Number(latest.amount || donation.amount || 0),
        totalDonated: profile.donationTotal,
        alreadyProcessed: true
      };
    }

    throw new Error("Unable to confirm donation right now. Please retry.");
  }

  await MemberProfileModel.updateOne(
    { userId: userObjectId },
    {
      $inc: { donationTotal: Number(donation.amount || 0) }
    }
  );

  const profile = await ensureMemberProfileByUserId(params.userId);
  return {
    amount: Number(donation.amount || 0),
    totalDonated: profile.donationTotal,
    alreadyProcessed: false
  };
}

export async function settleDonationFromWebhook(params: {
  orderId: string;
  paymentId: string;
  eventAt?: Date;
}) {
  await connectToDatabase();

  const orderId = params.orderId.trim();
  const paymentId = params.paymentId.trim();
  if (!orderId || !paymentId) {
    return { matched: false, credited: false };
  }

  const donation = await DonationModel.findOne({
    razorpayOrderId: orderId
  });

  if (!donation) {
    return { matched: false, credited: false };
  }

  if (donation.status === "paid") {
    return { matched: true, credited: false };
  }

  try {
    const markedPaid = await DonationModel.findOneAndUpdate(
      {
        _id: donation._id,
        status: { $ne: "paid" }
      },
      {
        $set: {
          status: "paid",
          razorpayPaymentId: paymentId,
          verifiedAt: params.eventAt || new Date()
        }
      },
      { new: true }
    );

    if (!markedPaid) {
      return { matched: true, credited: false };
    }

    const userId = String(donation.userId);
    const userObjectId = new Types.ObjectId(userId);
    await ensureMemberProfileByUserId(userId);
    await MemberProfileModel.updateOne(
      { userId: userObjectId },
      {
        $inc: { donationTotal: Number(donation.amount || 0) }
      }
    );

    return { matched: true, credited: true };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      Number((error as { code?: number }).code) === 11000
    ) {
      return { matched: true, credited: false };
    }
    throw error;
  }
}

export async function getMemberLeaderboard({
  currentUserId,
  page,
  pageSize,
  query
}: {
  currentUserId: string;
  page: number;
  pageSize: number;
  query?: string;
}): Promise<MemberLeaderboardResult> {
  await connectToDatabase();

  const safePage = Math.max(1, Math.floor(page || 1));
  const safePageSize = Math.max(5, Math.min(50, Math.floor(pageSize || 15)));

  const search = (query || "").trim();
  const filter: Record<string, unknown> = {};
  if (search) {
    filter.displayName = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  }

  const sort = { donationTotal: -1 as const, updatedAt: 1 as const, _id: 1 as const };

  const matching = (await MemberProfileModel.find(filter)
    .sort(sort)
    .select({ userId: 1, displayName: 1, displayNameKey: 1, donationTotal: 1 })
    .lean()) as unknown as MemberProfileRow[];

  const total = matching.length;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const currentPage = Math.min(safePage, totalPages);
  const start = (currentPage - 1) * safePageSize;
  const pageItems = matching.slice(start, start + safePageSize);

  const items: LeaderboardRow[] = pageItems.map((row, index) => ({
    rank: start + index + 1,
    userId: String(row.userId),
    displayName: row.displayName,
    displayNameKey: row.displayNameKey,
    donationTotal: Number(row.donationTotal || 0),
    isCurrentMember: String(row.userId) === String(currentUserId)
  }));

  const currentMemberRankRaw = matching.findIndex(
    (row) => String(row.userId) === String(currentUserId)
  );
  const currentMemberRank = currentMemberRankRaw >= 0 ? currentMemberRankRaw + 1 : null;
  const currentMemberDonationTotal =
    currentMemberRankRaw >= 0 ? Number(matching[currentMemberRankRaw]?.donationTotal || 0) : 0;

  const globalTopRows = (await MemberProfileModel.find({})
    .sort(sort)
    .limit(3)
    .select({ userId: 1, displayName: 1, displayNameKey: 1, donationTotal: 1 })
    .lean()) as unknown as MemberProfileRow[];

  const topThree = globalTopRows.map((row, index) => ({
    rank: index + 1,
    userId: String(row.userId),
    displayName: row.displayName,
    displayNameKey: row.displayNameKey,
    donationTotal: Number(row.donationTotal || 0),
    isCurrentMember: String(row.userId) === String(currentUserId)
  }));

  return {
    items,
    topThree,
    currentMemberRank,
    currentMemberDonationTotal,
    pagination: {
      page: currentPage,
      pageSize: safePageSize,
      total,
      totalPages,
      hasPrev: currentPage > 1,
      hasNext: currentPage < totalPages
    }
  };
}
