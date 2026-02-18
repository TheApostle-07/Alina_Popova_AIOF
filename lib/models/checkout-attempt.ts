import { InferSchemaType, model, models, Schema, type HydratedDocument } from "mongoose";

const checkoutAttemptSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    razorpaySubscriptionId: {
      type: String,
      index: true
    },
    status: {
      type: String,
      enum: ["created", "opened", "paid", "failed", "abandoned"],
      default: "created",
      index: true
    }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

checkoutAttemptSchema.index({ userId: 1, createdAt: -1 });
checkoutAttemptSchema.index({ status: 1, createdAt: -1 });

export type CheckoutAttemptShape = InferSchemaType<typeof checkoutAttemptSchema>;
export type CheckoutAttemptDocument = HydratedDocument<CheckoutAttemptShape>;

export const CheckoutAttemptModel =
  models.CheckoutAttempt || model("CheckoutAttempt", checkoutAttemptSchema);
