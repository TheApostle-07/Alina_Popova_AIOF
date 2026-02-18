import { InferSchemaType, model, models, Schema, type HydratedDocument } from "mongoose";
import { MEMBERSHIP_STATES } from "@/lib/constants";

const subscriptionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    razorpayCustomerId: {
      type: String,
      trim: true
    },
    razorpaySubscriptionId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    razorpayPlanId: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: MEMBERSHIP_STATES,
      required: true,
      index: true
    },
    currentStart: {
      type: Date
    },
    currentEnd: {
      type: Date
    },
    nextChargeAt: {
      type: Date
    },
    lastPaymentId: {
      type: String,
      trim: true
    },
    lastEventAt: {
      type: Date,
      index: true
    }
  },
  { timestamps: true }
);

subscriptionSchema.index({ userId: 1, updatedAt: -1 });
subscriptionSchema.index({ status: 1, updatedAt: -1 });
subscriptionSchema.index({ razorpayCustomerId: 1, updatedAt: -1 });
subscriptionSchema.index({ lastPaymentId: 1 }, { sparse: true });

export type SubscriptionShape = InferSchemaType<typeof subscriptionSchema>;
export type SubscriptionDocument = HydratedDocument<SubscriptionShape>;

export const SubscriptionModel = models.Subscription || model("Subscription", subscriptionSchema);
