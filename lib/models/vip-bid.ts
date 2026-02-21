import { InferSchemaType, model, models, Schema, type HydratedDocument } from "mongoose";

const vipBidSchema = new Schema(
  {
    auctionId: {
      type: Schema.Types.ObjectId,
      ref: "VipAuction",
      required: true,
      index: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    amount: {
      type: Number,
      required: true,
      min: 1
    },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      default: "INR"
    },
    placedAt: {
      type: Date,
      required: true,
      default: () => new Date(),
      index: true
    },
    idempotencyKey: {
      type: String,
      trim: true,
      maxlength: 120
    },
    wasAutoExtended: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

vipBidSchema.index({ auctionId: 1, amount: -1, placedAt: -1, _id: -1 });
vipBidSchema.index({ auctionId: 1, userId: 1, placedAt: -1, _id: -1 });
vipBidSchema.index(
  { auctionId: 1, userId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: { $type: "string" }
    }
  }
);

export type VipBidShape = InferSchemaType<typeof vipBidSchema>;
export type VipBidDocument = HydratedDocument<VipBidShape>;

export const VipBidModel = models.VipBid || model("VipBid", vipBidSchema);
