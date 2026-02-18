import { InferSchemaType, model, models, Schema, type HydratedDocument } from "mongoose";

const donationSchema = new Schema(
  {
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
    status: {
      type: String,
      enum: ["created", "paid", "failed"],
      default: "created",
      index: true
    },
    razorpayOrderId: {
      type: String,
      trim: true,
      index: true
    },
    razorpayPaymentId: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      index: true
    },
    razorpaySignature: {
      type: String,
      trim: true
    },
    verifiedAt: {
      type: Date
    },
    note: {
      type: String,
      trim: true,
      maxlength: 180
    },
    idempotencyKey: {
      type: String,
      trim: true,
      maxlength: 120
    }
  },
  { timestamps: true }
);

donationSchema.index({ userId: 1, createdAt: -1 });
donationSchema.index(
  { userId: 1, razorpayOrderId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      razorpayOrderId: { $type: "string" }
    }
  }
);
donationSchema.index(
  { userId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: { $type: "string" }
    }
  }
);

export type DonationShape = InferSchemaType<typeof donationSchema>;
export type DonationDocument = HydratedDocument<DonationShape>;

export const DonationModel = models.Donation || model("Donation", donationSchema);

let donationIndexesReady: Promise<void> | null = null;

export async function ensureDonationIndexes() {
  if (donationIndexesReady) {
    return donationIndexesReady;
  }

  donationIndexesReady = (async () => {
    const collection = DonationModel.collection;
    const indexes = await collection.indexes().catch(() => []);

    const orderIndex = indexes.find((index) => index.name === "userId_1_razorpayOrderId_1");
    const orderIndexNeedsRefresh =
      !orderIndex ||
      Boolean((orderIndex as { sparse?: boolean }).sparse) ||
      !(
        (orderIndex as { partialFilterExpression?: { razorpayOrderId?: { $type?: string } } })
          .partialFilterExpression?.razorpayOrderId?.$type === "string"
      );

    if (orderIndexNeedsRefresh) {
      if (orderIndex) {
        await collection.dropIndex("userId_1_razorpayOrderId_1").catch(() => undefined);
      }
      await collection.createIndex(
        { userId: 1, razorpayOrderId: 1 },
        {
          name: "userId_1_razorpayOrderId_1",
          unique: true,
          partialFilterExpression: {
            razorpayOrderId: { $type: "string" }
          }
        }
      );
    }

    const idempotencyIndex = indexes.find((index) => index.name === "userId_1_idempotencyKey_1");
    const idempotencyIndexNeedsRefresh =
      !idempotencyIndex ||
      Boolean((idempotencyIndex as { sparse?: boolean }).sparse) ||
      !(
        (idempotencyIndex as { partialFilterExpression?: { idempotencyKey?: { $type?: string } } })
          .partialFilterExpression?.idempotencyKey?.$type === "string"
      );

    if (idempotencyIndexNeedsRefresh) {
      if (idempotencyIndex) {
        await collection.dropIndex("userId_1_idempotencyKey_1").catch(() => undefined);
      }
      await collection.createIndex(
        { userId: 1, idempotencyKey: 1 },
        {
          name: "userId_1_idempotencyKey_1",
          unique: true,
          partialFilterExpression: {
            idempotencyKey: { $type: "string" }
          }
        }
      );
    }
  })();

  return donationIndexesReady;
}
