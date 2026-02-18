import { InferSchemaType, model, models, Schema, type HydratedDocument } from "mongoose";

const restoreOtpChallengeSchema = new Schema(
  {
    _id: {
      type: String,
      required: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      trim: true
    },
    userIds: {
      type: [Schema.Types.ObjectId],
      ref: "User",
      default: []
    },
    codeHash: {
      type: String,
      required: true
    },
    attempts: {
      type: Number,
      default: 0
    },
    maxAttempts: {
      type: Number,
      default: 5
    },
    expiresAt: {
      type: Date,
      required: true
    },
    consumedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
    versionKey: false
  }
);

restoreOtpChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
restoreOtpChallengeSchema.index({ email: 1, createdAt: -1 });
restoreOtpChallengeSchema.index({ phone: 1, createdAt: -1 });

export type RestoreOtpChallengeShape = InferSchemaType<typeof restoreOtpChallengeSchema>;
export type RestoreOtpChallengeDocument = HydratedDocument<RestoreOtpChallengeShape>;

export const RestoreOtpChallengeModel =
  models.RestoreOtpChallenge || model("RestoreOtpChallenge", restoreOtpChallengeSchema);
