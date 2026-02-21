import { InferSchemaType, model, models, Schema, type HydratedDocument } from "mongoose";
import { VIP_AUCTION_STATUSES, VIP_SLOT_DURATIONS } from "@/lib/constants";

const vipAuctionSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 4,
      maxlength: 120
    },
    description: {
      type: String,
      trim: true,
      maxlength: 600
    },
    durationMinutes: {
      type: Number,
      enum: VIP_SLOT_DURATIONS,
      required: true,
      index: true
    },
    callStartsAt: {
      type: Date,
      required: true,
      index: true
    },
    biddingStartsAt: {
      type: Date,
      required: true,
      index: true
    },
    biddingEndsAt: {
      type: Date,
      required: true,
      index: true
    },
    startingBidAmount: {
      type: Number,
      required: true,
      min: 1
    },
    minIncrement: {
      type: Number,
      default: 100,
      min: 1
    },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      default: "INR"
    },
    status: {
      type: String,
      enum: VIP_AUCTION_STATUSES,
      default: "SCHEDULED",
      required: true,
      index: true
    },
    currentBidAmount: {
      type: Number,
      min: 1
    },
    leadingBidUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true
    },
    leadingBidId: {
      type: Schema.Types.ObjectId,
      ref: "VipBid",
      index: true
    },
    bidCount: {
      type: Number,
      default: 0,
      min: 0
    },
    revision: {
      type: Number,
      default: 0,
      min: 0
    },
    antiSnipeEnabled: {
      type: Boolean,
      default: true
    },
    antiSnipeWindowSeconds: {
      type: Number,
      default: 120,
      min: 5,
      max: 900
    },
    antiSnipeExtendSeconds: {
      type: Number,
      default: 120,
      min: 5,
      max: 900
    },
    antiSnipeMaxExtensions: {
      type: Number,
      default: 10,
      min: 0,
      max: 100
    },
    extensionCount: {
      type: Number,
      default: 0,
      min: 0
    },
    lastBidAt: {
      type: Date
    },
    settledAt: {
      type: Date
    },
    bookingConfirmedAt: {
      type: Date
    },
    winnerNotifiedAt: {
      type: Date
    },
    adminNotifiedAt: {
      type: Date
    },
    winnerUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true
    },
    winnerBidId: {
      type: Schema.Types.ObjectId,
      ref: "VipBid",
      index: true
    },
    meetingJoinUrl: {
      type: String,
      trim: true
    },
    adminNotes: {
      type: String,
      trim: true,
      maxlength: 500
    },
    cancelledReason: {
      type: String,
      trim: true,
      maxlength: 240
    }
  },
  { timestamps: true }
);

vipAuctionSchema.index({ status: 1, biddingStartsAt: 1 });
vipAuctionSchema.index({ status: 1, biddingEndsAt: 1 });
vipAuctionSchema.index({ status: 1, callStartsAt: 1 });
vipAuctionSchema.index({ biddingEndsAt: -1, _id: -1 });
vipAuctionSchema.index({ leadingBidUserId: 1, updatedAt: -1 });

export type VipAuctionShape = InferSchemaType<typeof vipAuctionSchema>;
export type VipAuctionDocument = HydratedDocument<VipAuctionShape>;

export const VipAuctionModel = models.VipAuction || model("VipAuction", vipAuctionSchema);
